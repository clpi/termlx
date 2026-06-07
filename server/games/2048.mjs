// 2048 — slide and merge tiles. Reach 2048 (and keep going for a bigger score).
import { createScreen, color, rndInt } from "./lib/term.mjs";
import { gameOver } from "./lib/ui.mjs";

const N = 4;
const PAL = {
  2: 223,
  4: 222,
  8: 215,
  16: 208,
  32: 209,
  64: 203,
  128: 227,
  256: 226,
  512: 220,
  1024: 214,
  2048: 46,
};

const empty = () => Array.from({ length: N }, () => Array(N).fill(0));

async function main() {
  const screen = createScreen();
  let grid = empty();
  let score = 0;
  let won = false;
  addTile();
  addTile();

  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  screen.clear();
  draw();
  screen.onKey((k) => {
    let moved = false;
    if (k === "left" || k === "a") moved = move("L");
    else if (k === "right" || k === "d") moved = move("R");
    else if (k === "up" || k === "w") moved = move("U");
    else if (k === "down" || k === "s") moved = move("D");
    else if (k === "q" || k === "escape") return resolveDone();
    else return;
    if (moved) {
      addTile();
      if (!won && has(2048)) won = true;
      draw();
      if (!canMove()) return resolveDone();
    }
  });

  await done;
  await gameOver(screen, "2048", score, "2048");
  screen.end();
  process.exit(0);

  function addTile() {
    const cells = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) if (!grid[r][c]) cells.push([r, c]);
    if (!cells.length) return;
    const [r, c] = cells[rndInt(cells.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
  function slide(line) {
    const xs = line.filter((v) => v);
    for (let i = 0; i < xs.length - 1; i++) {
      if (xs[i] === xs[i + 1]) {
        xs[i] *= 2;
        score += xs[i];
        xs.splice(i + 1, 1);
      }
    }
    while (xs.length < N) xs.push(0);
    return xs;
  }
  function move(dir) {
    const before = JSON.stringify(grid);
    for (let i = 0; i < N; i++) {
      let line;
      if (dir === "L" || dir === "R") {
        line = grid[i].slice();
        if (dir === "R") line.reverse();
      } else {
        line = [];
        for (let r = 0; r < N; r++) line.push(grid[r][i]);
        if (dir === "D") line.reverse();
      }
      line = slide(line);
      if (dir === "R" || dir === "D") line.reverse();
      if (dir === "L" || dir === "R") grid[i] = line;
      else for (let r = 0; r < N; r++) grid[r][i] = line[r];
    }
    return JSON.stringify(grid) !== before;
  }
  function has(v) {
    return grid.some((row) => row.some((c) => c === v));
  }
  function canMove() {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (!grid[r][c]) return true;
        if (c < N - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < N - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    return false;
  }
  function tile(v) {
    const bg = v ? PAL[v] ?? 53 : 236;
    const fg = v && v < 8 ? 236 : 231;
    const s = v ? String(v) : "";
    const pad = 6 - s.length;
    const left = Math.floor(pad / 2);
    return `${color.bg(bg)}${color.fg(fg)}${color.bold}${" ".repeat(left)}${s}${" ".repeat(pad - left)}${color.reset}`;
  }
  function draw() {
    const { cols, rows } = screen.size();
    const bw = N * 6 + N + 1;
    const ox = Math.max(2, Math.floor((cols - bw) / 2));
    const oy = Math.max(2, Math.floor((rows - (N * 2 + 3)) / 2));
    const bar = `${color.fg(238)}│${color.reset}`;
    const line = (l, m, r) => color.fg(238) + l + Array(N).fill("─".repeat(6)).join(m) + r + color.reset;
    let buf = color.reset;
    buf +=
      `\x1b[${oy - 1};${ox}H` +
      `${color.bold}${color.fg(220)}2048${color.reset}   ${color.dim}score${color.reset} ${color.bold}${score}${color.reset}` +
      (won ? `   ${color.fg(46)}${color.bold}YOU WIN! keep going${color.reset}` : `   ${color.dim}arrows/wasd · q quit${color.reset}`) +
      "      ";
    let y = oy;
    buf += `\x1b[${y++};${ox}H` + line("┌", "┬", "┐");
    for (let r = 0; r < N; r++) {
      buf += `\x1b[${y++};${ox}H` + bar + grid[r].map(tile).join(bar) + bar;
      if (r < N - 1) buf += `\x1b[${y++};${ox}H` + line("├", "┼", "┤");
    }
    buf += `\x1b[${y};${ox}H` + line("└", "┴", "┘");
    screen.write(buf);
  }
}

main();
