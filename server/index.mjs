import http from "node:http";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./session.mjs";
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

app.get("/api/session", (req, res) => {
  res.json({ home: req.session.workspace, platform: "linux", name: "Terax" });
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
