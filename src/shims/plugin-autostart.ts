const KEY = "terax:autostart";

export async function enable(): Promise<void> {
  localStorage.setItem(KEY, "1");
}

export async function disable(): Promise<void> {
  localStorage.removeItem(KEY);
}

export async function isEnabled(): Promise<boolean> {
  return localStorage.getItem(KEY) === "1";
}
