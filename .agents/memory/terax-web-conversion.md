---
name: Terax Tauri→web conversion
description: How the Terax desktop app runs as a multi-user web app on Replit — backend/shim architecture, isolation model, and the deliberate non-fixes.
---

# Terax: Tauri desktop → multi-user web app

The Rust/Tauri backend was replaced by a Node backend (`server/`, Express + ws +
node-pty) and every `@tauri-apps/*` module was replaced by a browser shim in
`src/shims/`, wired via Vite aliases + an `/api` & `/ws` proxy. Dev runs backend on
3001 + Vite on 5000; prod runs the Node server alone on 5000 serving `dist/`.

## Shared single-workspace model (important — NOT per-user isolation)
**Everyone shares ONE workspace.** The user explicitly chose this: all visitors
see/edit the same files, no per-user isolation. `ensureSessionDirs` returns a single
`SHARED_DIR` (`data/shared/{workspace,stores,secrets.json}`) for every `sid`, so two
different `terax_sid` cookies resolve to the same home/files. (An earlier per-`sid`
design under `data/sessions/<sid>/…` was replaced.)

All users also share ONE container, ONE OS user, ONE filesystem. The terminal is a
*real* bash shell (a product requirement), so any user can reach the whole container.
Security work is defense-in-depth on the GUI/API surface, not a hard sandbox:
- FS *invoke* commands (explorer/editor) are confined to the shared workspace with
  **realpath-based** canonicalization (walks up to nearest existing ancestor, then
  realpaths) so symlinks created from the terminal cannot escape via the GUI.
- Background jobs/shell sessions are still scoped by `sid` so a user's `bg_list/logs/
  kill` only touches their own jobs — but the *files* they act on are shared.
- PTY `cwd` is clamped via `safeCwd()` (`path.resolve` + separator-boundary check;
  lexical `startsWith` was bypassable with `..`).

**Why:** the product wants a single shared workspace AND real shells. We secure the
API surface; the terminal itself is full container access by design.

## Terminal shell integration (cwd + prompt)
The app tracks cwd via **OSC 7** and prompt start via **OSC 133;A**
(`src/modules/terminal/lib/osc-handlers.ts`); without them the status bar shows
"no directory" and the prompt looks blank.
**Interactive bash IGNORES `PS1`/`PROMPT_COMMAND` passed via the environment** — even
with `--norc`. Setting them in env produces an empty prompt and no OSC output.
**Fix:** spawn `bash --rcfile server/shell-integration.bash -i`; the rcfile sources the
user's bashrc then sets `PS1` (with OSC 133;A) + `PROMPT_COMMAND` (OSC 7). Verified the
prompt renders and both OSC sequences fire through the WS proxy.

## Deliberate non-fixes (do NOT "fix" these without checking)
- **AI/network proxy SSRF is intentionally NOT restricted.** `net.aiHttpStream` /
  `aiHttpRequest` / `lmPing` accept arbitrary URLs *because* the feature's purpose is
  reaching local model servers (LM Studio / Ollama on localhost). Blocking
  localhost/private CIDRs would break the feature.
- The "Terax vX available" updater dialog and the WebGL-unavailable warning are
  harmless desktop-app artifacts (canvas fallback handles WebGL). Not in scope.

## Express 5 SPA fallback gotcha
This project's Express is v5 (path-to-regexp v8): `app.get('*', ...)` throws. Serve the
SPA fallback with a **final middleware** that skips `/api` and `/ws` and `sendFile`s
`dist/index.html` instead of a wildcard route.

## Deployment
Configured as `vm` (needs persistent disk for `data/` and in-memory PTY/job state).
build = `pnpm run build` (vite only; tsc is not in the build), run = `npm run start`
(`NODE_ENV=production node server/index.mjs`). Secure session cookie + `trust proxy`
are enabled in production for Replit's TLS-terminating proxy.
