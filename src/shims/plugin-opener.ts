export async function openUrl(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openPath(_path: string): Promise<void> {
  // No OS file association on the web.
}

export async function revealItemInDir(_path: string): Promise<void> {
  // No native file manager on the web; no-op.
}
