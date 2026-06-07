---
name: Terax Tauri→web conversion
description: How the Terax desktop app runs as a multi-user web app on Replit — backend/shim architecture, isolation model, and the deliberate non-fixes.
---

# Terax: Tauri desktop → multi-user web app

The Rust/Tauri backend was replaced by a Node backend (`server/`, Express + ws +
node-pty) and every `@tauri-apps/*` module was replaced by a browser shim in
`src/shims/`, wired via Vite aliases + an `/api` & `/ws` proxy. Dev runs backend on
3001 + Vite on 5000; prod runs the Node server alone on 5000 serving `dist/`.

## Single-container isolation model (important constraint)
All users share ONE container, ONE OS user, ONE filesystem. Per-user state lives under
`data/sessions/<sid>/{workspace,stores,secrets.json}`, keyed by the `terax_sid` cookie.
**True OS-level isolation between users is not achievable here** — the terminal is a
*real* bash shell (a product requirement), so a terminal user can reach the whole
container regardless of guards. Therefore the security work is defense-in-depth, not a
hard sandbox:
- FS *invoke* commands (explorer/editor) are confined to the session workspace with
  **realpath-based** canonicalization (walks up to nearest existing ancestor, then
  realpaths) so symlinks created from the terminal cannot escape via the GUI.
- Shell sessions and background jobs are **scoped by `sid`** — `bg_list/logs/kill` only
  touch the caller's own jobs (previously a global map leaked all users' jobs).
- PTY `cwd` is clamped via `path.resolve` + separator-boundary check (lexical
  `startsWith` was bypassable with `..`).

**Why:** the product wants real shells AND multi-user. On a shared container those
goals partially conflict; we secure the API surface and per-user data, and accept that
the terminal itself is full container access.

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
