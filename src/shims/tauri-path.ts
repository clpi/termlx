import { getSession } from "./session";

export async function homeDir(): Promise<string> {
  return (await getSession()).home;
}

export async function appDataDir(): Promise<string> {
  return (await getSession()).home;
}

export async function appConfigDir(): Promise<string> {
  return (await getSession()).home;
}

export const sep = "/";

export async function join(...parts: string[]): Promise<string> {
  return parts
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";
}
