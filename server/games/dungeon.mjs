// Dungeon Crawler — a compact roguelike. Descend, fight, loot, survive.
// Score = gold + depth * 100 + kills * 25.
import { createScreen, color, rndInt } from "./lib/term.mjs";
import { gameOver } from "./lib/ui.mjs";

const W = 50;
const H = 17;

const MONSTERS = [
  { ch: "r", name: "rat", hp: 3, atk: 1, col: 245 },
  { ch: "g", name: "goblin", hp: 6, atk: 2, col: 40 },
  { ch: "o", name: "orc", hp: 11, atk: 3, col: 28 },
  { ch: "T", name: "troll", hp: 18, atk: 5, col: 130 },
];

async function main() {
  const screen = createScreen();
  const player = { x: 0, y: 0, hp: 24, maxhp: 24, atk: 4, gold: 0, depth: 1 };
  let kills = 0;
  let map, monsters, items;
  let msg = "You enter the dungeon. Find the stairs '>' to descend.";
  let alive = true;

  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  build();
  screen.clear();
  draw();
  screen.onKey((k) => {
    if (!alive) return;
    let dx = 0;
    let dy = 0;
    if (k === "up" || k === "w") dy = -1;
    else if (k === "down" || k === "s") dy = 1;
    else if (k === "left" || k === "a") dx = -1;
    else if (k === "right" || k === "d") dx = 1;
    else if (k === "q" || k === "escape") {
      alive = false;
      return resolveDone();
    } else return;
    if (tryMove(dx, dy)) {
      monsterTurn();
      if (player.hp <= 0) {
        alive = false;
        msg = "You died in the dark.";
        draw();
        return setTimeout(() => resolveDone(), 900);
      }
    }
    draw();
  });

  await done;
  await gameOver(screen, "dungeon", score(), "DUNGEON CRAWLER");
  screen.end();
  process.exit(0);

  function score() {
    return player.gold + (player.depth - 1) * 100 + kills * 25;
  }
  function passable(x, y) {
    return x >= 0 && x < W && y >= 0 && y < H && map[y][x] !== "#";
  }
  function monsterAt(x, y) {
    return monsters.find((m) => m.x === x && m.y === y);
  }
  function center(room) {
    return { x: room.x + (room.w >> 1), y: room.y + (room.h >> 1) };
  }
  function build() {
    map = Array.from({ length: H }, () => Array(W).fill("#"));
    const rooms = [];
    for (let t = 0; t < 50 && rooms.length < 7; t++) {
      const w = 4 + rndInt(8);
      const h = 3 + rndInt(4);
      const x = 1 + rndInt(W - w - 1);
      const y = 1 + rndInt(H - h - 1);
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) map[yy][xx] = ".";
      if (rooms.length) {
        const a = center(rooms[rooms.length - 1]);
        const b = center({ x, y, w, h });
        for (let xx = Math.min(a.x, b.x); xx <= Math.max(a.x, b.x); xx++) map[a.y][xx] = ".";
        for (let yy = Math.min(a.y, b.y); yy <= Math.max(a.y, b.y); yy++) map[yy][b.x] = ".";
      }
      rooms.push({ x, y, w, h });
    }
    const start = center(rooms[0]);
    player.x = start.x;
    player.y = start.y;
    const last = center(rooms[rooms.length - 1]);
    map[last.y][last.x] = ">";

    monsters = [];
    items = [];
    const tier = Math.min(MONSTERS.length - 1, Math.floor((player.depth - 1) / 2));
    const count = 3 + player.depth;
    for (let i = 0; i < count; i++) {
      const room = rooms[1 + rndInt(rooms.length - 1)];
      const proto = MONSTERS[Math.min(MONSTERS.length - 1, rndInt(tier + 2))];
      const x = room.x + rndInt(room.w);
      const y = room.y + rndInt(room.h);
      if ((x === player.x && y === player.y) || map[y][x] === ">") continue;
      monsters.push({ ...proto, x, y, hp: proto.hp + player.depth });
    }
    for (let i = 0; i < 2 + rndInt(3); i++) {
      const room = rooms[rndInt(rooms.length)];
      items.push({ type: "gold", amt: 5 + rndInt(16 + player.depth * 4), x: room.x + rndInt(room.w), y: room.y + rndInt(room.h) });
    }
    for (let i = 0; i < rndInt(3); i++) {
      const room = rooms[rndInt(rooms.length)];
      items.push({ type: "potion", amt: 8, x: room.x + rndInt(room.w), y: room.y + rndInt(room.h) });
    }
  }
  function tryMove(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    const m = monsterAt(nx, ny);
    if (m) {
      const dmg = player.atk + rndInt(3);
      m.hp -= dmg;
      if (m.hp <= 0) {
        monsters = monsters.filter((x) => x !== m);
        kills++;
        msg = `You slay the ${m.name}! (+25)`;
      } else {
        msg = `You hit the ${m.name} for ${dmg}.`;
      }
      return true;
    }
    if (!passable(nx, ny)) return false;
    player.x = nx;
    player.y = ny;
    const idx = items.findIndex((it) => it.x === nx && it.y === ny);
    if (idx >= 0) {
      const it = items[idx];
      items.splice(idx, 1);
      if (it.type === "gold") {
        player.gold += it.amt;
        msg = `You pick up ${it.amt} gold.`;
      } else {
        player.hp = Math.min(player.maxhp, player.hp + it.amt);
        msg = `You quaff a potion (+${it.amt} HP).`;
      }
    }
    if (map[ny][nx] === ">") {
      player.depth++;
      player.maxhp += 2;
      player.hp = Math.min(player.maxhp, player.hp + 5);
      msg = `You descend to depth ${player.depth}.`;
      build();
    }
    return true;
  }
  function monsterTurn() {
    for (const m of monsters) {
      const dist = Math.abs(m.x - player.x) + Math.abs(m.y - player.y);
      if (dist > 10) continue;
      const sx = Math.sign(player.x - m.x);
      const sy = Math.sign(player.y - m.y);
      const opts =
        Math.abs(player.x - m.x) > Math.abs(player.y - m.y)
          ? [[sx, 0], [0, sy]]
          : [[0, sy], [sx, 0]];
      for (const [ox, oy] of opts) {
        const nx = m.x + ox;
        const ny = m.y + oy;
        if (!ox && !oy) continue;
        if (nx === player.x && ny === player.y) {
          player.hp -= m.atk;
          msg = `The ${m.name} hits you for ${m.atk}!`;
          break;
        }
        if (passable(nx, ny) && !monsterAt(nx, ny)) {
          m.x = nx;
          m.y = ny;
          break;
        }
      }
    }
  }
  function draw() {
    const { cols, rows } = screen.size();
    const ox = Math.max(2, Math.floor((cols - W) / 2));
    const oy = Math.max(2, Math.floor((rows - (H + 4)) / 2));
    let buf = color.reset;
    buf +=
      `\x1b[${oy - 1};${ox}H` +
      `${color.bold}${color.fg(208)}⚔ DUNGEON${color.reset}  ${color.dim}depth${color.reset} ${color.bold}${player.depth}${color.reset}  ${color.dim}gold${color.reset} ${color.fg(220)}${player.gold}${color.reset}  ${color.dim}score${color.reset} ${color.bold}${score()}${color.reset}     `;
    for (let y = 0; y < H; y++) {
      let row = "";
      for (let x = 0; x < W; x++) {
        const t = map[y][x];
        row += t === "#" ? `${color.fg(238)}#${color.reset}` : t === ">" ? `${color.fg(51)}>${color.reset}` : `${color.fg(236)}·${color.reset}`;
      }
      buf += `\x1b[${oy + y};${ox}H` + row;
    }
    for (const it of items) {
      const ch = it.type === "gold" ? `${color.fg(220)}$${color.reset}` : `${color.fg(201)}!${color.reset}`;
      buf += `\x1b[${oy + it.y};${ox + it.x}H` + ch;
    }
    for (const m of monsters)
      buf += `\x1b[${oy + m.y};${ox + m.x}H` + `${color.fg(m.col)}${color.bold}${m.ch}${color.reset}`;
    buf += `\x1b[${oy + player.y};${ox + player.x}H` + `${color.fg(231)}${color.bold}@${color.reset}`;

    const bar = hpBar();
    buf += `\x1b[${oy + H};${ox}H` + `${color.bold}HP${color.reset} ${bar} ${player.hp}/${player.maxhp}   ${color.dim}ATK${color.reset} ${player.atk}              `;
    buf += `\x1b[${oy + H + 1};${ox}H` + `${color.fg(250)}${msg}${color.reset}${" ".repeat(Math.max(0, W - msg.length))}`;
    buf += `\x1b[${oy + H + 2};${ox}H` + `${color.dim}move · q quit${color.reset}`;
    screen.write(buf);
  }
  function hpBar() {
    const n = 14;
    const f = Math.max(0, Math.round((player.hp / player.maxhp) * n));
    const c = player.hp / player.maxhp > 0.5 ? 46 : player.hp / player.maxhp > 0.25 ? 220 : 196;
    return `${color.fg(c)}${"█".repeat(f)}${color.fg(238)}${"░".repeat(n - f)}${color.reset}`;
  }
}

main();
