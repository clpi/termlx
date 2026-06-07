// Email + password authentication. The workspace stays SHARED for everyone —
// login only controls who may enter the app. Users and active sessions persist
// to a JSON file under the data dir. Passwords are stored as scrypt hashes.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./session.mjs";

const AUTH_DIR = path.join(DATA_DIR, "auth");
const AVATAR_DIR = path.join(AUTH_DIR, "avatars");
const FILE = path.join(AUTH_DIR, "auth.json");
const COOKIE = "terax_auth";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

export const AUTH_COOKIE = COOKIE;

// Login is OPTIONAL by default — guests may use the (shared) app freely. Set
// TERAX_REQUIRE_AUTH=1 to force a login before anything is reachable.
export const REQUIRE_AUTH =
  process.env.TERAX_REQUIRE_AUTH === "1" ||
  process.env.TERAX_REQUIRE_AUTH === "true";

// Stable palette for auto-assigned avatar badges.
const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];
const AVATAR_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { users: db.users || {}, sessions: db.sessions || {} };
  } catch {
    return { users: {}, sessions: {} };
  }
}

function save(db) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

const normEmail = (e) => String(e || "").trim().toLowerCase();
const hashPw = (pw, salt) =>
  crypto.scryptSync(String(pw), salt, 64).toString("hex");

/** Create an account. Throws a user-facing Error on invalid input/conflict. */
export function signup(email, password) {
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const db = load();
  if (db.users[email]) {
    throw new Error("An account with this email already exists");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const user = { salt, hash: hashPw(password, salt), createdAt: Date.now() };
  ensureProfile(user, email);
  db.users[email] = user;
  save(db);
  return email;
}

/** Verify credentials and mint a session token. Throws on failure. */
export function login(email, password) {
  email = normEmail(email);
  const db = load();
  const u = db.users[email];
  // Always hash (even for unknown users) to avoid leaking existence via timing.
  const salt = u?.salt || "00000000000000000000000000000000";
  const candidate = hashPw(password ?? "", salt);
  const ok =
    !!u &&
    crypto.timingSafeEqual(
      Buffer.from(candidate, "hex"),
      Buffer.from(u.hash, "hex"),
    );
  if (!ok) throw new Error("Incorrect email or password");
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions[token] = { email, createdAt: Date.now() };
  save(db);
  return token;
}

export function logout(token) {
  if (!token) return;
  const db = load();
  if (db.sessions[token]) {
    delete db.sessions[token];
    save(db);
  }
}

/** Resolve the logged-in email for a session token, or null. */
export function userFromToken(token) {
  if (!token) return null;
  const db = load();
  const s = db.sessions[token];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    delete db.sessions[token];
    save(db);
    return null;
  }
  return s.email;
}

function tokenFromCookieHeader(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/** Resolve the logged-in email from a raw Cookie header (used by WS upgrade). */
export function userFromCookieHeader(header) {
  return userFromToken(tokenFromCookieHeader(header));
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL,
    path: "/",
  };
}

// Simple in-memory, per-IP sliding-window limiter for the auth endpoints. The
// app runs as a single instance, so this is enough to blunt credential
// stuffing / brute force without a dependency.
const attempts = new Map();
export function rateLimit(maxPerMinute = 20) {
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const cutoff = Date.now() - 60_000;
    const hits = (attempts.get(ip) || []).filter((t) => t > cutoff);
    if (hits.length >= maxPerMinute) {
      res.status(429).json({
        ok: false,
        error: "Too many attempts. Please wait a minute and try again.",
      });
      return;
    }
    hits.push(Date.now());
    attempts.set(ip, hits);
    next();
  };
}

/**
 * Express middleware. Resolves the logged-in email onto req.userEmail (null for
 * guests). Login is optional: guests pass through unless TERAX_REQUIRE_AUTH is
 * set, in which case a valid session is required for everything except /auth/*.
 */
export function authGate(req, res, next) {
  if (req.path.startsWith("/auth/")) return next();
  const email = userFromToken(req.cookies?.[COOKIE]);
  if (!email && REQUIRE_AUTH) {
    res.status(401).json({ ok: false, error: "Not authenticated" });
    return;
  }
  req.userEmail = email || null;
  next();
}

// --- profiles ------------------------------------------------------------

function pickColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function defaultDisplayName(email) {
  return normEmail(email).split("@")[0].slice(0, 40) || "user";
}

/** Fill in any missing profile fields on a user record. Returns true if changed. */
function ensureProfile(user, email) {
  let changed = false;
  if (!user.id) {
    user.id = crypto.randomBytes(8).toString("hex");
    changed = true;
  }
  if (typeof user.displayName !== "string") {
    user.displayName = defaultDisplayName(email);
    changed = true;
  }
  if (typeof user.bio !== "string") {
    user.bio = "";
    changed = true;
  }
  if (typeof user.avatarColor !== "string") {
    user.avatarColor = pickColor(user.id || email);
    changed = true;
  }
  if (!("avatarExt" in user)) {
    user.avatarExt = null;
    changed = true;
  }
  if (!("avatarUpdatedAt" in user)) {
    user.avatarUpdatedAt = null;
    changed = true;
  }
  return changed;
}

/** Backfill profile fields (incl. stable ids) for any pre-existing accounts. */
function migrateProfiles() {
  const db = load();
  let changed = false;
  for (const [email, user] of Object.entries(db.users)) {
    if (ensureProfile(user, email)) changed = true;
  }
  if (changed) save(db);
}
migrateProfiles();

function publicProfile(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    bio: user.bio || "",
    avatarColor: user.avatarColor,
    hasAvatar: !!user.avatarExt,
    avatarUpdatedAt: user.avatarUpdatedAt || null,
    createdAt: user.createdAt || null,
  };
}

const sanitizeLine = (s) =>
  String(s).replace(/[\u0000-\u001f\u007f]/g, "").trim();

/** Own profile (includes email), or null if the account is unknown. */
export function getProfile(email) {
  email = normEmail(email);
  const db = load();
  const user = db.users[email];
  if (!user) return null;
  if (ensureProfile(user, email)) save(db);
  return { ...publicProfile(user), email };
}

/** Display name for an email (used to label leaderboard scores), or null. */
export function displayNameForEmail(email) {
  const p = getProfile(email);
  return p ? p.displayName : null;
}

/** Public profiles of every account, for the user directory. */
export function listProfiles() {
  const db = load();
  return Object.entries(db.users)
    .map(([email, user]) => {
      ensureProfile(user, email);
      return publicProfile(user);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function updateProfile(email, fields) {
  email = normEmail(email);
  const db = load();
  const user = db.users[email];
  if (!user) throw new Error("Not signed in");
  ensureProfile(user, email);
  if (typeof fields?.displayName === "string") {
    const dn = sanitizeLine(fields.displayName).slice(0, 40);
    if (!dn) throw new Error("Display name cannot be empty");
    user.displayName = dn;
  }
  if (typeof fields?.bio === "string") {
    user.bio = String(fields.bio)
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
      .slice(0, 280);
  }
  if (
    typeof fields?.avatarColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(fields.avatarColor)
  ) {
    user.avatarColor = fields.avatarColor.toLowerCase();
  }
  save(db);
  return { ...publicProfile(user), email };
}

export function setAvatar(email, dataUrl) {
  email = normEmail(email);
  const db = load();
  const user = db.users[email];
  if (!user) throw new Error("Not signed in");
  ensureProfile(user, email);
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || ""),
  );
  if (!m) throw new Error("Unsupported image format");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0) throw new Error("Empty image");
  if (buf.length > MAX_AVATAR_BYTES) throw new Error("Image too large (max 2MB)");
  const ext = AVATAR_TYPES[m[1]];
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  if (user.avatarExt && user.avatarExt !== ext) {
    try {
      fs.rmSync(path.join(AVATAR_DIR, `${user.id}.${user.avatarExt}`));
    } catch {}
  }
  const dest = path.join(AVATAR_DIR, `${user.id}.${ext}`);
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
  user.avatarExt = ext;
  user.avatarUpdatedAt = Date.now();
  save(db);
  return { ...publicProfile(user), email };
}

export function clearAvatar(email) {
  email = normEmail(email);
  const db = load();
  const user = db.users[email];
  if (!user) throw new Error("Not signed in");
  if (user.avatarExt) {
    try {
      fs.rmSync(path.join(AVATAR_DIR, `${user.id}.${user.avatarExt}`));
    } catch {}
    user.avatarExt = null;
    user.avatarUpdatedAt = Date.now();
    save(db);
  }
  return { ...publicProfile(user), email };
}

/** Resolve an avatar image file for a public user id, or null. */
export function avatarFile(id) {
  const db = load();
  const user = Object.values(db.users).find((u) => u.id === id);
  if (!user || !user.avatarExt) return null;
  return {
    path: path.join(AVATAR_DIR, `${user.id}.${user.avatarExt}`),
    ext: user.avatarExt,
  };
}
