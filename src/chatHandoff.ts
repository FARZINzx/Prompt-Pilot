import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Detect which editor we are running in at startup (cached — never changes)
// ---------------------------------------------------------------------------
const appName = vscode.env.appName.toLowerCase();
const isCursor    = appName.includes("cursor");
const isWindsurf  = appName.includes("windsurf");
// Everything else is treated as VS Code / VS Code fork

// ---------------------------------------------------------------------------
// sendToChat — best-effort insert into the native AI chat
//
// Strategy per editor:
//
//  VS Code     → workbench.action.chat.open(prompt)
//               Opens Copilot Chat with the prompt pre-filled in the input.
//               User presses Enter to submit.
//
//  Cursor      → composer.newAgentChat → wait → clipboard → paste
//               Opens the Composer, waits for focus, then pastes the text.
//               User presses Enter to submit.
//
//  Windsurf    → windsurf.cascade.focus (or Ctrl+L equivalent) → clipboard
//               Opens Cascade panel, copies prompt so user can paste (Ctrl+V).
//
//  Unknown     → clipboard + info message as universal fallback
// ---------------------------------------------------------------------------
export async function sendToChat(prompt: string): Promise<void> {
  const all = await vscode.commands.getCommands(true);
  const has = (id: string) => all.includes(id);

  // ── Cursor ────────────────────────────────────────────────────────────────
  if (isCursor) {
    await sendToCursor(prompt, has);
    return;
  }

  // ── Windsurf ──────────────────────────────────────────────────────────────
  if (isWindsurf) {
    await sendToWindsurf(prompt, has);
    return;
  }

  // ── VS Code / generic VS Code fork ────────────────────────────────────────
  await sendToVSCode(prompt, has);
}

// ---------------------------------------------------------------------------

async function sendToVSCode(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  // workbench.action.chat.open accepts a string argument and pre-fills the input
  if (has("workbench.action.chat.open")) {
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", prompt);
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.setStatusBarMessage(
        "✨ Prompt loaded in Copilot Chat — press Enter to send",
        4000
      );
      return;
    } catch {
      /* fall through */
    }
  }

  // Fallback: plain clipboard
  await clipboardFallback(prompt);
}

async function sendToCursor(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  // Ordered by preference: Agent > Composer > Chat
  const openCmds = [
    "composer.newAgentChat",
    "composer.startComposerPrompt",
    "aichat.newchataction",
    "aichat.show-ai-chat",
    "workbench.action.chat.open",
  ];

  const openCmd = openCmds.find(has);

  if (openCmd) {
    try {
      // 1. Copy prompt to clipboard BEFORE opening so it's ready
      await vscode.env.clipboard.writeText(prompt);

      // 2. Open the composer/chat window
      await vscode.commands.executeCommand(openCmd);

      // 3. Wait for the UI to render and gain focus
      await delay(600);

      // 4. Paste into the active input (works when Composer input is focused)
      await vscode.commands.executeCommand("editor.action.clipboardPasteAction");

      vscode.window.setStatusBarMessage(
        "✨ Prompt pasted in Cursor — press Enter to send",
        4000
      );
      return;
    } catch {
      /* fall through to clipboard fallback */
    }
  }

  await clipboardFallback(prompt);
}

async function sendToWindsurf(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  // Windsurf Cascade focus commands (discovered via command palette)
  const cascadeCmds = [
    "windsurf.cascade.focus",
    "windsurf.openCascade",
    "codeium.openCascade",
    "workbench.action.chat.open",
  ];

  const openCmd = cascadeCmds.find(has);

  // Always copy to clipboard first
  await vscode.env.clipboard.writeText(prompt);

  if (openCmd) {
    try {
      await vscode.commands.executeCommand(openCmd);
      await delay(400);
      // Try paste — may or may not work depending on Windsurf version
      await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
      vscode.window.setStatusBarMessage(
        "✨ Prompt copied — paste in Cascade with Ctrl+V if needed",
        4000
      );
      return;
    } catch {
      /* fall through */
    }
  }

  vscode.window.showInformationMessage(
    "✨ Prompt copied to clipboard — open Cascade (Ctrl+L) and paste with Ctrl+V."
  );
}

async function clipboardFallback(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(
    "✨ Prompt copied to clipboard — open your AI chat and paste with Ctrl+V (or Cmd+V)."
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}