export async function relaunch(): Promise<void> {
  location.reload();
}

export async function exit(_code?: number): Promise<void> {
  window.close();
}
