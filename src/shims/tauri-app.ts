import { getSession } from "./session";

const VERSION = "0.6.4";

export async function getVersion(): Promise<string> {
  return VERSION;
}

export async function getName(): Promise<string> {
  try {
    return (await getSession()).name;
  } catch {
    return "Terax";
  }
}

export async function getTauriVersion(): Promise<string> {
  return "0.0.0-web";
}
