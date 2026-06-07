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

## Terminal arcade (mini-games) — runs inside the real PTY
Games (snake/2048/minesweeper/dungeon) are standalone Node ESM TUIs in
`server/games/`, launched from the bash shell via aliases in
`shell-integration.bash` (guarded by `[ -n "$TERAX_GAMES_DIR" ]`). `pty.mjs` injects
`TERAX_GAMES_DIR`/`TERAX_GAMES_DATA`/`TERAX_NODE` into the PTY env. The leaderboard is
SHARED (writes to `storesDir`, the shared stores dir) so all visitors compete.
- **`2048` MUST be a bash `alias`, not a function** — `2048` is an invalid function
  identifier; aliases allow digit-leading names (and only expand interactively).
- **PTY stdin can fragment escape sequences** (ESC then `[A` in separate WS frames).
  Decode with a buffered parser that holds an incomplete sequence and a ~50ms flush
  timer for a lone ESC, else a split arrow key reads as Escape→quit. (`games/lib/term.mjs`)
- Shared JSON files written by games/auth use temp-file + `rename` for atomicity;
  the read-modify-write race (lost update under exact concurrency) is accepted, low volume.

## Authentication (email/password) — gates entry, workspace still shared
Custom email+password auth in `server/auth.mjs` (scrypt hash, JSON user+session store,
30-day tokens, timing-safe compare). Login GATES access only — the workspace stays the
single shared one (per the model above); auth adds NO per-user isolation.
- Route order in `index.mjs` matters: define public `/api/auth/*` BEFORE
  `app.use('/api', authGate)`, or the gate 401s the login/signup calls themselves.
- The **PTY WS must be gated independently** of HTTP — `pty.mjs` rejects upgrades
  without a valid `terax_auth` cookie, else terminal access bypasses the HTTP gate.
- Frontend gate: `src/auth/AuthGate.tsx` wraps `<App/>` in `main.tsx`, checks
  `/api/auth/me`, exposes `useAuth()` (email + signOut). Sign-out lives in the Header.
- WS Origin check is **prod-only**: the dev Vite proxy rewrites Host so an
  Origin==Host check would reject legit dev connections (`originAllowed` in pty.mjs).

## Settings window on web
`open_settings_window` was broken on web (no invoke handler → 400). Fixed in the
`tauri-core.ts` shim by `window.open('/settings.html?tab=…','terax-settings')`.
`settings.html` is already a Vite MPA entry; cross-window pref sync works because the
event shim (`tauri-event.ts`) is built on `BroadcastChannel`. Do `window.open`
synchronously inside the invoke case (before any await) so it isn't popup-blocked.

## Terminal tools (editor + web browser) — sanitize untrusted content
`edit <file>` (nano-style editor) and `browse <url>`/`web` (text web browser) are
Node ESM TUIs in `server/tools/`, launched from bash via aliases (guarded by
`[ -n "$TERAX_TOOLS_DIR" ]`). `pty.mjs` injects `TERAX_TOOLS_DIR`. They reuse
`server/games/lib/term.mjs`. `commands`/`cmds` print the full command list.
- **`term.mjs` has two input modes.** `createScreen({mode:"text"})` preserves case
  and emits `ctrl-<x>`/`tab`/`home`/`end`/`page*`/`delete`; default `"game"` mode
  lowercases letters (games depend on this). Don't remove the mode split.
- **Any untrusted content written to a PTY must be run through `sanitizeText()`**
  first — a remote page or opened file can contain ESC/CSI/OSC sequences (or encode
  them via `&#27;`) that spoof or hijack the terminal. Sanitize AFTER HTML-entity
  decoding, not before. Editor sanitizes file content on load (keeps tabs/newlines).
- **Guard `String.fromCodePoint`** when decoding numeric HTML entities (range-check
  0..0x10FFFF + try/catch) or a malformed `&#…;` throws and aborts the whole page.
- Editor keeps real tabs in the buffer (so Makefiles survive) but expands them for
  display and does tab-aware cursor/scroll math (`dispCol`/`expandTabs`, TABW=8).

## Optional auth + user profiles
Login is OPTIONAL by default — guests use the shared app freely. `authGate`
(server/auth.mjs) only 401s when `REQUIRE_AUTH` (env `TERAX_REQUIRE_AUTH=1/true`)
is set; otherwise it sets `req.userEmail=null` and passes through. `pty.mjs` WS and
all `/api/*` routes follow the same flag. `/api/auth/me` always 200s with
`{email|null, requireAuth, profile}`. Frontend `AuthGate` only blocks full-screen
when `requireAuth && !email`; otherwise the login screen is a dismissible modal
opened via `useAuth().signIn`.
- **`useAuth()` email is `string | null`** now (was always-string). Any consumer
  must handle the guest/null case (Header shows a "Sign in" button vs an avatar menu).
- **Profiles live on the auth user record** (server/auth.mjs): `id` (stable random,
  used for public refs + avatar URLs), `displayName`, `bio`, `avatarColor`,
  `avatarExt`/`avatarUpdatedAt`. `migrateProfiles()` backfills these (incl. ids) for
  pre-existing accounts at module load — don't generate ids per-read or avatar URLs churn.
- **Avatars are files**, not data URLs in JSON: stored under `data/auth/avatars/<id>.<ext>`,
  uploaded as a base64 data URL (validated to png/jpeg/webp/gif, ≤2MB), served at
  `/api/profile/avatar/:id` (cache-busted with `?v=avatarUpdatedAt`). Public profiles
  never expose email; the `/api/users` directory returns display name/bio/avatar only.
- **Games leaderboard names come from the profile**: `pty.mjs` injects
  `TERAX_USER_NAME` (the display name) for logged-in sessions; `games/lib/ui.mjs`
  auto-saves under it (no initials prompt), guests still type 3-letter initials.
  `scores.mjs` now keeps sanitized names up to 16 chars (dropped the 3-char-uppercase rule).

## Terminal preferences (color themes + font family)
Terminal appearance is driven entirely by the prefs store, not hardcoded. Two
prefs: `terminalTheme` (named color scheme) and `terminalFontFamily`. The
`"default"` theme is special — `buildTerminalTheme(themeId)` reads live globals.css
app tokens for it (so it follows the app light/dark theme), but returns a FIXED
self-contained palette for every other named scheme. Likewise `terminalFontFamily`
`"auto"` defers to `detectMonoFontFamily()` Nerd-Font detection; other ids map to
fixed CSS font stacks via `resolveTerminalFontFamily(id)`.
- **Adding a new pref requires touching ~6 spots in `store.ts`**: Preferences type,
  a `KEY_*` const, DEFAULT_PREFERENCES, the loadPreferences `get<>()` line, a
  `set<Name>()` writer (via `writePref`), and the `onPreferencesChange` key→prefKey
  map. Miss the last one and cross-window settings changes silently won't propagate.
- **Apply pref changes to ALL live xterm sessions** by mirroring the existing
  fontSize effect in `useTerminalSession.ts` (one effect per pref, keyed on leafId):
  set `term.options.theme`/`term.options.fontFamily` then `fitAddon.fit()` on font
  change. The `applyTheme()` callback (called on app theme switch) must re-read the
  current `terminalTheme` pref so the "default" scheme tracks light/dark.
