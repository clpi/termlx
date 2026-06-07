// Snake — eat the fruit, grow, don't hit the walls or yourself.
import { createScreen, color, sleep, rndInt } from "./lib/term.mjs";
import { gameOver } from "./lib/ui.mjs";

const W = 28;
const H = 18;
const at = (x, y) => `\x1b[${y};${x}H`;

async function main() {
  const screen = createScreen();
  const { cols, rows } = screen.size();
  const ox = Math.max(2, Math.floor((cols - (W + 2)) / 2));
  const oy = Math.max(2, Math.floor((rows - (H + 3)) / 2));

  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let snake = [
    { x: 6, y: 9 },
    { x: 5, y: 9 },
    { x: 4, y: 9 },
  ];
  let food = spawnFood(snake);
  let score = 0;
  let alive = true;
  let tick = 115;

  screen.onKey((k) => {
    if (k === "up" || k === "w") setDir(0, -1);
    else if (k === "down" || k === "s") setDir(0, 1);
    else if (k === "left" || k === "a") setDir(-1, 0);
    else if (k === "right" || k === "d") setDir(1, 0);
    else if (k === "q" || k === "escape") alive = false;
  });

  function setDir(x, y) {
    if (dir.x + x === 0 && dir.y + y === 0) return;
    nextDir = { x, y };
  }
  function spawnFood(sn) {
    while (true) {
      const f = { x: rndInt(W), y: rndInt(H) };
      if (!sn.some((s) => s.x === f.x && s.y === f.y)) return f;
    }
  }

  screen.clear();
  draw();
  while (alive) {
    await sleep(tick);
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (
      head.x < 0 ||
      head.x >= W ||
      head.y < 0 ||
      head.y >= H ||
      snake.some((s) => s.x === head.x && s.y === head.y)
    ) {
      alive = false;
      break;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      food = spawnFood(snake);
      if (tick > 55) tick -= 3;
    } else {
      snake.pop();
    }
    draw();
  }

  await gameOver(screen, "snake", score, "SNAKE");
  screen.end();
  process.exit(0);

  function draw() {
    let buf = color.reset;
    buf +=
      at(ox, oy - 1) +
      `${color.bold}${color.fg(82)}🐍 SNAKE${color.reset}   ${color.dim}score${color.reset} ${color.bold}${color.fg(220)}${score}${color.reset}   ${color.dim}arrows/wasd · q quit${color.reset}   `;
    buf += at(ox, oy) + color.fg(238) + "╔" + "═".repeat(W) + "╗";
    for (let y = 0; y < H; y++) {
      buf += at(ox, oy + 1 + y) + color.fg(238) + "║";
      let row = "";
      for (let x = 0; x < W; x++) {
        if (snake[0].x === x && snake[0].y === y) row += `${color.fg(46)}█${color.reset}`;
        else if (snake.some((s, i) => i > 0 && s.x === x && s.y === y))
          row += `${color.fg(34)}█${color.reset}`;
        else if (food.x === x && food.y === y) row += `${color.fg(196)}●${color.reset}`;
        else row += " ";
      }
      buf += row + color.fg(238) + "║" + color.reset;
    }
    buf += at(ox, oy + 1 + H) + color.fg(238) + "╚" + "═".repeat(W) + "╝" + color.reset;
    screen.write(buf);
  }
}

main();
