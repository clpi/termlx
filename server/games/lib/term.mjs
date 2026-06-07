// Shared terminal helpers for the Terax arcade: raw-mode input, alternate
// screen handling, key decoding, and a couple of small input widgets. Every
// game runs inside the PTY (a real tty), so these talk straight to stdin/stdout.
import process from "node:process";

const ESC = "\x1b";

export const color = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  fg: (n) => `${ESC}[38;5;${n}m`,
  bg: (n) => `${ESC}[48;5;${n}m`,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rndInt = (n) => Math.floor(Math.random() * n);
export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Strip terminal control characters from untrusted content (remote pages,
 *  file contents) so it can't emit escape sequences that spoof the screen.
 *  Keeps printable text, plus tab (0x09) and newline (0x0a); drops ESC, CR,
 *  other C0/C1 controls and DEL. Callers handle tab expansion themselves. */
export const sanitizeText = (s) => s.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");

/** Decode a single non-escape byte into a key name (or null). In "text" mode,
 *  printable characters keep their case and Ctrl+letter becomes "ctrl-<x>" — so
 *  the text editor can tell `S` from `s` and catch ^S/^Q. "game" mode lowercases. */
export function decodeByte(b, mode = "game") {
  switch (b) {
    case 0x0d:
    case 0x0a:
      return "enter";
    case 0x09:
      return "tab";
    case 0x20:
      return "space";
    case 0x7f:
    case 0x08:
      return "backspace";
    case 0x03:
      return "ctrl-c";
    case 0x1b:
      return "escape";
  }
  if (mode === "text") {
    if (b >= 1 && b <= 26) return `ctrl-${String.fromCharCode(96 + b)}`;
    if (b >= 32 && b < 127) return String.fromCharCode(b);
    return null;
  }
  if (b >= 32 && b < 127) return String.fromCharCode(b).toLowerCase();
  return null;
}

/** Map a parsed CSI/SS3 sequence (e.g. "5~" → pagedown) to a key name. */
function csiKey(params, final) {
  switch (final) {
    case 0x41:
      return "up";
    case 0x42:
      return "down";
    case 0x43:
      return "right";
    case 0x44:
      return "left";
    case 0x48:
      return "home";
    case 0x46:
      return "end";
    case 0x7e:
      switch (params) {
        case "1":
        case "7":
          return "home";
        case "4":
        case "8":
          return "end";
        case "3":
          return "delete";
        case "5":
          return "pageup";
        case "6":
          return "pagedown";
      }
      return null;
  }
  return null;
}

/** Consume one key from the front of a buffer. Returns { key, len } or null
 *  when more bytes are needed to complete a (possibly fragmented) sequence. */
function takeKey(buf, mode) {
  if (buf[0] !== 0x1b) return { key: decodeByte(buf[0], mode), len: 1 };
  if (buf.length < 2) return null; // lone ESC, or a split escape sequence
  if (buf[1] === 0x5b || buf[1] === 0x4f) {
    // CSI ("[") or SS3 ("O") — scan optional numeric params then a final byte.
    let i = 2;
    while (i < buf.length && buf[i] >= 0x30 && buf[i] <= 0x3f) i++;
    if (i >= buf.length) return null; // sequence not fully arrived yet
    return { key: csiKey(buf.toString("latin1", 2, i), buf[i]), len: i + 1 };
  }
  return { key: "escape", len: 1 };
}

/** Set up the alternate screen + raw input and return a small drawing API.
 *  Pass { mode: "text" } for case-preserving input (the editor/browser). */
export function createScreen(opts = {}) {
  const mode = opts.mode === "text" ? "text" : "game";
  const out = process.stdout;
  let handler = null;
  let active = false;

  let pending = Buffer.alloc(0);
  let flushTimer = null;
  function onData(chunk) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    while (pending.length) {
      const r = takeKey(pending, mode);
      if (!r) break; // incomplete sequence — wait for more bytes
      pending = pending.subarray(r.len);
      if (r.key) dispatch(r.key);
    }
    if (pending.length) {
      // A lone/partial escape sequence is parked. If nothing completes it
      // shortly, flush its bytes individually (so a bare ESC still registers).
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const buf = pending;
        pending = Buffer.alloc(0);
        for (const b of buf) {
          const k = decodeByte(b, mode);
          if (k) dispatch(k);
        }
      }, 50);
    }
  }
  function dispatch(k) {
    if (k === "ctrl-c") {
      stop();
      process.exit(0);
    }
    if (handler) handler(k);
  }
  function start() {
    if (active) return;
    out.write(`${ESC}[?1049h${ESC}[?25l`);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
    active = true;
  }
  function stop() {
    if (!active) return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    process.stdin.off("data", onData);
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
    process.stdin.pause();
    out.write(`${ESC}[?25h${ESC}[?1049l${color.reset}`);
    active = false;
  }

  const onExit = () => {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
    out.write(`${ESC}[?25h${ESC}[?1049l${color.reset}`);
  };
  process.on("exit", onExit);
  start();

  return {
    write: (s) => out.write(s),
    clear: () => out.write(`${ESC}[2J${ESC}[H`),
    moveTo: (x, y) => out.write(`${ESC}[${y};${x}H`),
    size: () => ({ cols: out.columns || 80, rows: out.rows || 24 }),
    onKey: (h) => {
      handler = h;
    },
    pause: stop,
    resume: start,
    end: () => {
      stop();
      process.removeListener("exit", onExit);
    },
  };
}

/** Resolve on the next key press. */
export function nextKey(screen) {
  return new Promise((res) => screen.onKey((k) => res(k)));
}

/** Single-line text input drawn at (x, y). Resolves with the typed string on
 *  Enter, or null on Escape. The screen must be in { mode: "text" }. */
export function readLine(screen, x, y, { initial = "", prompt = "", width = 70 } = {}) {
  let value = initial;
  return new Promise((resolve) => {
    const draw = () => {
      const full = prompt + value;
      const shown = full.length > width ? full.slice(full.length - width) : full;
      screen.moveTo(x, y);
      screen.write(`${color.reset}${shown}${ESC}[K`);
    };
    screen.write(`${ESC}[?25h`); // show cursor while typing
    draw();
    screen.onKey((k) => {
      if (k === "enter") {
        screen.write(`${ESC}[?25l`);
        return resolve(value);
      }
      if (k === "escape") {
        screen.write(`${ESC}[?25l`);
        return resolve(null);
      }
      if (k === "backspace") {
        value = value.slice(0, -1);
        return draw();
      }
      if (k === "space") {
        value += " ";
        return draw();
      }
      if (k.length === 1) {
        value += k;
        draw();
      }
    });
  });
}

/** Arcade-style initials entry. Returns up to `maxLen` uppercase chars. */
export function readInitials(screen, x, y, maxLen = 3) {
  let value = "";
  return new Promise((resolve) => {
    const draw = () => {
      screen.moveTo(x, y);
      const blanks = "_".repeat(Math.max(0, maxLen - value.length));
      screen.write(`${color.reset}${color.bold}${color.fg(46)}${value}${color.dim}${blanks}${color.reset}`);
    };
    draw();
    screen.onKey((k) => {
      if (k === "enter" || k === "escape") return resolve(value || "???");
      if (k === "backspace") {
        value = value.slice(0, -1);
        return draw();
      }
      if (k.length === 1 && /[a-z0-9]/i.test(k) && value.length < maxLen) {
        value += k.toUpperCase();
        draw();
      }
    });
  });
}
