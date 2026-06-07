export type Platform = "linux" | "macos" | "windows" | "ios" | "android";

export function platform(): Platform {
  return "linux";
}

export function arch(): string {
  return "x86_64";
}

export function type(): string {
  return "Linux";
}

export function version(): string {
  return "web";
}

export function family(): string {
  return "unix";
}
