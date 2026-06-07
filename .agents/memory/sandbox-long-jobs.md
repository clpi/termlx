---
name: Sandbox kills long shell jobs
description: Why full `vite build`/`tsc` can't complete here, and how to verify code instead
---

# Long-running shell commands get killed in this environment

`vite build` (and a full `tsc --noEmit`) for this app take longer than a single
bash tool call's limit (~119s). They cannot complete:

- A foreground command exceeding ~120s is terminated by the tool runner.
- A backgrounded command (even `setsid ... & disown`) is killed once the tool
  call that launched it returns — only jobs that finish *within* one call survive.
  So polling a `.done` file across multiple calls never sees completion; the
  process is gone and its log is empty.

**Why:** the runner appears to tear down the process group/cgroup at end of each
tool call; detaching does not save it.

**How to apply:** Don't rely on `pnpm run build` to verify changes here. Instead:
- Use LSP diagnostics (`getLatestLspDiagnostics({filePath})` via code_execution)
  for type/import errors — fast and reliable.
- Trust Vite dev HMR output (refresh_all_logs) — it runs the same esbuild TS +
  import-resolution transform that a build would, and reports transform errors.
- Use a screenshot to confirm the app still renders.
- Never `pkill -f "vite build"` style cleanup — the broad pattern can also kill
  the `Start application` workflow (it runs vite). Restart the workflow if you do.
