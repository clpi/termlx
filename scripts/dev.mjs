import { spawn } from "node:child_process";

const procs = [];

function run(name, cmd, args) {
  const p = spawn(cmd, args, { stdio: "inherit", env: process.env });
  p.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev] ${name} exited (code=${code}, signal=${signal}); shutting down`);
      shutdown();
    }
  });
  procs.push(p);
  return p;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try {
      p.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

run("backend", "node", ["server/index.mjs"]);
run("vite", "npx", ["vite"]);
