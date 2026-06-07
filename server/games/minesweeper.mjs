// Minesweeper — reveal every safe cell. Flag the mines. Beat the clock.
import { createScreen, color, rndInt } from "./lib/term.mjs";
import { gameOver } from "./lib/ui.mjs";

const ROWS = 11;
const COLS = 14;
const MINES = 24;
const NUMCOL = { 1: 33, 2: 40, 3: 196, 4: 57, 5: 124, 6: 37, 7: 240, 8: 245 };

async function main() {
  const screen = createScreen();
  const cell = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      open: false,
      flag: false,
      n: 0,
    })),
  );
  let cx = Math.floor(COLS / 2);
  let cy = Math.floor(ROWS / 2);
  let placed = false;
  let startTime = 0;
  let state = "play"; // play | win | lose
  let opened = 0;

  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  screen.clear();
  draw();
  screen.onKey((k) => {
    if (state !== "play") return;
    if (k === "up" || k === "w") cy = (cy - 1 + ROWS) % ROWS;
    else if (k === "down" || k === "s") cy = (cy + 1) % ROWS;
    else if (k === "left" || k === "a") cx = (cx - 1 + COLS) % COLS;
    else if (k === "right" || k === "d") cx = (cx + 1) % COLS;
    else if (k === "space" || k === "enter") reveal(cx, cy);
    else if (k === "f") {
      const c = cell[cy][cx];
      if (!c.open) c.flag = !c.flag;
    } else if (k === "q" || k === "escape") return resolveDone();
    else return;
    draw();
    if (state !== "play") setTimeout(() => resolveDone(), 900);
  });

  await done;
  const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  const score = state === "win" ? COLS * ROWS * 10 + Math.max(0, 900 - elapsed * 6) : 0;
  draw();
  await gameOver(screen, "minesweeper", score, "MINESWEEPER");
  screen.end();
  process.exit(0);

  function place(safeX, safeY) {
    let n = 0;
    while (n < MINES) {
      const x = rndInt(COLS);
      const y = rndInt(ROWS);
      if (cell[y][x].mine) continue;
      if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
      cell[y][x].mine = true;
      n++;
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        let c = 0;
        forNeighbors(x, y, (nx, ny) => {
          if (cell[ny][nx].mine) c++;
        });
        cell[y][x].n = c;
      }
    placed = true;
    startTime = Date.now();
  }
  function forNeighbors(x, y, fn) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) fn(nx, ny);
      }
  }
  function reveal(x, y) {
    if (!placed) place(x, y);
    const c = cell[y][x];
    if (c.open || c.flag) return;
    c.open = true;
    opened++;
    if (c.mine) {
      state = "lose";
      for (const row of cell) for (const cc of row) if (cc.mine) cc.open = true;
      return;
    }
    if (c.n === 0) forNeighbors(x, y, (nx, ny) => reveal(nx, ny));
    if (opened === ROWS * COLS - MINES) state = "win";
  }
  function draw() {
    const { cols, rows } = screen.size();
    const bw = COLS * 2 + 1;
    const ox = Math.max(2, Math.floor((cols - bw) / 2));
    const oy = Math.max(2, Math.floor((rows - (ROWS + 4)) / 2));
    const flags = cell.flat().filter((c) => c.flag).length;
    const status =
      state === "win"
        ? `${color.fg(46)}${color.bold}CLEARED!${color.reset}`
        : state === "lose"
          ? `${color.fg(196)}${color.bold}BOOM!${color.reset}`
          : `${color.dim}move · space reveal · f flag · q quit${color.reset}`;
    let buf = color.reset;
    buf +=
      `\x1b[${oy - 1};${ox}H` +
      `${color.bold}${color.fg(81)}💣 MINESWEEPER${color.reset}  ${color.dim}mines${color.reset} ${MINES - flags}   ${status}      `;
    buf += `\x1b[${oy};${ox}H` + color.fg(238) + "┌" + "─".repeat(COLS * 2 - 1) + "┐" + color.reset;
    for (let y = 0; y < ROWS; y++) {
      buf += `\x1b[${oy + 1 + y};${ox}H` + color.fg(238) + "│" + color.reset;
      let row = "";
      for (let x = 0; x < COLS; x++) {
        const c = cell[y][x];
        const cur = x === cx && y === cy && state === "play";
        let ch;
        if (c.flag && !c.open) ch = `${color.fg(196)}⚑${color.reset}`;
        else if (!c.open) ch = `${color.fg(244)}·${color.reset}`;
        else if (c.mine) ch = `${color.fg(196)}✸${color.reset}`;
        else if (c.n === 0) ch = " ";
        else ch = `${color.fg(NUMCOL[c.n] || 245)}${c.n}${color.reset}`;
        if (cur) ch = `${color.bg(238)}${ch}${color.reset}`;
        row += ch + (x < COLS - 1 ? " " : "");
      }
      buf += row + color.fg(238) + "│" + color.reset;
    }
    buf += `\x1b[${oy + 1 + ROWS};${ox}H` + color.fg(238) + "└" + "─".repeat(COLS * 2 - 1) + "┘" + color.reset;
    screen.write(buf);
  }
}

main();
