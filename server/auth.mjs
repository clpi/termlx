// Email + password authentication. The workspace stays SHARED for everyone —
// login only controls who may enter the app. Users and active sessions persist
// to a JSON file under the data dir. Passwords are stored as scrypt hashes.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./session.mjs";

const AUTH_DIR = path.join(DATA_DIR, "auth");
const FILE = path.join(AUTH_DIR, "auth.json");
const COOKIE = "terax_auth";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

export const AUTH_COOKIE = COOKIE;

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
  db.users[email] = { salt, hash: hashPw(password, salt), createdAt: Date.now() };
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

/** Express middleware: require a valid session for everything except /auth/*. */
export function authGate(req, res, next) {
  if (req.path.startsWith("/auth/")) return next();
  const email = userFromToken(req.cookies?.[COOKIE]);
  if (!email) {
    res.status(401).json({ ok: false, error: "Not authenticated" });
    return;
  }
  req.userEmail = email;
  next();
}
