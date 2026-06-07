import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const MAX_FILE = 10 * 1024 * 1024; // 10MB read limit
const ALWAYS_SKIP = new Set(["node_modules", ".git"]);

const rootRealCache = new Map();
async function rootReal(root) {
  let r = rootRealCache.get(root);
  if (!r) {
    r = await fsp.realpath(root);
    rootRealCache.set(root, r);
  }
  return r;
}

/** Resolve an incoming (absolute) path to its canonical location and guarantee
 *  it stays inside the sandbox. This walks up to the nearest existing ancestor
 *  and realpath()s it, so symlinks (including ones created from the terminal)
 *  cannot be used to escape the workspace. */
async function resolveIn(root, p) {
  const real = await rootReal(root);
  let cur = path.resolve(p && p.length ? p : root);
  const tail = [];
  for (;;) {
    try {
      const canon = await fsp.realpath(cur);
      const full = tail.length ? path.join(canon, ...tail) : canon;
      if (full !== real && !full.startsWith(real + path.sep)) {
        throw new Error("Path escapes workspace");
      }
      return full;
    } catch (e) {
      if (e.message === "Path escapes workspace") throw e;
      if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e;
      const parent = path.dirname(cur);
      if (parent === cur) throw new Error("Path escapes workspace");
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

function rel(root, abs) {
  const r = path.relative(root, abs);
  return r === "" ? "." : r;
}

function entryKind(st) {
  if (st.isSymbolicLink()) return "symlink";
  if (st.isDirectory()) return "dir";
  return "file";
}

export async function readDir(root, { path: p, showHidden }) {
  const dir = await resolveIn(root, p);
  const names = await fsp.readdir(dir);
  const out = [];
  for (const name of names) {
    if (!showHidden && name.startsWith(".")) continue;
    try {
      const st = await fsp.lstat(path.join(dir, name));
      out.push({
        name,
        kind: entryKind(st),
        size: st.size,
        mtime: Math.floor(st.mtimeMs),
      });
    } catch {
      /* skip unreadable */
    }
  }
  out.sort((a, b) => {
    const ad = a.kind === "dir" ? 0 : 1;
    const bd = b.kind === "dir" ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function listSubdirs(root, { path: p, showHidden }) {
  const dir = await resolveIn(root, p);
  const names = await fsp.readdir(dir);
  const out = [];
  for (const name of names) {
    if (!showHidden && name.startsWith(".")) continue;
    try {
      const st = await fsp.stat(path.join(dir, name));
      if (st.isDirectory()) out.push(name);
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export async function readFile(root, { path: p }) {
  const abs = await resolveIn(root, p);
  const st = await fsp.stat(abs);
  if (st.size > MAX_FILE) {
    return { kind: "toolarge", size: st.size, limit: MAX_FILE };
  }
  const buf = await fsp.readFile(abs);
  const probe = buf.subarray(0, Math.min(buf.length, 8000));
  if (probe.includes(0)) return { kind: "binary", size: st.size };
  return { kind: "text", content: buf.toString("utf8"), size: st.size };
}

export async function writeFile(root, { path: p, content }) {
  const abs = await resolveIn(root, p);
  const tmp = `${abs}.terax-tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, content ?? "", "utf8");
  await fsp.rename(tmp, abs);
}

export async function createFile(root, { path: p }) {
  const abs = await resolveIn(root, p);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, "", { flag: "wx" });
}

export async function createDir(root, { path: p }) {
  const abs = await resolveIn(root, p);
  await fsp.mkdir(abs, { recursive: true });
}

export async function rename(root, { from, to }) {
  const a = await resolveIn(root, from);
  const b = await resolveIn(root, to);
  await fsp.mkdir(path.dirname(b), { recursive: true });
  await fsp.rename(a, b);
}

export async function remove(root, { path: p }) {
  const abs = await resolveIn(root, p);
  if (abs === root) throw new Error("Refusing to delete workspace root");
  await fsp.rm(abs, { recursive: true, force: true });
}

export async function stat(root, { path: p }) {
  const abs = await resolveIn(root, p);
  const st = await fsp.lstat(abs);
  return {
    size: st.size,
    mtime: Math.floor(st.mtimeMs),
    kind: entryKind(st),
    is_dir: st.isDirectory(),
  };
}

async function* walk(root, start, { showHidden }) {
  const stack = [start];
  while (stack.length) {
    const dir = stack.pop();
    let names;
    try {
      names = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of names) {
      if (ALWAYS_SKIP.has(d.name)) continue;
      if (!showHidden && d.name.startsWith(".")) continue;
      const abs = path.join(dir, d.name);
      const isDir = d.isDirectory();
      yield { abs, name: d.name, isDir };
      if (isDir) stack.push(abs);
    }
  }
}

export async function search(root, { query, limit, showHidden }) {
  const max = limit ?? 200;
  const q = String(query ?? "").toLowerCase();
  const hits = [];
  let truncated = false;
  if (!q) return { hits, truncated };
  const start = await resolveIn(root, root);
  for await (const e of walk(start, start, { showHidden })) {
    if (e.name.toLowerCase().includes(q)) {
      hits.push({ path: e.abs, rel: rel(start, e.abs), name: e.name, is_dir: e.isDir });
      if (hits.length >= max) {
        truncated = true;
        break;
      }
    }
  }
  return { hits, truncated };
}

function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") re += "[^/]";
    else if ("\\^$.|+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export async function glob(root, { pattern, maxResults, showHidden }) {
  const max = maxResults ?? 1000;
  const re = globToRegExp(pattern);
  const hits = [];
  let truncated = false;
  const start = await resolveIn(root, root);
  for await (const e of walk(start, start, { showHidden: showHidden ?? false })) {
    if (e.isDir) continue;
    const r = rel(start, e.abs);
    if (re.test(r) || re.test(e.name)) {
      hits.push({ path: e.abs, rel: r });
      if (hits.length >= max) {
        truncated = true;
        break;
      }
    }
  }
  return { hits, truncated };
}

export async function grep(root, { pattern, root: reqRoot, glob: globs, caseInsensitive, maxResults }) {
  const base = await resolveIn(root, reqRoot || root);
  const max = maxResults ?? 1000;
  const flags = caseInsensitive ? "i" : "";
  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    throw new Error(`Invalid regex: ${e.message}`);
  }
  const globRes = (globs ?? []).map(globToRegExp);
  const matchGlob = (r) => globRes.length === 0 || globRes.some((g) => g.test(r));
  const hits = [];
  let filesScanned = 0;
  let truncated = false;
  outer: for await (const e of walk(base, base, { showHidden: false })) {
    if (e.isDir) continue;
    const r = rel(base, e.abs);
    if (!matchGlob(r)) continue;
    let buf;
    try {
      const st = await fsp.stat(e.abs);
      if (st.size > MAX_FILE) continue;
      buf = await fsp.readFile(e.abs);
    } catch {
      continue;
    }
    if (buf.subarray(0, Math.min(buf.length, 8000)).includes(0)) continue;
    filesScanned++;
    const lines = buf.toString("utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ path: e.abs, rel: r, line: i + 1, text: lines[i].slice(0, 1000) });
        if (hits.length >= max) {
          truncated = true;
          break outer;
        }
      }
    }
  }
  return { hits, truncated, files_scanned: filesScanned };
}
