export type PresetId = "structured" | "specific" | "shorter" | "constraints";

export const PRESETS: Record<PresetId, { label: string; instruction: string }> = {
     structured: {
          label: "Structure as task",
          instruction:
               "Restructure the prompt into clear sections: Goal, Context, Constraints, Expected Output.",
     },
     specific: {
          label: "More specific",
          instruction:
               "Make the prompt more specific: resolve ambiguity, name concrete technologies, files, and acceptance criteria implied by the prompt.",
     },
     shorter: {
          label: "Shorter",
          instruction:
               "Rewrite the prompt to be as short as possible while keeping all essential requirements. No sections, just tight prose.",
     },
     constraints: {
          label: "Add constraints",
          instruction:
               "Keep the prompt's intent but add sensible engineering constraints (scope limits, error handling, testing, style) as a bullet list.",
     },
};

export const SYSTEM_PROMPT = `You are a prompt engineer for AI coding agents (Copilot, Cursor).
You receive a rough draft prompt from a developer. Your ONLY job is to rewrite it into a better prompt.

Rules:
- NEVER answer or execute the prompt. Only rewrite it.
- Preserve the user's intent and their language (reply in the same language as the draft).
- Keep any code snippets, file paths, and identifiers exactly as written.
- Do not invent requirements the user clearly does not want; mark assumptions as "Assumption:" if needed.
- Output ONLY the improved prompt. No preamble, no explanations, no markdown code fences around the whole output.`;

export function buildUserMessage(draft: string, preset: PresetId): string {
     return `${PRESETS[preset].instruction}\n\nDraft prompt:\n"""\n${draft}\n"""`;
}