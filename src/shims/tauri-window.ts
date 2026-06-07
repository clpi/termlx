import { listen, type UnlistenFn } from "./tauri-event";

/** Browser stand-in for a Tauri window. Most controls are no-ops on the web;
 *  close() closes the tab/window when permitted. */
class WebWindow {
  label: string;
  constructor(label = "main") {
    this.label = label;
  }
  async show(): Promise<void> {}
  async hide(): Promise<void> {}
  async setFocus(): Promise<void> {
    window.focus();
  }
  async minimize(): Promise<void> {}
  async maximize(): Promise<void> {}
  async unmaximize(): Promise<void> {}
  async toggleMaximize(): Promise<void> {}
  async isMaximized(): Promise<boolean> {
    return false;
  }
  async close(): Promise<void> {
    window.close();
  }
  async onResized(_cb: () => void): Promise<UnlistenFn> {
    return () => {};
  }
  async onCloseRequested(_cb: () => void): Promise<UnlistenFn> {
    return () => {};
  }
  async listen<T>(event: string, handler: (e: { event: string; payload: T }) => void) {
    return listen<T>(event, handler);
  }
}

const current = new WebWindow("main");

export function getCurrentWindow(): WebWindow {
  return current;
}

export { WebWindow as Window };
