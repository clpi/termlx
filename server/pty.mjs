import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import * as pty from "node-pty";
import { sidFromCookieHeader, ensureSessionDirs } from "./session.mjs";

const RCFILE = fileURLToPath(new URL("./shell-integration.bash", import.meta.url));

/** Clamp a requested terminal cwd to the session workspace. Falls back to the
 *  workspace root for anything that resolves outside it. */
function safeCwd(requested, workspace) {
  if (!requested) return workspace;
  const abs = path.resolve(workspace, requested);
  if (abs === workspace || abs.startsWith(workspace + path.sep)) return abs;
  return workspace;
}

const SHELL = process.env.SHELL || "bash";

export function attachPtyServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/pty" });

  wss.on("connection", (ws, req) => {
    const sid = sidFromCookieHeader(req.headers.cookie);
    if (!sid) {
      ws.send(JSON.stringify({ type: "error", message: "No session" }));
      ws.close();
      return;
    }
    const { workspace } = ensureSessionDirs(sid);
    ws.binaryType = "arraybuffer";
    let term = null;

    ws.on("message", (raw, isBinary) => {
      if (isBinary) {
        if (term) term.write(Buffer.from(raw).toString("utf8"));
        return;
      }
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "open") {
        if (term) return;
        const cwd = safeCwd(msg.cwd, workspace);
        // Interactive bash ignores PS1/PROMPT_COMMAND from the environment, so
        // shell integration (OSC 7 cwd + OSC 133 prompt markers) is installed
        // via an rcfile. --rcfile is bash-specific, and the rcfile is bash
        // syntax, so we always run bash here (using $SHELL only when it already
        // is bash) rather than honoring a non-bash $SHELL.
        const isBash = /(^|\/)bash$/.test(SHELL);
        const file = isBash ? SHELL : "bash";
        const args = ["--rcfile", RCFILE, "-i"];
        term = pty.spawn(file, args, {
          name: "xterm-256color",
          cols: msg.cols || 80,
          rows: msg.rows || 24,
          cwd,
          env: {
            ...process.env,
            HOME: workspace,
            PWD: cwd,
            TERM: "xterm-256color",
          },
        });
        term.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(Buffer.from(data, "utf8"));
        });
        term.onExit(({ exitCode }) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "exit", code: exitCode }));
            ws.close();
          }
        });
        ws.send(JSON.stringify({ type: "opened", id: msg.id ?? sid }));
      } else if (msg.type === "resize" && term) {
        try {
          term.resize(msg.cols, msg.rows);
        } catch {
          /* ignore bad sizes */
        }
      } else if (msg.type === "write" && term) {
        term.write(msg.data);
      }
    });

    ws.on("close", () => {
      if (term) {
        try {
          term.kill();
        } catch {
          /* already dead */
        }
        term = null;
      }
    });
  });

  return wss;
}
