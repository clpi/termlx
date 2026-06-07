export type SessionInfo = { home: string; platform: string; name: string };

let cached: Promise<SessionInfo> | null = null;

/** Fetch (and cache) the current user's session info. Calling this guarantees
 *  the `terax_sid` cookie is set before any WebSocket (PTY) connects. */
export function getSession(): Promise<SessionInfo> {
  if (!cached) {
    cached = fetch("/api/session", { credentials: "same-origin" }).then((r) => {
      if (!r.ok) throw new Error(`session failed: ${r.status}`);
      return r.json();
    });
  }
  return cached;
}
