#!/usr/bin/env node
// Terax terminal text editor — a small nano-style editor that runs inside the
// PTY. Usage: `edit <file>`. Arrows/PageUp/PageDown/Home/End to move, type to
// insert, ^S to save, ^Q to quit (twice if there are unsaved changes).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createScreen, color, sanitizeText } from "../games/lib/term.mjs";

const ESC = "\x1b";
const TABW = 8;
const target = process.argv[2];
if (!target) {
  process.stderr.write("usage: edit <file>\n");
  process.exit(1);
}
const abs = path.resolve(process.cwd(), target);
const name = path.basename(abs);

let lines = [""];
let existed = false;
try {
  const data = fs.readFileSync(abs, "utf8");
  // Strip control chars (keeps tab) so a hostile file can't spoof the screen.
  lines = data.split("\n").map(sanitizeText);
  existed = true;
} catch {
  /* new file */
}
if (lines.length === 0) lines = [""];

// Visual column of buffer index `col`, accounting for tab stops.
function dispCol(line, col) {
  let v = 0;
  for (let i = 0; i < col && i < line.length; i++) {
    if (line[i] === "\t") v += TABW - (v % TABW);
    else v += 1;
  }
  return v;
}
// Expand tabs to spaces for display (the buffer keeps real tabs).
function expandTabs(line) {
  let out = "";
  let v = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\t") {
      const n = TABW - (v % TABW);
      out += " ".repeat(n);
      v += n;
    } else {
      out += line[i];
      v += 1;
    }
  }
  return out;
}

const screen = createScreen({ mode: "text" });
let cx = 0; // cursor column within the current line
let cy = 0; // cursor row within the document
let top = 0; // first visible document row
let left = 0; // first visible column (horizontal scroll)
let dirty = false;
let quitArmed = false;
let status = existed ? "" : "new file";

function viewRows() {
  return Math.max(1, screen.size().rows - 1); // last row is the status bar
}
function clampCursor() {
  cy = Math.max(0, Math.min(cy, lines.length - 1));
  cx = Math.max(0, Math.min(cx, lines[cy].length));
}
function scrollIntoView(curDisp) {
  const { cols } = screen.size();
  const rows = viewRows();
  if (cy < top) top = cy;
  if (cy >= top + rows) top = cy - rows + 1;
  if (curDisp < left) left = curDisp;
  if (curDisp >= left + cols) left = curDisp - cols + 1;
  if (left < 0) left = 0;
}

function render() {
  clampCursor();
  const curDisp = dispCol(lines[cy], cx);
  scrollIntoView(curDisp);
  const { cols } = screen.size();
  const view = viewRows();
  let out = `${ESC}[H`;
  for (let i = 0; i < view; i++) {
    const row = top + i;
    out += `${ESC}[K`;
    if (row < lines.length) {
      out += expandTabs(lines[row]).slice(left, left + cols);
    } else {
      out += `${color.fg(60)}~${color.reset}`;
    }
    out += "\r\n";
  }
  // Status bar (inverse video) on the final row.
  const flag = dirty ? " *" : "";
  const ascii = lines[cy].codePointAt(cx);
  const charInfo = ascii !== undefined ? ` U+${ascii.toString(16).toUpperCase().padStart(4, "0")}` : "";
  const right = `Ln ${cy + 1}/${lines.length}  Col ${cx + 1}${charInfo}`;
  const left2 = ` ${name}${flag}  ${color.dim}^S save  ^Q quit${color.reset}`;
  const help = status ? `  ${color.fg(220)}${status}${color.reset}` : "";
  const bar = `${left2}${help}`;
  out += `${ESC}[7m${ESC}[K ${stripPad(bar, right, cols)} ${ESC}[0m`;
  out += `${ESC}[${cy - top + 1};${curDisp - left + 1}H`; // place the real cursor
  screen.write(out);
}

// Pack a left- and right-aligned segment into `cols` columns, ignoring the
// width of ANSI color codes when measuring.
function stripPad(leftSeg, rightSeg, cols) {
  const visLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
  const budget = Math.max(0, cols - 2);
  const gap = budget - visLen(leftSeg) - visLen(rightSeg);
  if (gap < 1) return leftSeg.slice(0, budget);
  return leftSeg + " ".repeat(gap) + rightSeg;
}

function insert(str) {
  const line = lines[cy];
  lines[cy] = line.slice(0, cx) + str + line.slice(cx);
  cx += str.length;
  dirty = true;
}
function newline() {
  const line = lines[cy];
  const rest = line.slice(cx);
  lines[cy] = line.slice(0, cx);
  lines.splice(cy + 1, 0, rest);
  cy += 1;
  cx = 0;
  dirty = true;
}
function backspace() {
  if (cx > 0) {
    const line = lines[cy];
    lines[cy] = line.slice(0, cx - 1) + line.slice(cx);
    cx -= 1;
    dirty = true;
  } else if (cy > 0) {
    const prev = lines[cy - 1];
    cx = prev.length;
    lines[cy - 1] = prev + lines[cy];
    lines.splice(cy, 1);
    cy -= 1;
    dirty = true;
  }
}
function del() {
  const line = lines[cy];
  if (cx < line.length) {
    lines[cy] = line.slice(0, cx) + line.slice(cx + 1);
    dirty = true;
  } else if (cy < lines.length - 1) {
    lines[cy] = line + lines[cy + 1];
    lines.splice(cy + 1, 1);
    dirty = true;
  }
}
function save() {
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, lines.join("\n"), "utf8");
    dirty = false;
    status = `saved ${lines.length} lines`;
  } catch (e) {
    status = `save failed: ${e.message}`;
  }
}

screen.clear();
render();
screen.onKey((k) => {
  const wasQuitArmed = quitArmed;
  quitArmed = false;
  status = "";
  switch (k) {
    case "ctrl-q":
      if (dirty && !wasQuitArmed) {
        quitArmed = true;
        status = "unsaved changes — press ^Q again to quit";
        break;
      }
      screen.end();
      process.stdout.write("\r\n");
      process.exit(0);
      return;
    case "ctrl-s":
      save();
      break;
    case "up":
      cy -= 1;
      break;
    case "down":
      cy += 1;
      break;
    case "left":
      if (cx > 0) cx -= 1;
      else if (cy > 0) {
        cy -= 1;
        cx = lines[cy].length;
      }
      break;
    case "right":
      if (cx < lines[cy].length) cx += 1;
      else if (cy < lines.length - 1) {
        cy += 1;
        cx = 0;
      }
      break;
    case "home":
      cx = 0;
      break;
    case "end":
      cx = lines[cy].length;
      break;
    case "pageup":
      cy -= viewRows();
      break;
    case "pagedown":
      cy += viewRows();
      break;
    case "enter":
      newline();
      break;
    case "backspace":
      backspace();
      break;
    case "delete":
      del();
      break;
    case "tab":
      insert("  ");
      break;
    case "space":
      insert(" ");
      break;
    case "escape":
      break;
    default:
      if (k && k.length === 1) insert(k);
  }
  render();
});
