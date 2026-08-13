import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Detect which editor we are running in at startup (cached — never changes)
// ---------------------------------------------------------------------------
const appName = vscode.env.appName.toLowerCase();
const isCursor   = appName.includes("cursor");
const isWindsurf = appName.includes("windsurf");

// ---------------------------------------------------------------------------
// sendToChat
//
// Goal: open the AI chat panel of the current editor and INSERT the prompt
//       into the input field WITHOUT auto-submitting. User reviews + presses Enter.
//
//  VS Code     → workbench.action.chat.openagent  { query, isPartialQuery: true }
//                Falls back to workbench.action.chat.open(prompt)
//
//  Cursor      → open Composer → clipboard → paste into focused input
//
//  Windsurf    → open Cascade → clipboard → paste attempt
//
//  Fallback    → clipboard + info message (always works everywhere)
// ---------------------------------------------------------------------------
export async function sendToChat(prompt: string): Promise<void> {
  const all = await vscode.commands.getCommands(true);
  const has = (id: string) => all.includes(id);

  if (isCursor)   { await sendToCursor(prompt, has);   return; }
  if (isWindsurf) { await sendToWindsurf(prompt, has); return; }
  await sendToVSCode(prompt, has);
}

// ---------------------------------------------------------------------------
// VS Code
// ---------------------------------------------------------------------------
async function sendToVSCode(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  // Best: openagent with isPartialQuery:true → puts text in input, no auto-submit
  if (has("workbench.action.chat.openagent")) {
    try {
      await vscode.commands.executeCommand("workbench.action.chat.openagent", {
        query: prompt,
        isPartialQuery: true,   // ← prevents auto-submit
        focus: true,
      });
      vscode.window.setStatusBarMessage(
        "✨ Prompt loaded in Copilot Chat — press Enter to send",
        4000
      );
      return;
    } catch { /* fall through */ }
  }

  // Fallback: older VS Code — still pre-fills the input
  if (has("workbench.action.chat.open")) {
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", prompt);
      vscode.window.setStatusBarMessage(
        "✨ Prompt loaded in Copilot Chat — press Enter to send",
        4000
      );
      return;
    } catch { /* fall through */ }
  }

  await clipboardFallback(prompt);
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------
async function sendToCursor(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  const openCmds = [
    "composer.newAgentChat",
    "composer.startComposerPrompt",
    "aichat.newchataction",
    "aichat.show-ai-chat",
    "workbench.action.chat.openagent",
    "workbench.action.chat.open",
  ];

  const openCmd = openCmds.find(has);

  if (openCmd) {
    try {
      // 1. Try openagent with query first (works if Cursor supports it)
      if (openCmd.includes("chat.open")) {
        await vscode.commands.executeCommand(openCmd, {
          query: prompt,
          isPartialQuery: true,
          focus: true,
        });
        vscode.window.setStatusBarMessage(
          "✨ Prompt loaded — press Enter to send",
          4000
        );
        return;
      }

      // 2. Composer-specific: open panel → clipboard → paste
      await vscode.env.clipboard.writeText(prompt);
      await vscode.commands.executeCommand(openCmd);
      await delay(700); // wait for Composer UI to render and focus
      await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
      vscode.window.setStatusBarMessage(
        "✨ Prompt pasted in Cursor Composer — press Enter to send",
        4000
      );
      return;
    } catch { /* fall through */ }
  }

  await clipboardFallback(prompt);
}

// ---------------------------------------------------------------------------
// Windsurf
// ---------------------------------------------------------------------------
async function sendToWindsurf(
  prompt: string,
  has: (id: string) => boolean
): Promise<void> {
  const cascadeCmds = [
    "windsurf.cascade.focus",
    "windsurf.openCascade",
    "codeium.openCascade",
    "workbench.action.chat.openagent",
    "workbench.action.chat.open",
  ];

  const openCmd = cascadeCmds.find(has);

  // Always copy to clipboard first — Windsurf paste is best-effort
  await vscode.env.clipboard.writeText(prompt);

  if (openCmd) {
    try {
      if (openCmd.includes("chat.open")) {
        await vscode.commands.executeCommand(openCmd, {
          query: prompt,
          isPartialQuery: true,
          focus: true,
        });
      } else {
        await vscode.commands.executeCommand(openCmd);
        await delay(500);
        await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
      }
      vscode.window.setStatusBarMessage(
        "✨ Prompt loaded in Cascade — press Enter to send  (Ctrl+V if needed)",
        5000
      );
      return;
    } catch { /* fall through */ }
  }

  vscode.window.showInformationMessage(
    "✨ Prompt copied — open Cascade (Ctrl+L) and paste with Ctrl+V."
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function clipboardFallback(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(
    "✨ Prompt copied — open your AI chat and paste with Ctrl+V (or Cmd+V)."
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}