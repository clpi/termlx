#!/usr/bin/env node
// Lists the custom Terax terminal commands. Plain stdout — no alt-screen needed.
import process from "node:process";
import { color } from "../games/lib/term.mjs";

const groups = [
  [
    "Arcade",
    [
      ["games", "Open the arcade menu"],
      ["snake", "Play Snake"],
      ["2048", "Play 2048"],
      ["minesweeper", "Play Minesweeper (alias: mines)"],
      ["dungeon", "Play the Dungeon Crawler"],
    ],
  ],
  [
    "Tools",
    [
      ["edit <file>", "Edit a file in the terminal text editor"],
      ["browse <url>", "Open a URL in the terminal web browser (alias: web)"],
      ["commands", "Show this list (alias: cmds)"],
    ],
  ],
];

const out = [];
out.push("");
out.push(`${color.bold}${color.fg(81)}Terax terminal commands${color.reset}`);
for (const [title, rows] of groups) {
  out.push("");
  out.push(`${color.dim}${title}${color.reset}`);
  for (const [cmd, desc] of rows) {
    out.push(`  ${color.bold}${color.fg(220)}${cmd.padEnd(16)}${color.reset}${desc}`);
  }
}
out.push("");
process.stdout.write(out.join("\n") + "\n");
