export interface Env {
  RATE_LIMIT: KVNamespace;
  GROQ_API_KEY: string;
  DAILY_LIMIT: string;
}

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  dailyLimit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10); // "2024-08-07"
  const key = `rl:${ip}:${today}`;

  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= dailyLimit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment with TTL of 25 hours (expires tomorrow regardless of exact time)
  await kv.put(key, String(count + 1), { expirationTtl: 90000 });
  return { allowed: true, remaining: dailyLimit - count - 1 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // --- Rate limiting ---
    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      "unknown";
    const dailyLimit = parseInt(env.DAILY_LIMIT ?? "30", 10);
    const { allowed, remaining } = await checkRateLimit(env.RATE_LIMIT, ip, dailyLimit);

    if (!allowed) {
      return json(
        {
          error: `Free tier limit reached (${dailyLimit} requests/day). Add your own API key in Prompt Improver settings for unlimited use.`,
          code: "RATE_LIMITED",
        },
        429
      );
    }

    // --- Parse body ---
    let body: { systemPrompt: string; userMessage: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.systemPrompt || !body.userMessage) {
      return json({ error: "Missing systemPrompt or userMessage" }, 400);
    }

    // Sanity check — refuse very large payloads
    if (body.userMessage.length > 8000) {
      return json({ error: "Prompt too long (max 8000 characters)" }, 400);
    }

    // --- Call Groq ---
    let groqResponse: Response;
    try {
      groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: body.systemPrompt },
            { role: "user", content: body.userMessage },
          ],
          temperature: 0.4,
          max_tokens: 2048,
        }),
      });
    } catch (err) {
      return json({ error: "Failed to reach Groq API" }, 502);
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq error:", groqResponse.status, errorText);
      return json({ error: "LLM service error. Please try again." }, 502);
    }

    const groqData = (await groqResponse.json()) as {
      choices: { message: { content: string } }[];
    };

    const improved = groqData.choices?.[0]?.message?.content?.trim();
    if (!improved) {
      return json({ error: "Empty response from LLM" }, 502);
    }

    return json({ improved, remaining });
  },
};
