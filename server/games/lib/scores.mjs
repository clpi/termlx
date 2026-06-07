// Shared, persistent leaderboard. Scores live in the shared stores dir
// (TERAX_GAMES_DATA, set by the PTY server) so every visitor competes on the
// same high-score tables. Falls back to the cwd when run outside the app.
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.TERAX_GAMES_DATA || process.cwd();
const FILE = path.join(DIR, "games-leaderboard.json");
const KEEP = 20;

export function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export function top(game, n = 10) {
  const all = load();
  return (all[game] || []).slice(0, n);
}

export function qualifies(game, score, n = 10) {
  if (!score || score <= 0) return false;
  const list = top(game, n);
  return list.length < n || score > list[list.length - 1].score;
}

/** Record a score; returns its 1-based rank, or 0 if it didn't make the board. */
export function add(game, name, score) {
  const all = load();
  const list = all[game] || [];
  const entry = {
    name: (name || "???").slice(0, 3).toUpperCase().padEnd(3, "?"),
    score,
    date: new Date().toISOString().slice(0, 10),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  all[game] = list.slice(0, KEEP);
  try {
    fs.mkdirSync(DIR, { recursive: true });
    // Write+rename so a concurrent reader never sees a half-written file.
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
    fs.renameSync(tmp, FILE);
  } catch {}
  return all[game].indexOf(entry) + 1;
}
