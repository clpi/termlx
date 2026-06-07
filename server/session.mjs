import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
// A single shared, persistent environment used by every visitor. The session
// cookie still identifies each browser (for the PTY socket and per-tab job
// scoping), but workspace/settings/secrets all resolve to this shared dir.
export const SHARED_DIR = path.join(DATA_DIR, "shared");

const COOKIE = "terax_sid";

function validSid(sid) {
  return typeof sid === "string" && /^[a-f0-9-]{36}$/.test(sid);
}

export function ensureSessionDirs(sid) {
  const dir = SHARED_DIR;
  const workspace = path.join(dir, "workspace");
  const storesDir = path.join(dir, "stores");
  const secretsFile = path.join(dir, "secrets.json");
  const firstTime = !fs.existsSync(workspace);
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(storesDir, { recursive: true });
  if (firstTime) {
    fs.writeFileSync(
      path.join(workspace, "README.md"),
      `# Terax shared workspace\n\nThis is a shared, persistent environment. Everyone who opens this app\nsees and edits the same files here. Anything you create (in the editor or\nfrom the terminal) is saved and will be here next time, for everyone.\n\nTry it: open a terminal and run\n\n    echo "hello from $(whoami)" > hello.txt\n    ls -la\n`,
    );
  }
  return { sid, dir, workspace, storesDir, secretsFile };
}

export function sessionMiddleware(req, res, next) {
  let sid = req.cookies?.[COOKIE];
  if (!validSid(sid)) {
    sid = crypto.randomUUID();
    res.cookie(COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  req.session = ensureSessionDirs(sid);
  next();
}

/** Resolve the session id from a raw Cookie header (used by the WS upgrade). */
export function sidFromCookieHeader(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === COOKIE) {
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      if (validSid(v)) return v;
    }
  }
  return null;
}
