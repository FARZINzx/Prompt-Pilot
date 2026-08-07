# AGENT_GUIDE.md — Prompt Improver VS Code Extension

> **Authoritative reference for all future AI-agent development on this project.**  
> Written after a full reverse-engineering of every file in the repository.  
> Treat this document as ground truth. Update it whenever the architecture changes.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Product Vision](#2-product-vision)
3. [Business Domain](#3-business-domain)
4. [Target Users](#4-target-users)
5. [Technical Stack](#5-technical-stack)
6. [Architecture Overview](#6-architecture-overview)
7. [Folder Structure](#7-folder-structure)
8. [File-by-File Reference](#8-file-by-file-reference)
9. [Coding Standards](#9-coding-standards)
10. [Naming Conventions](#10-naming-conventions)
11. [UI Standards](#11-ui-standards)
12. [API Standards (VS Code Extension API)](#12-api-standards-vs-code-extension-api)
13. [Build System](#13-build-system)
14. [Configuration & Settings](#14-configuration--settings)
15. [Permission System & Security Model](#15-permission-system--security-model)
16. [Business Rules](#16-business-rules)
17. [Data Flow](#17-data-flow)
18. [Feature Map](#18-feature-map)
19. [Important Entities](#19-important-entities)
20. [Common Patterns](#20-common-patterns)
21. [Existing Design Decisions](#21-existing-design-decisions)
22. [Performance Considerations](#22-performance-considerations)
23. [Security Rules](#23-security-rules)
24. [Technical Debt & Known Issues](#24-technical-debt--known-issues)
25. [Future Improvement Opportunities](#25-future-improvement-opportunities)
26. [Do's](#26-dos)
27. [Don'ts](#27-donts)
28. [Common Mistakes to Avoid](#28-common-mistakes-to-avoid)
29. [Areas Requiring Extra Caution](#29-areas-requiring-extra-caution)
30. [Checklists](#30-checklists)
31. [AI Agent Instructions](#31-ai-agent-instructions)

---

## 1. Project Overview

**Name:** `prompt-improver`  
**Display Name:** Prompt Improver  
**Version:** 0.0.1 (early prototype / milestone 1)  
**Type:** VS Code Extension (WebviewView panel)  
**Package Manager:** npm  
**Repository Root:** `e:\Programming\Prompt Optimsor\`

**One-sentence summary:**  
A VS Code sidebar extension that lets developers write a rough AI prompt, optionally improve it via an LLM, and then send the improved prompt directly into the native AI chat (Copilot, Cursor Composer, or clipboard fallback).

---

## 2. Product Vision

The extension lives in the VS Code activity bar as a lightweight prompt drafting and optimization tool. The user's workflow is:

1. Open the "Prompt Improver" sidebar panel.
2. Write a rough/unrefined prompt in the top textarea.
3. Click **✨ Improve** — the extension rewrites the prompt using an LLM (or a deterministic stub in M1).
4. Review and optionally hand-edit the improved prompt in the output textarea.
5. Click **➤ Send to chat** to inject it into Copilot Chat / Cursor Composer, **or** click **Copy** to put it on the clipboard.

The product targets the friction point that developers often write weak, vague prompts to their AI coding assistants, leading to poor results. This extension gives them a one-click "prompt polish" step.

**Milestone structure (inferred from code comments):**
- **M1 (current):** Full UX loop with a deterministic stub (`stubImprove`) that wraps the draft in a structured template. No real LLM call.
- **M2 (planned):** Replace `stubImprove` with the real `LlmService` + `improvementEngine` using actual LLM APIs.

---

## 3. Business Domain

**Domain:** Developer tooling / AI productivity  
**Sub-domain:** Prompt engineering, AI chat handoff

**Core problem solved:** Developers waste AI tokens (and iteration cycles) on poorly-specified prompts. This extension adds a structured "prompt improvement" step between thought and AI execution.

**No external services are called in M1.** M2 will add calls to external LLM APIs (OpenAI, Anthropic, Ollama) or the VS Code built-in LM API.

---

## 4. Target Users

| User Type | Description |
|-----------|-------------|
| **Primary** | Developers using VS Code or Cursor who also use AI chat tools (Copilot, Cursor Composer) |
| **Secondary** | Any VS Code user who writes prompts frequently |

**There is only one user role.** There is no authentication, no accounts, no multi-user concept. Every user is the local developer running the extension in their own VS Code instance.

---

## 5. Technical Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Extension host | Node.js | ^20.x |
| Language | TypeScript | ^5.4.0 |
| Extension target | VS Code Extension API | ^1.85.0 |
| Webview UI | Vanilla HTML + CSS + JavaScript (inline, no framework) | — |
| Build tool | esbuild | ^0.21.0 |
| Module format (output) | CommonJS (`cjs`) | — |
| TS module resolution | `Node16` | — |
| TS target | `ES2022` | — |

**Dependencies:**
- **Runtime:** None (zero npm runtime dependencies). `vscode` is treated as an external peer.
- **Dev-only:** `@types/vscode`, `@types/node`, `esbuild`, `typescript`.

**No React, no Vue, no Svelte, no TailwindCSS, no CSS frameworks.** The webview UI is entirely inline HTML/CSS/JS inside a template literal string in `PromptPanelProvider.ts`.

**Planned but not yet implemented (M2):**
- `openai` npm package (for OpenAI-compatible APIs)
- `@anthropic-ai/sdk` (for Anthropic)
- VS Code Language Model API (`vscode.lm`) for the built-in provider

---

## 6. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js process)                    │
│                                                              │
│  extension.ts  ──► PromptPanelProvider                       │
│                         │                                    │
│                         ├── registers WebviewView            │
│                         ├── handles webview messages         │
│                         │     • "improve" → stubImprove()    │
│                         │     • "send"    → chatHandoff.ts   │
│                         │     • "copy"    → clipboard API    │
│                         └── renders inline HTML/CSS/JS       │
│                                                              │
│  chatHandoff.ts ──► VS Code commands (chat.open / Cursor)    │
│  core/improvementEngine.ts ──► PRESETS, SYSTEM_PROMPT        │
│  llm/LlmService.ts ──► (empty — M2 placeholder)             │
└──────────────────────────────────────────────────────────────┘
           │  postMessage (two-way)
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Webview (sandboxed browser context)                         │
│  • Two textareas (input / output)                            │
│  • Buttons: Improve, Send to chat, Copy                      │
│  • Status bar text                                           │
│  • State persistence via vscode.getState() / setState()      │
└──────────────────────────────────────────────────────────────┘
```

**Communication pattern:** The extension host and the webview communicate exclusively through `postMessage` / `onDidReceiveMessage`. This is the standard VS Code webview messaging pattern. There is no shared memory or direct DOM access from the host.

---

## 7. Folder Structure

```
e:\Programming\Prompt Optimsor\
│
├── .vscode/
│   └── launch.json              # Debug: launches Extension Host, runs `npm: build` first
│
├── dist/
│   ├── extension.js             # Built output (CJS bundle, committed — contains source map)
│   └── extension.js.map         # Source map for debugging
│
├── node_modules/                # Dev dependencies only
│
├── src/
│   ├── extension.ts             # Entry point — activate() / deactivate()
│   ├── PromptPanelProvider.ts   # WebviewViewProvider — UI shell, message router
│   ├── chatHandoff.ts           # Sends prompt to VS Code / Cursor native chat
│   │
│   ├── core/
│   │   └── improvementEngine.ts # PRESETS, SYSTEM_PROMPT, buildUserMessage()
│   │
│   └── llm/
│       └── LlmService.ts        # EMPTY — M2 placeholder for LLM API client
│
├── esbuild.js                   # Build script (dev, watch, production modes)
├── package.json                 # Extension manifest + npm scripts + VS Code contributions
├── package-lock.json            # Lockfile
└── tsconfig.json                # TypeScript configuration
```

---

## 8. File-by-File Reference

### `src/extension.ts`

**Purpose:** VS Code extension entry point.

**Exports:**
- `activate(context: vscode.ExtensionContext)` — called by VS Code when the extension activates.
- `deactivate()` — empty; no cleanup needed.

**What activate() does:**
1. Creates a `PromptPanelProvider` instance.
2. Registers it as a `WebviewViewProvider` for view ID `"promptImprover.panel"`.
3. Registers a command `"promptImprover.focus"` that delegates to `"promptImprover.panel.focus"` (the built-in view focus command). This is a convenience command — not currently exposed in the command palette by itself, but can be called programmatically.

**Important:** `retainContextWhenHidden: false` — the webview is destroyed when hidden. State persistence is handled via `vscode.getState()` / `vscode.setState()` in the webview JavaScript.

---

### `src/PromptPanelProvider.ts`

**Purpose:** The core UI container. Implements `vscode.WebviewViewProvider`.

**Key responsibilities:**
1. Generates and serves the entire HTML/CSS/JS webview UI via `html()`.
2. Receives messages from the webview via `onDidReceiveMessage`.
3. Routes messages to appropriate handlers (stub improve, chat handoff, clipboard).
4. Posts results back to the webview.

**Message types (WebviewMsg union):**

| `type` | Payload | Handler |
|--------|---------|---------|
| `"improve"` | `prompt: string` | `stubImprove()` → posts `{ type: "result", improved }` back |
| `"send"` | `prompt: string` | `sendToChat()` from chatHandoff.ts |
| `"copy"` | `prompt: string` | `vscode.env.clipboard.writeText()` + status bar message |

**`stubImprove(prompt: string): string`**  
Deterministic, synchronous template wrapper. It wraps the user's raw text in a three-section Markdown structure:
```
## Goal
<original prompt trimmed>

## Constraints
- Keep changes minimal and focused
- Explain key decisions briefly

## Expected output
- Working code with file paths
- Short summary of what changed
```

> This is an **M1 placeholder**. It must be replaced with a real LLM call in M2. The comment in the code says: "M1 stub — replaced by the real LLM engine in M2." Do not treat its output as the intended final behavior.

**CSP (Content Security Policy):**  
The webview uses a nonce-based CSP:
```
default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';
```
- Inline styles are allowed (`unsafe-inline`).
- All scripts must have the correct nonce.
- No external network access is allowed from the webview.

**State persistence:**  
The webview calls `vscode.getState()` on load to restore `{ input, output }` and calls `vscode.setState()` on every keystroke. This is the lightweight alternative to `retainContextWhenHidden: true`.

---

### `src/chatHandoff.ts`

**Purpose:** Sends the final (improved) prompt into the native AI chat of the host editor. Handles VS Code vs. Cursor differences.

**Exported function:** `sendToChat(prompt: string): Promise<void>`

**Logic (branching on `vscode.env.appName`):**

**VS Code path:**
- Calls `vscode.commands.executeCommand("workbench.action.chat.open", prompt)`.
- On failure, falls through to clipboard fallback.

**Cursor path (no public chat API):**
- Dynamically enumerates all registered commands at runtime.
- Tries a list of candidate command IDs in order:
  1. `"composer.startComposerPrompt"`
  2. `"aichat.newchataction"`
  3. `"workbench.action.chat.open"`
- For the first matching command found: executes it AND copies prompt to clipboard (because the command may open the chat without pre-filling the text field).
- Shows a status bar hint: "Prompt copied — paste with Cmd/Ctrl+V if not inserted" for 4 seconds.

**Universal fallback (both paths):**
- Writes prompt to clipboard.
- Shows an information message: "Improved prompt copied to clipboard — paste it into the chat (Cmd/Ctrl+L)."

---

### `src/core/improvementEngine.ts`

**Purpose:** The domain logic for prompt improvement. Contains the LLM system prompt, improvement presets, and the user message builder.

**Exports:**

**`PresetId` (type):** `"structured" | "specific" | "shorter" | "constraints"`

**`PRESETS` (constant, `Record<PresetId, { label: string; instruction: string }>`):**

| PresetId | Label | Instruction |
|----------|-------|-------------|
| `structured` | "Structure as task" | Restructures into Goal, Context, Constraints, Expected Output sections |
| `specific` | "More specific" | Resolves ambiguity, names concrete technologies, files, acceptance criteria |
| `shorter` | "Shorter" | Rewrites as tight prose with minimal words, no sections |
| `constraints` | "Add constraints" | Adds engineering constraints (scope, error handling, testing, style) as bullet list |

**`SYSTEM_PROMPT` (constant, string):**  
The master system prompt for the LLM. Rules baked in:
1. NEVER answer or execute the prompt — only rewrite it.
2. Preserve the user's intent and their language (reply in same language as draft).
3. Keep code snippets, file paths, and identifiers exactly as-is.
4. Do not invent requirements; mark assumptions as "Assumption:" if needed.
5. Output ONLY the improved prompt — no preamble, no explanations, no wrapping markdown fences.

**`buildUserMessage(draft: string, preset: PresetId): string`:**  
Constructs the user-facing message to send to the LLM:
```
<preset.instruction>

Draft prompt:
"""
<draft>
"""
```

> **None of this is wired up to the webview yet.** The presets exist in `improvementEngine.ts` but `PromptPanelProvider.ts` does not use them. The webview has no preset selector UI. This is part of M2 work.

---

### `src/llm/LlmService.ts`

**Purpose:** M2 placeholder file. **Currently completely empty (0 bytes of actual code — just a newline).**

**Planned responsibility:** Abstract the LLM provider selection and API calls. Based on `package.json` configuration, it should support:
- `vscode-lm` — VS Code built-in LM API
- `openai` — OpenAI-compatible (also used for Ollama via base URL override)
- `anthropic` — Anthropic SDK

> Do NOT import this file from anywhere until it is implemented. It exports nothing.

---

### `esbuild.js`

**Purpose:** Custom build script (Node.js, not TypeScript).

**Modes:**
- `node esbuild.js` — single build (development, with source maps, not minified)
- `node esbuild.js --watch` — watch mode (incremental builds)
- `node esbuild.js --production` — minified, no source maps (used by `vscode:prepublish`)

**Configuration:**
- Entry: `src/extension.ts`
- Output: `dist/extension.js` (single CJS bundle)
- `vscode` is externalized (not bundled — provided by VS Code runtime)
- `platform: "node"` — extension host is Node.js
- Errors exit with code 1

---

### `package.json` (Extension Manifest)

**Contributes:**

| Contribution | Details |
|---|---|
| View container | Activity bar item `"promptImprover"` with sparkle icon `$(sparkle)` |
| View | Webview view `"promptImprover.panel"` titled "Improve Prompt" |
| Command | `"promptImprover.setApiKey"` — "Prompt Improver: Set API Key" (M2 — not yet implemented in code) |
| Keybinding | `Ctrl+Alt+P` (Win/Linux) / `Cmd+Alt+P` (Mac) — focuses the panel |
| Settings | See Section 14 |

> The command `"promptImprover.setApiKey"` is declared in `package.json` but **not registered** in `extension.ts`. Clicking it will show a "Command not found" error. This is M2 work.

---

## 9. Coding Standards

- **TypeScript strict mode** is enabled (`"strict": true` in `tsconfig.json`). All code must be type-safe with no implicit `any`.
- **No runtime dependencies** — keep the extension lightweight. Every runtime dependency must be justified.
- **Async/await** is the pattern for all async operations (no raw Promise chains or callbacks).
- **`try/catch` with graceful fallback** — errors in chat handoff should never surface as unhandled rejections; always fall through to a safe fallback action.
- **Inline HTML** — the webview UI lives entirely inside a template literal in `PromptPanelProvider.ts`. Do not split it into a separate file unless the HTML grows significantly larger.
- **Comments on stubs** — any placeholder/stub code must have a comment indicating it is temporary and what replaces it (e.g., `// M1 stub — replaced by the real LLM engine in M2.`).
- **No `console.log`** in production paths. Use VS Code output channels if logging is needed.
- **Module format:** Node16 module resolution. Use `.ts` extensions in imports when required by Node16.

---

## 10. Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Files (classes) | PascalCase | `PromptPanelProvider.ts`, `LlmService.ts` |
| Files (modules/utilities) | camelCase | `chatHandoff.ts`, `improvementEngine.ts` |
| Classes | PascalCase | `PromptPanelProvider` |
| Interfaces / Types | PascalCase | `WebviewMsg`, `PresetId` |
| Constants (module-level, exported) | SCREAMING_SNAKE_CASE | `PRESETS`, `SYSTEM_PROMPT` |
| Functions | camelCase | `sendToChat`, `buildUserMessage`, `stubImprove` |
| VS Code command IDs | dot.separated prefix | `"promptImprover.setApiKey"`, `"promptImprover.panel.focus"` |
| VS Code setting keys | `extensionName.category.key` | `"promptImprover.provider"`, `"promptImprover.openai.model"` |
| VS Code view/container IDs | camelCase | `"promptImprover"`, `"promptImprover.panel"` |
| Webview message `type` field | camelCase string literal | `"improve"`, `"send"`, `"copy"`, `"result"` |
| Folders under `src/` | camelCase | `core/`, `llm/` |

---

## 11. UI Standards

The webview UI is implemented entirely as inline HTML/CSS/JS inside `PromptPanelProvider.ts`.

**Design principles:**
- Uses VS Code CSS variables exclusively for colors, fonts, and backgrounds — never hardcoded hex values.
- Adapts to any VS Code theme (light, dark, high contrast) automatically via CSS variables.
- Minimal layout: vertical stack of labeled sections.
- Typography: `var(--vscode-font-family)`, `13px` font size for textareas, `11px` for labels.
- Labels use uppercase + letter-spacing for visual hierarchy.
- Buttons use standard VS Code button styles. Secondary buttons (Copy) use `vscode-button-secondaryBackground`.
- Status line at the bottom: `12px`, muted opacity (`.7`), minimum height to prevent layout shift.

**VS Code CSS variables used:**
- `--vscode-font-family`
- `--vscode-foreground`
- `--vscode-sideBar-background`
- `--vscode-input-background`
- `--vscode-input-foreground`
- `--vscode-input-border`
- `--vscode-button-background`
- `--vscode-button-foreground`
- `--vscode-button-hoverBackground`
- `--vscode-button-secondaryBackground`
- `--vscode-button-secondaryForeground`

**Element IDs (webview):**
- `#input` — user's raw prompt textarea
- `#output` — improved prompt textarea (editable)
- `#improve` — "✨ Improve" button
- `#send` — "➤ Send to chat" button
- `#copy` — "Copy" secondary button
- `#status` — status text area

---

## 12. API Standards (VS Code Extension API)

This project uses the VS Code Extension API exclusively. There is no custom REST API, no database, no network server.

**Key VS Code APIs used:**

| API | Usage |
|-----|-------|
| `vscode.window.registerWebviewViewProvider` | Registers the sidebar panel |
| `vscode.commands.registerCommand` | Registers `promptImprover.focus` command |
| `vscode.commands.executeCommand` | Sends prompts to chat (`workbench.action.chat.open`, Cursor variants) |
| `vscode.commands.getCommands(true)` | Enumerates all available commands (Cursor detection) |
| `vscode.env.clipboard.writeText` | Copies text to system clipboard |
| `vscode.env.appName` | Detects Cursor vs. VS Code |
| `vscode.window.setStatusBarMessage` | Transient status bar messages |
| `vscode.window.showInformationMessage` | Persistent info notifications |
| `webview.postMessage` | Host → webview message |
| `webview.onDidReceiveMessage` | Webview → host message |
| `vscode.getState()` / `vscode.setState()` | Webview state persistence |

**Planned (M2) VS Code APIs:**
- `vscode.lm.selectChatModels()` — VS Code built-in LM API
- `vscode.SecretStorage` — for securely storing API keys

---

## 13. Build System

**Tool:** esbuild (not webpack, not tsc-only)

**npm scripts:**

| Script | Command | Use case |
|--------|---------|----------|
| `build` | `node esbuild.js` | One-shot development build |
| `watch` | `node esbuild.js --watch` | Development with auto-rebuild |
| `vscode:prepublish` | `node esbuild.js --production` | Production build for marketplace publishing |

**Build output:** `dist/extension.js` (single bundled CJS file)  
**Source map:** `dist/extension.js.map` (only in dev builds)

**Debug configuration (`.vscode/launch.json`):**
- Configuration name: "Run Extension"
- Type: `extensionHost`
- Runs `npm: build` as preLaunchTask before launching

**Important:** `vscode` is listed as `external` in esbuild — it is never bundled. All other imports are bundled inline.

**TypeScript is not used for type-checking during build** — esbuild only transpiles. Run `tsc --noEmit` separately if you need type-checking as part of CI.

---

## 14. Configuration & Settings

All settings are defined in `package.json` under `contributes.configuration` and readable via `vscode.workspace.getConfiguration("promptImprover")`.

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `promptImprover.provider` | string (enum) | `"auto"` | LLM provider. `"auto"` tries VS Code built-in first, then falls back to configured API. Options: `auto`, `vscode-lm`, `openai`, `anthropic`, `ollama` |
| `promptImprover.openai.model` | string | `"gpt-4o-mini"` | OpenAI model name |
| `promptImprover.openai.baseUrl` | string | `"https://api.openai.com/v1"` | OpenAI-compatible base URL. Set to `http://localhost:11434/v1` for Ollama |
| `promptImprover.anthropic.model` | string | `"claude-3-5-haiku-latest"` | Anthropic model name |

**No Ollama-specific settings** — Ollama is handled via `openai` provider with `baseUrl` override.

**API keys:** Declared (command `promptImprover.setApiKey`) but not yet implemented. Will use `vscode.ExtensionContext.secrets` (VS Code Secret Storage) in M2.

**Environment variables:** None. Configuration is entirely through VS Code settings. No `.env` files.

---

## 15. Permission System & Security Model

**No user authentication or authorization.** The extension runs as the local developer.

**Webview sandboxing:**
- Content Security Policy disables all external network access from the webview.
- No `allow-same-origin` in the webview sandbox — `vscode.getState()` is the safe state bridge.
- Scripts require a per-session nonce: `Math.random().toString(36).slice(2)`.

**API keys (M2):** Will be stored in `vscode.ExtensionContext.secrets` — VS Code's encrypted secret storage backed by the OS keychain. Never store API keys in settings (`workspace.getConfiguration`) as those are plaintext in `settings.json`.

**No file system access** from the webview. All FS operations go through the extension host.

**No network calls from the webview** — all LLM API calls will be made from the extension host (Node.js side), not from browser-side JS in the webview. This is both a security and CSP requirement.

---

## 16. Business Rules

These rules are derived directly from the codebase. None are inferred without evidence.

1. **Improve only rewrites — never executes.** The SYSTEM_PROMPT explicitly states: "NEVER answer or execute the prompt. Only rewrite it." This is the core invariant of the product.

2. **Language preservation.** The improved prompt must be in the same language as the draft. The SYSTEM_PROMPT mandates: "Preserve the user's intent and their language (reply in the same language as the draft)." This is a hard rule.

3. **No invented requirements.** The LLM must not add requirements the user hasn't asked for. If an assumption is made, it must be labelled "Assumption:".

4. **Code/path/identifier fidelity.** All code snippets, file paths, and identifiers in the original prompt must be reproduced exactly. The LLM must not rename, refactor, or reformat them.

5. **Send to chat uses the output, falling back to the input.** The "Send to chat" and "Copy" buttons send `output.value || input.value` — if the user hasn't run improve, they can still send the raw prompt directly.

6. **Empty input is blocked at the UI level.** The "Improve" button checks `if (!prompt) return;` before sending to the host. Zero-length or whitespace-only prompts are silently ignored.

7. **State persists across panel hide/show cycles.** Both textareas restore their content via `vscode.getState()` on every mount. This compensates for `retainContextWhenHidden: false`.

8. **Cursor gets an extra clipboard copy.** On Cursor, after executing the chat command, the prompt is also written to the clipboard. The rationale: Cursor's chat commands may not pre-fill the text input, so the user may need to paste manually.

9. **No preset UI in M1.** Even though four presets are defined in `improvementEngine.ts`, the webview has no UI to select them. The stub improvement ignores presets entirely.

---

## 17. Data Flow

### Improve Flow (M1 — stub)

```
[Webview] User types in #input
     │
     ▼
[Webview] Clicks Improve button
     │  postMessage({ type: "improve", prompt })
     ▼
[Extension Host] PromptPanelProvider.onDidReceiveMessage
     │  stubImprove(prompt)
     ▼
[Extension Host] postMessage({ type: "result", improved })
     │
     ▼
[Webview] Sets #output.value = improved; saves state
```

### Improve Flow (M2 — planned)

```
[Webview] User types in #input, selects a preset
     │  postMessage({ type: "improve", prompt, preset })
     ▼
[Extension Host] PromptPanelProvider.onDidReceiveMessage
     │
     ├── LlmService.call(SYSTEM_PROMPT, buildUserMessage(draft, preset))
     │       │
     │       └── [External: OpenAI / Anthropic / Ollama / vscode.lm API]
     │
     ▼
[Extension Host] postMessage({ type: "result", improved })
     │
     ▼
[Webview] Sets #output.value = improved
```

### Send to Chat Flow

```
[Webview] Clicks Send to chat
     │  postMessage({ type: "send", prompt: output || input })
     ▼
[Extension Host] sendToChat(prompt) — chatHandoff.ts
     │
     ├── VS Code path: executeCommand("workbench.action.chat.open", prompt)
     │
     └── Cursor path: getCommands() → try candidates → clipboard copy
                  └── fallback: clipboard + showInformationMessage
```

### Copy Flow

```
[Webview] Clicks Copy
     │  postMessage({ type: "copy", prompt: output || input })
     ▼
[Extension Host] vscode.env.clipboard.writeText(prompt)
     │           vscode.window.setStatusBarMessage("Prompt copied", 2000)
     ▼
[Done]
```

---

## 18. Feature Map

| Feature | Status | Files Involved |
|---------|--------|---------------|
| Sidebar panel (WebviewView) | Implemented | `extension.ts`, `PromptPanelProvider.ts` |
| Raw prompt input textarea | Implemented | `PromptPanelProvider.ts` (HTML) |
| Stub improvement (M1) | Implemented | `PromptPanelProvider.ts` (`stubImprove`) |
| Output textarea (editable) | Implemented | `PromptPanelProvider.ts` (HTML) |
| Send to Copilot Chat | Implemented | `chatHandoff.ts` |
| Send to Cursor Composer | Implemented | `chatHandoff.ts` |
| Copy to clipboard | Implemented | `PromptPanelProvider.ts` |
| Panel state persistence | Implemented | `PromptPanelProvider.ts` (webview JS) |
| Keyboard shortcut (Ctrl+Alt+P) | Implemented | `package.json` |
| Improvement presets (4 modes) | Defined, not wired | `core/improvementEngine.ts` |
| System prompt for LLM | Defined, not wired | `core/improvementEngine.ts` |
| Real LLM calls | Not implemented | `llm/LlmService.ts` (empty) |
| API key storage | Not implemented | `package.json` (command declared only) |
| Provider selection (settings) | Not implemented | `package.json` (settings declared only) |

---

## 19. Important Entities

### Prompt (primary domain object)

- **Purpose:** The text the developer wants to send to an AI coding assistant.
- **Lifecycle:** Draft → Improved → Sent/Copied.
- **States:** Raw (user-authored), Improved (LLM-rewritten or stub-structured), Dispatched (sent to chat).
- **Constraints:** Must be non-empty to trigger improvement. Preserved as-is if improvement is skipped.
- **Persistence:** Stored in webview state (`vscode.getState()`). Not persisted to disk. Lost when VS Code window closes.

### Preset (improvement mode)

- **Purpose:** Governs how the LLM rewrites the prompt (structured, specific, shorter, or with constraints).
- **Lifecycle:** Selected by user → passed to `buildUserMessage()` → included in LLM request.
- **Status:** Defined but not yet exposed in the UI.

### LLM Provider (configuration entity)

- **Purpose:** Determines which AI service processes the improvement.
- **Values:** `auto`, `vscode-lm`, `openai`, `anthropic`, `ollama`.
- **Currently:** Not used in any code path (all code paths use the stub).

---

## 20. Common Patterns

### Webview Message Pattern

All host/webview communication follows a strict pattern:

**Webview to Host:**
```js
vscode.postMessage({ type: "improve", prompt: "..." });
```

**Host to Webview:**
```ts
view.webview.postMessage({ type: "result", improved: "..." });
```

**Webview receives:**
```js
window.addEventListener("message", (e) => {
  if (e.data.type === "result") { /* handle */ }
});
```

Always use a `type` discriminant field. Never send raw strings.

### Graceful Fallback Pattern

Used consistently in `chatHandoff.ts`:
1. Try the preferred path.
2. On any error, catch silently and fall through.
3. Universal fallback: clipboard + user-visible message.

This pattern must be preserved for all VS Code command integrations.

### Nonce Pattern (CSP)

```ts
const nonce = Math.random().toString(36).slice(2);
// Used in CSP meta tag: script-src 'nonce-${nonce}'
// And on script tag: <script nonce="${nonce}">
```

Every time the webview is rendered, a fresh nonce is generated. Always include the nonce on inline scripts.

---

## 21. Existing Design Decisions

| Decision | Rationale | Implication |
|----------|-----------|-------------|
| Inline HTML/CSS/JS in TypeScript string | Keeps the extension as a single compiled bundle; avoids asset loading complexity | Editing the UI requires editing a string literal in a `.ts` file; difficult to format/lint separately |
| No runtime npm dependencies | Minimizes extension install size and load time | All external SDKs (openai, anthropic) must be added carefully in M2 and bundled via esbuild |
| `retainContextWhenHidden: false` | Saves memory — webview is destroyed when the panel is hidden | State must always be saved/restored via `vscode.setState()` / `vscode.getState()` |
| esbuild over tsc | Much faster builds; single output bundle | TypeScript type-checking is NOT part of the build — must run `tsc --noEmit` separately |
| Cursor fallback via command enumeration | Cursor has no stable public API for opening chat | Brittle — must be kept up to date as Cursor evolves its command IDs |
| Stub first (M1) | Allows full UX testing without LLM API keys | `stubImprove` must be completely replaced in M2, not supplemented |
| `vscode-lm` as `"auto"` first priority | Avoids requiring API keys for users who already have Copilot | Means behavior differs based on which VS Code extensions are installed |

---

## 22. Performance Considerations

- The extension has no activation delay in the current setup, but a proper `activationEvents` entry (e.g., `onView:promptImprover.panel`) is missing — see Technical Debt.
- **No background processes** in M1.
- **Webview is destroyed when hidden** — memory is freed when the user switches panels.
- State save (`vscode.setState`) is called on every keystroke (`"input"` event). This is cheap — it is an in-memory operation, not disk I/O.
- In M2, LLM streaming should be implemented to avoid the user waiting for the full response before seeing output.

---

## 23. Security Rules

1. **Never store API keys in `settings.json`** — use `context.secrets` (VS Code Secret Storage).
2. **Never allow external `src` in webview CSP** — the CSP is deliberately strict. Do not loosen it.
3. **Never allow `allow-same-origin`** in the webview — it would allow access to the extension's Node.js context from the webview.
4. **All LLM API calls must happen in the extension host**, not in the webview browser context, to prevent API key leakage.
5. **The nonce must be regenerated** on every webview render. Never reuse or hardcode it.
6. **Sanitize any user content** before inserting it into HTML. Currently user content goes into `textarea.value`, not `innerHTML`, which is safe. Be careful when adding features that render user text as HTML.

---

## 24. Technical Debt & Known Issues

| Issue | Severity | Location | Notes |
|-------|----------|----------|-------|
| `LlmService.ts` is empty | High | `src/llm/LlmService.ts` | Core M2 feature. The file exists as a placeholder only. |
| Preset UI missing | High | `PromptPanelProvider.ts` | 4 presets defined in `improvementEngine.ts` but no UI to select them. |
| `improvementEngine.ts` not imported anywhere | High | `src/core/improvementEngine.ts` | All exports are dead code in M1. |
| `promptImprover.setApiKey` command not registered | High | `extension.ts` | Declared in `package.json` but has no handler. Will error if clicked. |
| Settings declared but not read | High | `package.json`, `src/` | Provider settings exist but no code reads `vscode.workspace.getConfiguration`. |
| No `activationEvents` in `package.json` | Medium | `package.json` | Missing `"activationEvents": ["onView:promptImprover.panel"]`. Without it, VS Code may use eager activation. |
| Stub hardcodes English output structure | Medium | `PromptPanelProvider.ts` | `stubImprove` outputs English headings regardless of user's language, violating the language-preservation business rule. |
| Cursor command IDs are hardcoded | Medium | `chatHandoff.ts` | The three Cursor candidate command IDs may change as Cursor updates. No version check. |
| No error feedback to the user on improve failure | Medium | `PromptPanelProvider.ts` | The `case "improve"` block has no `try/catch`. If M2 introduces async LLM calls, unhandled rejections can crash silently. |
| No loading/streaming state | Low | `PromptPanelProvider.ts` | Status line shows "Improving…" but is immediately cleared. No spinner or progress. |
| `dist/` is committed to source control | Low | `dist/` | Built artifacts are in the repo. Common VS Code convention but can cause merge conflicts. |
| TypeScript type-checking not in build pipeline | Low | `esbuild.js` | esbuild only transpiles, not type-checks. A CI step for `tsc --noEmit` is missing. |
| No tests | Low | (none) | Zero test files. The design was intended to be testable but no tests were written. |

---

## 25. Future Improvement Opportunities

1. **Implement `LlmService.ts`** — wire up `vscode-lm`, OpenAI, Anthropic, and Ollama providers with streaming support.
2. **Add preset selector to UI** — a dropdown or segmented button to choose between the 4 presets.
3. **Implement `promptImprover.setApiKey` command** — use `context.secrets` for storage.
4. **Add `activationEvents`** to `package.json` to avoid eager extension activation.
5. **Add streaming output** — stream LLM tokens into `#output` as they arrive for better UX.
6. **Extract webview HTML** — move the inline HTML to a separate `.html` file loaded via `vscode.Uri` for better maintainability.
7. **Add history** — store recent prompts (improved + original pairs) in `context.globalState`.
8. **Add token count estimate** — show approximate token count for the output prompt.
9. **Add diff view** — show what changed between input and output.
10. **Add CI pipeline** — `tsc --noEmit` for type-checking, plus tests using VS Code Extension Test Runner.
11. **Internationalize messages** — the hardcoded English strings in `stubImprove` and status messages violate the language-preservation rule.
12. **Cursor command robustness** — consider a settings escape hatch or periodic check for Cursor command IDs.

---

## 26. Do's

- Always use VS Code CSS variables in the webview — never hardcode colors.
- Always generate a fresh nonce per webview render.
- Always provide a clipboard fallback for any "send to chat" action.
- Always save webview state in both `input` and `output` on any change.
- Always use `async/await` for async operations.
- Always handle errors in chat handoff with graceful fallback.
- Always externalize `vscode` from the esbuild bundle.
- Always use `context.secrets` for API keys (when implementing M2).
- Always use the `type` discriminant in postMessage payloads.
- Preserve user language in any LLM prompt instructions.
- Mark LLM assumptions explicitly with "Assumption:" in the output.
- Keep code snippets, file paths, and identifiers exactly as written by the user.

---

## 27. Don'ts

- Do NOT store API keys in VS Code settings (`settings.json` is plaintext).
- Do NOT add `allow-same-origin` to the webview sandbox.
- Do NOT make network calls from the webview browser context — all calls go through the extension host.
- Do NOT reuse or hardcode the nonce.
- Do NOT loosen the Content Security Policy.
- Do NOT use `innerHTML` with user content — use `textContent` or `value`.
- Do NOT bundle `vscode` into the output — it must remain `external` in esbuild.
- Do NOT import `LlmService.ts` until it has actual implementation — it exports nothing.
- Do NOT answer or execute the user's draft prompt — only rewrite it (core product rule).
- Do NOT invent requirements the user did not ask for.
- Do NOT add runtime npm dependencies without strong justification.
- Do NOT use `console.log` for production logging — use VS Code output channels.
- Do NOT assume VS Code and Cursor have the same command IDs — always branch on `vscode.env.appName`.

---

## 28. Common Mistakes to Avoid

1. **Forgetting to restore state on webview mount** — The webview is destroyed when hidden. Always call `vscode.getState()` and restore `input`/`output` on startup.
2. **Adding new message types without updating the `WebviewMsg` union** — The discriminated union in `PromptPanelProvider.ts` must be kept in sync with any new `postMessage` calls from the webview.
3. **Treating `stubImprove` as the final behavior** — It is M1 placeholder. Do not extend or refactor it; replace it entirely in M2.
4. **Forgetting that `improvementEngine.ts` is not yet wired** — Adding a call to `buildUserMessage` without also implementing `LlmService` will do nothing useful.
5. **Not testing on both VS Code and Cursor** — `chatHandoff.ts` has completely different code paths for each. A change that works on VS Code may break on Cursor.
6. **Committing secrets or keys** — No secrets should ever be hardcoded in source code or configuration.
7. **Forgetting to run `npm run build` before testing** — The extension loads from `dist/extension.js`, not directly from `src/`. Source changes require a rebuild.
8. **Misusing Node16 module resolution** — The `"module": "Node16"` setting may require explicit file extensions in relative imports.

---

## 29. Areas Requiring Extra Caution

| Area | Why Caution is Needed |
|------|-----------------------|
| `chatHandoff.ts` | Tightly coupled to Cursor's undocumented internals. Any change must be tested against both VS Code and Cursor. The command ID list for Cursor may go stale. |
| `PromptPanelProvider.ts` HTML template | Inline HTML/CSS/JS in a TS string is hard to lint. Syntax errors in the HTML are not caught by the TypeScript compiler. |
| Webview CSP | Loosening it creates security vulnerabilities. Tightening it can break the webview silently. |
| `LlmService.ts` implementation (M2) | Must handle provider selection, streaming, error states, and API key retrieval from `context.secrets`. High complexity. |
| `package.json` contributions | All VS Code contribution points (commands, views, settings) must have matching runtime implementations. Mismatch causes visible errors for users. |
| State persistence | Both textareas must always be saved together. Saving only one causes inconsistent restore behavior. |

---

## 30. Checklists

### Before Changing Any Code

- [ ] Have you read this guide in full?
- [ ] Do you understand which milestone (M1/M2) the affected code belongs to?
- [ ] Have you read all files touched by your change?
- [ ] Is the change consistent with existing patterns (message types, nonce, fallback)?
- [ ] Does the change respect the CSP?

### Before Creating New Features

- [ ] Is the feature part of M1 or M2 scope?
- [ ] Does a new webview message type need to be added to the `WebviewMsg` union?
- [ ] Does a new VS Code command need to be registered in both `package.json` AND `extension.ts`?
- [ ] Does the feature need API keys? If so, use `context.secrets`, not settings.
- [ ] Does the feature make network calls? If so, call from extension host, not webview.
- [ ] Will the feature work on both VS Code and Cursor?
- [ ] Does the feature preserve user language?
- [ ] Is webview state saving updated to include any new fields?

### Before Editing Existing Features

- [ ] Is the code you are editing a stub (M1) or a real implementation?
- [ ] Will your change break the clipboard fallback?
- [ ] Will your change affect the CSP nonce behavior?
- [ ] Is the `WebviewMsg` discriminated union still exhaustive after your change?
- [ ] Did you run `npm run build` to verify the bundle compiles?

### Before Editing the Build System

- [ ] Is `vscode` still marked as `external`?
- [ ] Are sourcemaps still generated in dev mode and suppressed in production?
- [ ] Does `--production` still minify correctly?
- [ ] Did you verify the output path (`dist/extension.js`) is unchanged?

### Before Editing `package.json`

- [ ] Every declared command has a matching `registerCommand` call in `extension.ts`.
- [ ] Every declared setting key matches what the code reads via `getConfiguration`.
- [ ] The view ID in `contributes.views` matches `PromptPanelProvider.viewId`.
- [ ] The keybinding command ID matches a registered or built-in VS Code command.

### Before Editing the Webview UI

- [ ] Are all colors using VS Code CSS variables?
- [ ] Is the nonce applied to all inline `<script>` tags?
- [ ] Is new state being saved in `vscode.setState()` and restored in `vscode.getState()`?
- [ ] Are any new `postMessage` calls reflected in the host's `onDidReceiveMessage` handler?
- [ ] Is the CSP still correct for any new content types?

---

## 31. AI Agent Instructions

Read this section before making any change to this repository.

### Understand Before Acting

1. **Read `AGENT_GUIDE.md` first.** It is the authoritative reference for architecture and conventions.
2. **Identify the milestone** of the code you are touching. M1 stubs should be replaced in M2, not evolved.
3. **Read every file you intend to touch** before writing a single line.
4. **Check `improvementEngine.ts`** before adding any LLM-related logic — the presets and system prompt are already defined there. Do not recreate them.

### Feature Development Rules

5. **Never duplicate the improvement logic.** `PRESETS`, `SYSTEM_PROMPT`, and `buildUserMessage` are the canonical definitions. Do not recreate them elsewhere.
6. **Never bypass the stub in M1.** The stub is intentional. If you are implementing M2, replace it entirely via `LlmService`.
7. **Always implement both the `package.json` contribution AND the runtime handler** when adding a new command or setting. Half-implemented contributions cause user-visible errors.
8. **Always wire the extension host side before the webview side.** The host handles the logic; the webview only displays it.
9. **Check the Feature Map (Section 18) before implementing anything** — verify that it is not already partially implemented somewhere.

### Security and Stability

10. **Never store secrets in settings.** Use `context.secrets` for any API key storage.
11. **Never make network calls from webview JS.** Route them through the extension host via `postMessage`.
12. **Never loosen the CSP.** If a feature seems to require it, redesign the feature.
13. **Always test on both VS Code and Cursor.** The `chatHandoff.ts` code has fundamentally different paths for each.

### Code Quality

14. **Respect the discriminated union.** The `WebviewMsg` type in `PromptPanelProvider.ts` must be kept exhaustive. Add new message types to the union before using them.
15. **Use `async/await` with proper `try/catch`.** Never leave async paths without error handling, especially in `onDidReceiveMessage`.
16. **Do not break state persistence.** Any new UI field that needs to survive hide/show must be added to both `vscode.setState()` and `vscode.getState()` restoration.
17. **Run the build before testing.** Changes to `src/` are not reflected until `npm run build` regenerates `dist/extension.js`.

### Architecture Consistency

18. **Keep the single-bundle architecture.** All TypeScript in `src/` compiles to one `dist/extension.js`. Do not introduce dynamic requires, lazy imports, or worker threads without careful consideration.
19. **Keep domain logic in `core/`.** New prompt engineering logic (presets, templates, heuristics) belongs in `src/core/`, not in `PromptPanelProvider.ts`.
20. **Keep the LLM abstraction in `llm/`.** All provider-specific code belongs in `src/llm/LlmService.ts`. `PromptPanelProvider.ts` should call a clean interface, not know about specific providers.
21. **Keep `chatHandoff.ts` for dispatch only.** It should not contain improvement logic. Improvement logic belongs in `core/` and `llm/`.

### Documentation

22. **Update `AGENT_GUIDE.md`** whenever you make an architectural change, add a new file, change the build system, or implement a new M2 feature.
23. **Comment stubs clearly.** If you add a placeholder, mark it with `// M<N> stub — <what replaces it>`.
24. **Update the Feature Map table (Section 18)** when a feature changes status.

---

*Last updated: 2026-08-07 — Reflects the state of the repository at milestone M1 (stub-based improvement, no LLM integration). Generated by full reverse-engineering of all source files in `e:\Programming\Prompt Optimsor\`.*
