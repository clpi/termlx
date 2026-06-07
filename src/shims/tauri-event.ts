export type UnlistenFn = () => void;
export type EventCallback<T> = (event: { event: string; id: number; payload: T }) => void;

const channel = new BroadcastChannel("terax-events");
const listeners = new Map<string, Set<EventCallback<any>>>();
let idSeq = 1;

function dispatch(event: string, payload: unknown) {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) cb({ event, id: idSeq++, payload: payload as any });
}

channel.onmessage = (e) => {
  const { event, payload } = e.data || {};
  if (typeof event === "string") dispatch(event, payload);
};

export async function emit(event: string, payload?: unknown): Promise<void> {
  // BroadcastChannel does not deliver to the sender, so dispatch locally too.
  dispatch(event, payload);
  channel.postMessage({ event, payload });
}

export async function listen<T>(
  event: string,
  handler: EventCallback<T>,
): Promise<UnlistenFn> {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
  };
}

export async function once<T>(
  event: string,
  handler: EventCallback<T>,
): Promise<UnlistenFn> {
  const un = await listen<T>(event, (e) => {
    un();
    handler(e);
  });
  return un;
}
