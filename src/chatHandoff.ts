import * as vscode from "vscode";

const isCursor = vscode.env.appName.toLowerCase().includes("cursor");

/** Send the improved prompt to the native AI chat, with graceful fallbacks. */
export async function sendToChat(prompt: string): Promise<void> {
  if (!isCursor) {
    // VS Code: officially works — opens Copilot Chat pre-filled.
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", prompt);
      return;
    } catch {
      /* fall through to clipboard */
    }
  } else {
    // Cursor: no public chat API. Feature-detect known command IDs at runtime.
    const candidates = [
      "composer.startComposerPrompt",
      "aichat.newchataction",
      "workbench.action.chat.open",
    ];
    const all = await vscode.commands.getCommands(true);
    for (const id of candidates) {
      if (all.includes(id)) {
        try {
          await vscode.commands.executeCommand(id, prompt);
          // Command may open the chat without inserting text — also copy.
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.setStatusBarMessage(
            "Prompt copied — paste with Cmd/Ctrl+V if not inserted",
            4000
          );
          return;
        } catch {
          /* try next */
        }
      }
    }
  }
  // Universal fallback: clipboard + hint.
  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(
    "Improved prompt copied to clipboard — paste it into the chat (Cmd/Ctrl+L)."
  );
}