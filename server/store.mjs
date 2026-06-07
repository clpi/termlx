import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

function safeName(file) {
  return String(file).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function fileFor(storesDir, file) {
  return path.join(storesDir, safeName(file));
}

export function storeLoad(storesDir, file) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(storesDir, file), "utf8"));
  } catch {
    return {};
  }
}

async function persist(storesDir, file, data) {
  const target = fileFor(storesDir, file);
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, JSON.stringify(data), "utf8");
  await fsp.rename(tmp, target);
}

export async function storeSet(storesDir, { file, key, value }) {
  const data = storeLoad(storesDir, file);
  data[key] = value;
  await persist(storesDir, file, data);
  return true;
}

export async function storeDelete(storesDir, { file, key }) {
  const data = storeLoad(storesDir, file);
  delete data[key];
  await persist(storesDir, file, data);
  return true;
}

export async function storeClear(storesDir, { file }) {
  await persist(storesDir, file, {});
  return true;
}
