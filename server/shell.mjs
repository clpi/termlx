import { spawn } from "node:child_process";
import crypto from "node:crypto";

const OUTPUT_CAP = 2 * 1024 * 1024; // 2MB per command
const BG_BUFFER_CAP = 256 * 1024;

function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Run a one-shot command and capture stdout/stderr with a timeout. */
export function runCommand(root, { command, cwd, timeoutSecs }) {
  const workdir = cwd || root;
  const timeoutMs = (timeoutSecs ?? 120) * 1000;
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd: workdir,
      env: { ...process.env, HOME: root, PWD: workdir },
    });
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    const onOut = (d, isErr) => {
      const s = d.toString();
      if (isErr) {
        if (stderr.length < OUTPUT_CAP) stderr += s;
        else truncated = true;
      } else {
        if (stdout.length < OUTPUT_CAP) stdout += s;
        else truncated = true;
      }
    };
    child.stdout.on("data", (d) => onOut(d, false));
    child.stderr.on("data", (d) => onOut(d, true));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.slice(0, OUTPUT_CAP),
        stderr: stderr.slice(0, OUTPUT_CAP),
        exit_code: code ?? -1,
        timed_out: timedOut,
        truncated,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: stderr + String(err),
        exit_code: -1,
        timed_out: timedOut,
        truncated,
      });
    });
  });
}

// --- cwd-tracking shell sessions (used by AI agent tools) ---
const sessions = new Map(); // id -> { cwd }

export function sessionOpen(root, { cwd } = {}) {
  const id = crypto.randomUUID();
  sessions.set(id, { cwd: cwd || root });
  return { id, cwd: cwd || root };
}

export function sessionClose(_root, { id }) {
  sessions.delete(id);
  return { closed: true };
}

export function sessionRun(root, { id, command, timeoutSecs }) {
  const sess = sessions.get(id);
  if (!sess) throw new Error("Unknown shell session");
  const marker = "__TERAX_CWD_" + id.slice(0, 8) + "__";
  const script = `cd ${shq(sess.cwd)} 2>/dev/null; ${command}\n__rc=$?; printf "\\n${marker}:%s\\n" "$(pwd)"; exit $__rc`;
  return runCommand(root, { command: script, cwd: sess.cwd, timeoutSecs }).then((res) => {
    let cwdAfter = sess.cwd;
    const lines = res.stdout.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith(marker + ":")) {
        cwdAfter = lines[i].slice(marker.length + 1);
        lines.splice(i, 1);
        break;
      }
    }
    sess.cwd = cwdAfter;
    return { ...res, stdout: lines.join("\n").replace(/\n$/, ""), cwd: cwdAfter };
  });
}

// --- background processes ---
const bg = new Map(); // handle -> { proc, buf, base, dropped, exited, code, command }

export function bgSpawn(root, { command, cwd }) {
  const handle = crypto.randomUUID();
  const child = spawn("bash", ["-lc", command], {
    cwd: cwd || root,
    env: { ...process.env, HOME: root },
  });
  const rec = { proc: child, buf: Buffer.alloc(0), base: 0, dropped: 0, exited: false, code: null, command };
  const append = (d) => {
    rec.buf = Buffer.concat([rec.buf, d]);
    if (rec.buf.length > BG_BUFFER_CAP) {
      const drop = rec.buf.length - BG_BUFFER_CAP;
      rec.buf = rec.buf.subarray(drop);
      rec.base += drop;
      rec.dropped += drop;
    }
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("close", (code) => {
    rec.exited = true;
    rec.code = code ?? -1;
  });
  bg.set(handle, rec);
  return { handle, pid: child.pid };
}

export function bgLogs(_root, { handle, offset }) {
  const rec = bg.get(handle);
  if (!rec) throw new Error("Unknown background process");
  const total = rec.base + rec.buf.length;
  const since = offset ?? 0;
  const from = Math.max(0, since - rec.base);
  const bytes = rec.buf.subarray(from).toString("utf8");
  return {
    bytes,
    next_offset: total,
    dropped: since < rec.base,
    exited: rec.exited,
    exit_code: rec.code,
  };
}

export function bgKill(_root, { handle }) {
  const rec = bg.get(handle);
  if (!rec) throw new Error("Unknown background process");
  try {
    rec.proc.kill("SIGKILL");
  } catch {
    /* already dead */
  }
  return { killed: true };
}

export function bgList() {
  return [...bg.entries()].map(([handle, rec]) => ({
    handle,
    command: rec.command,
    exited: rec.exited,
    exit_code: rec.code,
    pid: rec.proc.pid,
  }));
}
