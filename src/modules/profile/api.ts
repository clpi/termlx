export type Profile = {
  id: string;
  email?: string | null;
  displayName: string;
  bio: string;
  avatarColor: string;
  hasAvatar: boolean;
  avatarUpdatedAt: number | null;
  createdAt: number | null;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || (data as { ok?: boolean }).ok === false) {
    throw new Error(
      ((data as { error?: string }).error as string) ||
        "Something went wrong. Please try again.",
    );
  }
  return data as T;
}

export async function fetchUsers(): Promise<Profile[]> {
  const res = await fetch("/api/users", { credentials: "same-origin" });
  const data = await json<{ users: Profile[] }>(res);
  return data.users ?? [];
}

export async function updateProfile(fields: {
  displayName?: string;
  bio?: string;
  avatarColor?: string;
}): Promise<Profile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(fields),
  });
  const data = await json<{ profile: Profile }>(res);
  return data.profile;
}

export async function uploadAvatar(dataUrl: string): Promise<Profile> {
  const res = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ dataUrl }),
  });
  const data = await json<{ profile: Profile }>(res);
  return data.profile;
}

export async function removeAvatar(): Promise<Profile> {
  const res = await fetch("/api/profile/avatar", {
    method: "DELETE",
    credentials: "same-origin",
  });
  const data = await json<{ profile: Profile }>(res);
  return data.profile;
}

/** URL for an uploaded avatar image (cache-busted), or null for a badge. */
export function avatarSrc(p: Profile): string | null {
  if (!p.hasAvatar) return null;
  return `/api/profile/avatar/${p.id}?v=${p.avatarUpdatedAt ?? 0}`;
}

/** Up-to-two-letter initials derived from a display name. */
export function initialsOf(p: Pick<Profile, "displayName">): string {
  const parts = p.displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const one = parts[0] ?? "";
  return (one.slice(0, 2) || "?").toUpperCase();
}

/** Avatar badge palette offered in the profile editor. */
export const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];
