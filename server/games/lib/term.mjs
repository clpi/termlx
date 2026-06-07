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

/** Decode a single non-escape byte into a key name (or null). */
export function decodeByte(b) {
  switch (b) {
    case 0x0d:
    case 0x0a:
      return "enter";
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
  if (b >= 32 && b < 127) return String.fromCharCode(b).toLowerCase();
  return null;
}

/** Consume one key from the front of a buffer. Returns { key, len } or null
 *  when more bytes are needed to complete a (possibly fragmented) sequence. */
function takeKey(buf) {
  if (buf[0] === 0x1b) {
    if (buf.length < 2) return null; // could be a lone ESC or a split arrow
    if (buf[1] === 0x5b || buf[1] === 0x4f) {
      // CSI / SS3 — arrow keys
      if (buf.length < 3) return null;
      const map = { 0x41: "up", 0x42: "down", 0x43: "right", 0x44: "left" };
      return { key: map[buf[2]] || null, len: 3 };
    }
    return { key: "escape", len: 1 };
  }
  return { key: decodeByte(buf[0]), len: 1 };
}

/** Set up the alternate screen + raw input and return a small drawing API. */
export function createScreen() {
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
      const r = takeKey(pending);
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
          const k = decodeByte(b);
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
