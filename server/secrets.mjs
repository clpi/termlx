import fs from "node:fs";
import fsp from "node:fs/promises";

function load(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

async function save(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, JSON.stringify(data), "utf8");
  await fsp.rename(tmp, file);
}

function key(service, account) {
  return `${service}\u0000${account}`;
}

export function secretsGet(file, { service, account }) {
  const data = load(file);
  const v = data[key(service, account)];
  return v === undefined ? null : v;
}

export async function secretsSet(file, { service, account, password }) {
  const data = load(file);
  data[key(service, account)] = password;
  await save(file, data);
  return true;
}

export async function secretsDelete(file, { service, account }) {
  const data = load(file);
  delete data[key(service, account)];
  await save(file, data);
  return true;
}

/** Return the stored passwords for a list of accounts under one service. */
export function secretsGetAll(file, { service, accounts }) {
  const data = load(file);
  const list = accounts ?? [];
  return list.map((account) => {
    const v = data[key(service, account)];
    return v === undefined ? null : v;
  });
}
