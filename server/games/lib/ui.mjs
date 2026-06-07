// Shared game-over flow: shows the score, takes initials on a new high score,
// then renders the leaderboard. Used by every game so the experience is uniform.
import { color, readInitials, nextKey, stripAnsi } from "./term.mjs";
import * as scores from "./scores.mjs";

export async function gameOver(screen, game, score, label = game) {
  const { cols, rows } = screen.size();
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  const center = (s, y) => {
    screen.moveTo(cx - Math.floor(stripAnsi(s).length / 2), y);
    screen.write(s);
  };

  const qualifies = scores.qualifies(game, score);
  let rank = 0;

  if (qualifies) {
    screen.clear();
    center(`${color.bold}${color.fg(196)}G A M E   O V E R${color.reset}`, cy - 3);
    center(`${color.dim}score${color.reset}  ${color.bold}${color.fg(220)}${score}${color.reset}`, cy - 1);
    center(`${color.fg(46)}${color.bold}NEW HIGH SCORE!${color.reset}`, cy + 1);
    center(`${color.dim}enter your initials${color.reset}`, cy + 2);
    const name = await readInitials(screen, cx - 1, cy + 4, 3);
    rank = scores.add(game, name, score);
  }

  // Leaderboard view.
  screen.clear();
  const list = scores.top(game, 10);
  let y = cy - 8;
  center(`${color.bold}${color.fg(81)}${label} — TOP SCORES${color.reset}`, y);
  y += 2;
  if (!qualifies) {
    center(`${color.dim}your score ${color.reset}${color.bold}${color.fg(220)}${score}${color.reset}`, y);
    y += 2;
  }
  if (!list.length) {
    center(`${color.dim}no scores yet — be the first!${color.reset}`, y);
    y += 1;
  }
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const mine = i + 1 === rank;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    const row =
      `${String(i + 1).padStart(2)}. ${medal} ${e.name.padEnd(3)}  ` +
      `${String(e.score).padStart(8)}   ${color.dim}${e.date}${color.reset}`;
    center((mine ? `${color.fg(46)}${color.bold}❯ ${color.reset}` : "  ") + (mine ? color.fg(46) + color.bold : "") + row + color.reset, y++);
  }
  y += 2;
  center(`${color.dim}press any key to continue${color.reset}`, y);
  await nextKey(screen);
}
