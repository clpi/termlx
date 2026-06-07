import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const SESSIONS_DIR = path.join(DATA_DIR, "sessions");

const COOKIE = "terax_sid";

function validSid(sid) {
  return typeof sid === "string" && /^[a-f0-9-]{36}$/.test(sid);
}

export function ensureSessionDirs(sid) {
  const dir = path.join(SESSIONS_DIR, sid);
  const workspace = path.join(dir, "workspace");
  const storesDir = path.join(dir, "stores");
  const secretsFile = path.join(dir, "secrets.json");
  const firstTime = !fs.existsSync(workspace);
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(storesDir, { recursive: true });
  if (firstTime) {
    fs.writeFileSync(
      path.join(workspace, "README.md"),
      `# Your Terax workspace\n\nThis is your personal, persistent sandbox. Files you create here\n(in the editor or from the terminal) are saved and will be here next time.\n\nTry it: open a terminal and run\n\n    echo "hello from $(whoami)" > hello.txt\n    ls -la\n`,
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
