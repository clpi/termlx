type ChangeCb<T> = (value: T | undefined) => void;

const sync = new BroadcastChannel("terax-store-sync");

/** Browser LazyStore backed by the per-session server store. Values are cached
 *  in memory after first load; writes go through to the server and broadcast to
 *  other tabs (e.g. the settings window) so caches stay consistent. */
export class LazyStore {
  private file: string;
  private cache: Record<string, unknown> | null = null;
  private loading: Promise<void> | null = null;
  private changeCbs = new Map<string, Set<ChangeCb<any>>>();

  constructor(file: string) {
    this.file = file;
    sync.addEventListener("message", (e) => {
      const m = e.data;
      if (!m || m.file !== this.file) return;
      if (this.cache) {
        if (m.op === "set") this.cache[m.key] = m.value;
        else if (m.op === "delete") delete this.cache[m.key];
        else if (m.op === "clear") this.cache = {};
      }
      if (m.op === "set" || m.op === "delete") {
        this.notify(m.key, m.op === "set" ? m.value : undefined);
      }
    });
  }

  private async ensure(): Promise<void> {
    if (this.cache) return;
    if (!this.loading) {
      this.loading = fetch(`/api/store?file=${encodeURIComponent(this.file)}`, {
        credentials: "same-origin",
      })
        .then((r) => r.json())
        .then((j) => {
          this.cache = j.data ?? {};
        })
        .catch(() => {
          this.cache = {};
        });
    }
    await this.loading;
  }

  private notify(key: string, value: unknown) {
    const set = this.changeCbs.get(key);
    if (set) for (const cb of set) cb(value);
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensure();
    return this.cache![key] as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensure();
    this.cache![key] = value;
    sync.postMessage({ file: this.file, op: "set", key, value });
    this.notify(key, value);
    await fetch("/api/store/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ file: this.file, key, value }),
    });
  }

  async delete(key: string): Promise<boolean> {
    await this.ensure();
    const existed = key in this.cache!;
    delete this.cache![key];
    sync.postMessage({ file: this.file, op: "delete", key });
    this.notify(key, undefined);
    await fetch("/api/store/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ file: this.file, key }),
    });
    return existed;
  }

  async has(key: string): Promise<boolean> {
    await this.ensure();
    return key in this.cache!;
  }

  async keys(): Promise<string[]> {
    await this.ensure();
    return Object.keys(this.cache!);
  }

  async values<T>(): Promise<T[]> {
    await this.ensure();
    return Object.values(this.cache!) as T[];
  }

  async entries<T>(): Promise<[string, T][]> {
    await this.ensure();
    return Object.entries(this.cache!) as [string, T][];
  }

  async length(): Promise<number> {
    await this.ensure();
    return Object.keys(this.cache!).length;
  }

  async clear(): Promise<void> {
    this.cache = {};
    sync.postMessage({ file: this.file, op: "clear" });
    await fetch("/api/store/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ file: this.file }),
    });
  }

  async save(): Promise<void> {
    // Writes are persisted server-side immediately; nothing to flush.
  }

  async reload(): Promise<void> {
    this.cache = null;
    this.loading = null;
    await this.ensure();
  }

  async onChange<T>(cb: (key: string, value: T | undefined) => void): Promise<() => void> {
    // Adapt key/value change callback shape used by some callers.
    const wrapped: ChangeCb<T> = () => {};
    void wrapped;
    const handler = (e: MessageEvent) => {
      const m = e.data;
      if (!m || m.file !== this.file) return;
      if (m.op === "set") cb(m.key, m.value);
      else if (m.op === "delete") cb(m.key, undefined);
    };
    sync.addEventListener("message", handler);
    return () => sync.removeEventListener("message", handler);
  }

  async onKeyChange<T>(key: string, cb: ChangeCb<T>): Promise<() => void> {
    let set = this.changeCbs.get(key);
    if (!set) {
      set = new Set();
      this.changeCbs.set(key, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }
}

export const Store = LazyStore;
