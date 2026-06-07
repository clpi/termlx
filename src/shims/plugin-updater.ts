export interface Update {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
  downloadAndInstall: (onEvent?: (e: unknown) => void) => Promise<void>;
}

/** The web build has no auto-updater; report "up to date". */
export async function check(): Promise<Update | null> {
  return null;
}
