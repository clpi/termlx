import http from "node:http";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./session.mjs";
import * as auth from "./auth.mjs";
import * as fsops from "./fsops.mjs";
import * as shell from "./shell.mjs";
import * as secrets from "./secrets.mjs";
import * as store from "./store.mjs";
import * as net from "./net.mjs";
import { attachPtyServer } from "./pty.mjs";

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || process.env.BACKEND_PORT || (IS_PROD ? 5000 : 3001);
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32mb" }));
app.use(cookieParser());
app.use("/api", sessionMiddleware);

// --- authentication (public: signup / login / logout / me) ---
app.post("/api/auth/signup", auth.rateLimit(), (req, res) => {
  try {
    const email = auth.signup(req.body?.email, req.body?.password);
    const token = auth.login(email, req.body?.password);
    res.cookie(auth.AUTH_COOKIE, token, auth.cookieOptions());
    res.json({ ok: true, email });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});
app.post("/api/auth/login", auth.rateLimit(), (req, res) => {
  try {
    const token = auth.login(req.body?.email, req.body?.password);
    res.cookie(auth.AUTH_COOKIE, token, auth.cookieOptions());
    res.json({ ok: true, email: String(req.body?.email).trim().toLowerCase() });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});
app.post("/api/auth/logout", (req, res) => {
  auth.logout(req.cookies?.[auth.AUTH_COOKIE]);
  res.clearCookie(auth.AUTH_COOKIE, { path: "/" });
  res.json({ ok: true });
});
app.get("/api/auth/me", (req, res) => {
  const email = auth.userFromToken(req.cookies?.[auth.AUTH_COOKIE]);
  res.json({
    ok: true,
    email: email || null,
    requireAuth: auth.REQUIRE_AUTH,
    profile: email ? auth.getProfile(email) : null,
  });
});

// Login is optional: guests pass through (req.userEmail = null) unless
// TERAX_REQUIRE_AUTH is set. authGate sets req.userEmail for downstream routes.
app.use("/api", auth.authGate);

app.get("/api/session", (req, res) => {
  res.json({ home: req.session.workspace, platform: "linux", name: "Terax" });
});

// --- user profiles -------------------------------------------------------
function requireUser(req, res) {
  if (!req.userEmail) {
    res.status(401).json({ ok: false, error: "Sign in to manage your profile" });
    return null;
  }
  return req.userEmail;
}

app.get("/api/profile/me", (req, res) => {
  res.json({ ok: true, profile: req.userEmail ? auth.getProfile(req.userEmail) : null });
});
app.put("/api/profile", (req, res) => {
  const email = requireUser(req, res);
  if (!email) return;
  try {
    res.json({ ok: true, profile: auth.updateProfile(email, req.body || {}) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});
app.post("/api/profile/avatar", (req, res) => {
  const email = requireUser(req, res);
  if (!email) return;
  try {
    res.json({ ok: true, profile: auth.setAvatar(email, req.body?.dataUrl) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});
app.delete("/api/profile/avatar", (req, res) => {
  const email = requireUser(req, res);
  if (!email) return;
  try {
    res.json({ ok: true, profile: auth.clearAvatar(email) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});
app.get("/api/users", (req, res) => {
  res.json({ ok: true, users: auth.listProfiles() });
});
app.get("/api/profile/avatar/:id", (req, res) => {
  const f = auth.avatarFile(req.params.id);
  if (!f) {
    res.status(404).end();
    return;
  }
  res.type(f.ext === "jpg" ? "image/jpeg" : `image/${f.ext}`);
  res.sendFile(f.path);
});

// --- store endpoints (back the LazyStore shim) ---
app.get("/api/store", (req, res) => {
  res.json({ data: store.storeLoad(req.session.storesDir, req.query.file) });
});
app.post("/api/store/set", async (req, res) => {
  await store.storeSet(req.session.storesDir, req.body);
  res.json({ ok: true });
});
app.post("/api/store/delete", async (req, res) => {
  await store.storeDelete(req.session.storesDir, req.body);
  res.json({ ok: true });
});
app.post("/api/store/clear", async (req, res) => {
  await store.storeClear(req.session.storesDir, req.body);
  res.json({ ok: true });
});

// --- streaming network proxy ---
app.post("/api/ai/stream", (req, res) => net.aiHttpStream(req, res));

// --- generic invoke dispatcher ---
function buildHandlers(s) {
  const root = s.workspace;
  return {
    fs_read_dir: (a) => fsops.readDir(root, a),
    fs_read_file: (a) => fsops.readFile(root, a),
    fs_write_file: (a) => fsops.writeFile(root, a),
    fs_create_file: (a) => fsops.createFile(root, a),
    fs_create_dir: (a) => fsops.createDir(root, a),
    fs_rename: (a) => fsops.rename(root, a),
    fs_delete: (a) => fsops.remove(root, a),
    fs_stat: (a) => fsops.stat(root, a),
    fs_search: (a) => fsops.search(root, a),
    fs_glob: (a) => fsops.glob(root, a),
    fs_grep: (a) => fsops.grep(root, a),
    list_subdirs: (a) => fsops.listSubdirs(root, a),

    shell_run_command: (a) => shell.runCommand(root, a),
    shell_session_open: (a) => shell.sessionOpen(root, s.sid, a),
    shell_session_run: (a) => shell.sessionRun(root, s.sid, a),
    shell_session_close: (a) => shell.sessionClose(root, s.sid, a),
    shell_bg_spawn: (a) => shell.bgSpawn(root, s.sid, a),
    shell_bg_logs: (a) => shell.bgLogs(root, s.sid, a),
    shell_bg_kill: (a) => shell.bgKill(root, s.sid, a),
    shell_bg_list: () => shell.bgList(root, s.sid),

    secrets_get: (a) => secrets.secretsGet(s.secretsFile, a),
    secrets_set: (a) => secrets.secretsSet(s.secretsFile, a),
    secrets_delete: (a) => secrets.secretsDelete(s.secretsFile, a),
    secrets_get_all: (a) => secrets.secretsGetAll(s.secretsFile, a),

    lm_ping: (a) => net.lmPing(root, a),
    ai_http_request: (a) => net.aiHttpRequest(root, a),

    // WSL is desktop-only; report "no distros" on the web.
    wsl_list_distros: () => [],
    wsl_home: () => {
      throw new Error("WSL is not available on the web");
    },
    wsl_default_distro: () => null,
  };
}

app.post("/api/invoke", async (req, res) => {
  const { cmd, args } = req.body || {};
  const handlers = buildHandlers(req.session);
  const handler = handlers[cmd];
  if (!handler) {
    res.status(400).json({ ok: false, error: `Unknown command: ${cmd}` });
    return;
  }
  try {
    const data = await handler(args || {});
    res.json({ ok: true, data });
  } catch (e) {
    res.json({ ok: false, error: String(e?.message ?? e) });
  }
});

// In production the Node server also serves the built frontend (dev uses Vite).
if (IS_PROD) {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

const server = http.createServer(app);
attachPtyServer(server);
server.listen(PORT, () => {
  console.log(`[terax-backend] listening on http://127.0.0.1:${PORT}`);
});
