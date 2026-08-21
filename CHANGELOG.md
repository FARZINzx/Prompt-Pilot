# Changelog

All notable changes to the **PromptPilot** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.2] - 2026-08-21

### Added
- New professional extension icon (`market.jpg`) and sidebar activity bar icon (`sidebar.jpg`).
- Added screenshot preview to `README.md`.
- Added `CHANGELOG.md`.

### Changed
- Switched free proxy backend from Groq to Cloudflare Workers AI (`@cf/meta/llama-3.2-3b-instruct`) for 100% availability with zero external API keys and zero geo-blocking.

---

## [0.1.1] - 2026-08-21

### Added
- Added custom activity bar icon.
- Added MIT License file (`LICENSE.txt`).

---

## [0.1.0] - 2026-08-21

### Added
- Initial release of **PromptPilot**.
- 4 improvement presets: **Structure as task**, **More specific**, **Shorter**, **Add constraints**.
- 3-tier LLM engine fallback:
  1. VS Code Built-in Language Model API (`vscode.lm`).
  2. User's custom API Key (OpenAI, Anthropic, Groq, Ollama, Custom endpoint).
  3. Free hosted proxy (30 improvements/day).
- One-click **Send to chat** support for **VS Code Copilot Chat**, **Cursor Composer**, and **Windsurf Cascade**.
- Options for automatically appending **Implementation Plan** and **Git Commit** requirements.
- Secure key storage via VS Code `SecretStorage`.
- Keyboard shortcut `Ctrl+Alt+P` / `Cmd+Alt+P`.
