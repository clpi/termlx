import { getSession } from "./session";

/** Tauri Channel replacement: a simple settable-onmessage sink. */
export class Channel<T = unknown> {
  onmessage: ((msg: T) => void) | null = null;
  id = Channel.nextId++;
  private static nextId = 1;
}

// --- PTY over WebSocket ----------------------------------------------------

type PtyConn = { ws: WebSocket; onData: Channel<ArrayBuffer>; onExit: Channel<number> };
const ptyConns = new Map<number, PtyConn>();
let ptyIdSeq = 1;

function wsUrl(path: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}

async function ptyOpen(args: any): Promise<number> {
  // Ensure the session cookie exists before the WS handshake.
  await getSession();
  const id = ptyIdSeq++;
  const ws = new WebSocket(wsUrl("/ws/pty"));
  ws.binaryType = "arraybuffer";
  const onData: Channel<ArrayBuffer> = args.onData;
  const onExit: Channel<number> = args.onExit;
  ptyConns.set(id, { ws, onData, onExit });

  return new Promise<number>((resolve, reject) => {
    let opened = false;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "open",
          id,
          cols: args.cols ?? 80,
          rows: args.rows ?? 24,
          cwd: args.cwd ?? null,
        }),
      );
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "opened") {
          opened = true;
          resolve(id);
        } else if (msg.type === "exit") {
          onExit?.onmessage?.(msg.code ?? 0);
        } else if (msg.type === "error" && !opened) {
          reject(new Error(msg.message || "pty error"));
        }
      } else {
        onData?.onmessage?.(ev.data as ArrayBuffer);
      }
    };
    ws.onerror = () => {
      if (!opened) reject(new Error("pty websocket error"));
    };
    ws.onclose = () => {
      ptyConns.delete(id);
    };
  });
}

// --- AI streaming proxy ----------------------------------------------------

async function aiHttpStream(args: any): Promise<void> {
  const channel: Channel<any> = args.onEvent;
  const res = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      url: args.url,
      method: args.method,
      headers: args.headers,
      body: args.body,
    }),
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  channel?.onmessage?.({ kind: "headers", status: res.status, headers });
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) channel?.onmessage?.({ kind: "chunk", bytes: Array.from(value) });
    }
  }
  channel?.onmessage?.({ kind: "end" });
}

// --- generic invoke --------------------------------------------------------

/** Open (or refocus) the settings page in a dedicated window. On the desktop
 *  this was a native webview; on the web it's a same-origin popup window.
 *  Settings persist to the shared store and prefs sync back via BroadcastChannel. */
function openSettings(tab: string | null): void {
  const url = `/settings.html${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
  // A stable window name reuses the same popup and navigates it to the new tab.
  const win = window.open(url, "terax-settings", "width=920,height=680");
  win?.focus();
}

export async function invoke<T = unknown>(cmd: string, args: any = {}): Promise<T> {
  switch (cmd) {
    case "open_settings_window":
      openSettings(args?.tab ?? null);
      return undefined as T;
    case "pty_open":
      return ptyOpen(args) as Promise<T>;
    case "pty_write": {
      const c = ptyConns.get(args.id);
      if (c?.ws.readyState === WebSocket.OPEN) {
        c.ws.send(new TextEncoder().encode(args.data));
      }
      return undefined as T;
    }
    case "pty_resize": {
      const c = ptyConns.get(args.id);
      if (c?.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ type: "resize", cols: args.cols, rows: args.rows }));
      }
      return undefined as T;
    }
    case "pty_close": {
      const c = ptyConns.get(args.id);
      c?.ws.close();
      ptyConns.delete(args.id);
      return undefined as T;
    }
    case "ai_http_stream":
      return aiHttpStream(args) as Promise<T>;
  }

  // Strip non-serializable Channel instances before POSTing.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (!(v instanceof Channel)) clean[k] = v;
  }
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ cmd, args: clean }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `invoke ${cmd} failed`);
  return json.data as T;
}
