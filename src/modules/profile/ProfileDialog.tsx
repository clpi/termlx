import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/auth/AuthGate";
import { useEffect, useRef, useState } from "react";
import {
  AVATAR_COLORS,
  fetchUsers,
  removeAvatar,
  updateProfile,
  uploadAvatar,
  type Profile,
} from "./api";
import { Avatar } from "./Avatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, setProfile } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            How you appear across Terax and on the game leaderboards.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="me">
          <TabsList className="w-full">
            <TabsTrigger value="me" className="flex-1">
              My profile
            </TabsTrigger>
            <TabsTrigger value="people" className="flex-1">
              People
            </TabsTrigger>
          </TabsList>
          <TabsContent value="me" className="mt-4">
            {profile ? (
              <ProfileEditor profile={profile} onSaved={setProfile} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sign in to set up your profile.
              </p>
            )}
          </TabsContent>
          <TabsContent value="people" className="mt-4">
            <PeopleDirectory open={open} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [color, setColor] = useState(profile.avatarColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setColor(profile.avatarColor);
  }, [profile]);

  const preview: Profile = { ...profile, displayName, avatarColor: color };

  const run = async (fn: () => Promise<Profile>, ok: string) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      onSaved(await fn());
      setStatus(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void run(
      () => updateProfile({ displayName, bio, avatarColor: color }),
      "Saved.",
    );
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image too large (max 2MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      void run(() => uploadAvatar(String(reader.result)), "Avatar updated.");
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar profile={preview} size={64} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onPickFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload image
          </Button>
          {profile.hasAvatar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(removeAvatar, "Avatar removed.")}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs">Badge color</Label>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`size-6 rounded-md transition-transform hover:scale-110 ${
                color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
              }`}
            />
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="displayName" className="mb-1.5 block text-xs">
          Display name
        </Label>
        <Input
          id="displayName"
          value={displayName}
          maxLength={40}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div>
        <Label htmlFor="bio" className="mb-1.5 block text-xs">
          Bio
        </Label>
        <Textarea
          id="bio"
          value={bio}
          maxLength={280}
          rows={3}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short line about you (optional)"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {bio.length}/280
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="text-sm text-emerald-500">{status}</p>
      )}

      <div className="flex items-center justify-between">
        {profile.email && (
          <span className="truncate text-xs text-muted-foreground">
            {profile.email}
          </span>
        )}
        <Button type="submit" disabled={busy} className="ml-auto">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function PeopleDirectory({ open }: { open: boolean }) {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError(null);
    fetchUsers()
      .then((u) => alive && setUsers(u))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [open]);

  if (error) {
    return <p className="py-6 text-center text-sm text-destructive">{error}</p>;
  }
  if (!users) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
    );
  }
  if (users.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No one has signed up yet.
      </p>
    );
  }

  return (
    <ScrollArea className="h-72 pr-3">
      <ul className="space-y-1">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent"
          >
            <Avatar profile={u} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{u.displayName}</p>
              {u.bio && (
                <p className="text-xs text-muted-foreground">{u.bio}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
