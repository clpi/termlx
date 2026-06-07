// Terax Arcade launcher — pick a game, see the leaderboards.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createScreen, color, stripAnsi } from "./lib/term.mjs";
import * as scores from "./lib/scores.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));

const GAMES = [
  { key: "snake", label: "🐍 Snake", file: "snake.mjs", desc: "eat, grow, don't crash" },
  { key: "minesweeper", label: "💣 Minesweeper", file: "minesweeper.mjs", desc: "clear the field, flag the mines" },
  { key: "dungeon", label: "⚔  Dungeon Crawler", file: "dungeon.mjs", desc: "descend, fight, loot, survive" },
  { key: "2048", label: "🔢 2048", file: "2048.mjs", desc: "slide & merge to 2048" },
];
const ITEMS = [...GAMES, { key: "board", label: "🏆 Leaderboards" }, { key: "quit", label: "✗  Quit" }];

const BANNER = [
  "████████╗███████╗██████╗  █████╗ ██╗  ██╗",
  "╚══██╔══╝██╔════╝██╔══██╗██╔══██╗╚██╗██╔╝",
  "   ██║   █████╗  ██████╔╝███████║ ╚███╔╝ ",
  "   ██║   ██╔══╝  ██╔══██╗██╔══██║ ██╔██╗ ",
  "   ██║   ███████╗██║  ██║██║  ██║██╔╝ ██╗",
  "   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝",
];

const screen = createScreen();
let sel = 0;
let view = "menu";

const center = (s, y) => {
  screen.moveTo(Math.floor(screen.size().cols / 2) - Math.floor(stripAnsi(s).length / 2), y);
  screen.write(s);
};

function drawMenu() {
  screen.clear();
  const { rows } = screen.size();
  let y = Math.max(2, Math.floor(rows / 2) - 11);
  for (const line of BANNER) center(`${color.fg(45)}${color.bold}${line}${color.reset}`, y++);
  y++;
  center(`${color.dim}— the terminal arcade —${color.reset}`, y);
  y += 2;
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    const on = i === sel;
    const labelPlain = it.label;
    const left = on ? `${color.fg(45)}${color.bold}❯ ${color.reset}${color.bold}` : "  ";
    const desc = it.desc ? `   ${color.dim}${it.desc}${color.reset}` : "";
    center(`${left}${on ? color.fg(45) : ""}${labelPlain}${color.reset}${on ? desc : ""}`, y++);
  }
  y += 2;
  center(`${color.dim}↑/↓ move · enter select · q quit${color.reset}`, y);
}

function drawBoard() {
  screen.clear();
  const { rows } = screen.size();
  let y = Math.max(2, Math.floor(rows / 2) - 12);
  center(`${color.bold}${color.fg(220)}🏆 LEADERBOARDS${color.reset}`, y);
  y += 2;
  for (const g of GAMES) {
    center(`${color.bold}${color.fg(81)}${g.label}${color.reset}`, y++);
    const top = scores.top(g.key, 3);
    if (!top.length) center(`${color.dim}no scores yet${color.reset}`, y++);
    top.forEach((e, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      center(`${medal} ${color.bold}${e.name}${color.reset}  ${color.fg(220)}${String(e.score).padStart(7)}${color.reset}  ${color.dim}${e.date}${color.reset}`, y++);
    });
    y++;
  }
  center(`${color.dim}press any key to return${color.reset}`, y);
}

function runGame(file) {
  screen.pause();
  spawnSync(process.execPath, [path.join(dir, file)], { stdio: "inherit" });
  screen.resume();
  view = "menu";
  drawMenu();
}

function quit() {
  screen.clear();
  screen.end();
  process.stdout.write(`${color.fg(45)}thanks for playing!${color.reset}\n`);
  process.exit(0);
}

screen.onKey((k) => {
  if (view === "board") {
    view = "menu";
    return drawMenu();
  }
  if (k === "up" || k === "w") sel = (sel - 1 + ITEMS.length) % ITEMS.length;
  else if (k === "down" || k === "s") sel = (sel + 1) % ITEMS.length;
  else if (k === "q") return quit();
  else if (k === "enter" || k === "space") {
    const it = ITEMS[sel];
    if (it.key === "quit") return quit();
    if (it.key === "board") {
      view = "board";
      return drawBoard();
    }
    return runGame(it.file);
  } else return;
  drawMenu();
});

drawMenu();
