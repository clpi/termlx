---
name: mockup-sandbox setup quirk
description: Why the mockup-sandbox preview server fails on first start and how to fix it
---

# Mockup-sandbox first-start failure

After `createArtifact({artifactType:"mockup-sandbox"})`, the `artifacts/mockup-sandbox: Component Preview Server` workflow can fail on first start with `ERR_MODULE_NOT_FOUND` for a vite plugin (e.g. `@replit/vite-plugin-runtime-error-modal`). The scaffold ships a partial/broken `node_modules`.

**Fix:** in `artifacts/mockup-sandbox/`, do a clean reinstall before restarting the workflow:
`rm -rf node_modules package-lock.json && npm install`

**Why:** the pre-seeded `node_modules` is incomplete and a plain `npm install` errors with `ENOTEMPTY` on leftover dirs (rollup, lucide-react, date-fns). A couple of repeated `rm -rf node_modules` clears the stubborn dirs, then `npm install` succeeds (~30s).

**How to apply:** run this whenever a freshly created mockup-sandbox preview server fails to boot, then `restart_workflow` the preview server.
