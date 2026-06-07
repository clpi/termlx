import { getCurrentWindow, Window } from "./tauri-window";

export function getCurrentWebviewWindow(): Window {
  return getCurrentWindow();
}

export { Window as WebviewWindow };
