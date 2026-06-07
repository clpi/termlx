import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/modules/profile/api";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type AuthState = {
  /** Logged-in email, or null for a guest. */
  email: string | null;
  /** The signed-in user's profile, or null for a guest. */
  profile: Profile | null;
  /** Whether a login is mandatory (TERAX_REQUIRE_AUTH on the server). */
  requireAuth: boolean;
  /** Open the sign-in dialog. */
  signIn: () => void;
  /** End the session and return to guest mode. */
  signOut: () => Promise<void>;
  /** Replace the cached profile (e.g. after an edit). */
  setProfile: (p: Profile) => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** Access auth + profile state. Valid anywhere inside <AuthGate>. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthGate");
  return ctx;
}

type Me = {
  email: string | null;
  requireAuth: boolean;
  profile: Profile | null;
};

type Status =
  | { kind: "loading" }
  | { kind: "ready"; me: Me };

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setStatus({
          kind: "ready",
          me: {
            email: d?.email ?? null,
            requireAuth: !!d?.requireAuth,
            profile: d?.profile ?? null,
          },
        });
      })
      .catch(
        () =>
          alive &&
          setStatus({
            kind: "ready",
            me: { email: null, requireAuth: false, profile: null },
          }),
      );
    return () => {
      alive = false;
    };
  }, []);

  const onAuthed = (me: { email: string; profile: Profile | null }) => {
    setStatus((s) =>
      s.kind === "ready"
        ? { kind: "ready", me: { ...s.me, email: me.email, profile: me.profile } }
        : s,
    );
    setShowAuth(false);
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    setStatus((s) =>
      s.kind === "ready"
        ? { kind: "ready", me: { ...s.me, email: null, profile: null } }
        : s,
    );
  };

  const setProfile = (p: Profile) => {
    setStatus((s) =>
      s.kind === "ready" ? { kind: "ready", me: { ...s.me, profile: p } } : s,
    );
  };

  if (status.kind === "loading") {
    return <div className="h-screen w-screen bg-background" />;
  }

  const { me } = status;
  const mustLogin = me.requireAuth && !me.email;

  // When login is mandatory and absent, block the whole app behind the screen.
  if (mustLogin) {
    return (
      <AuthScreen
        onAuthed={onAuthed}
        onCancel={null}
        requireAuth
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        email: me.email,
        profile: me.profile,
        requireAuth: me.requireAuth,
        signIn: () => setShowAuth(true),
        signOut,
        setProfile,
      }}
    >
      {children}
      {showAuth && (
        <AuthScreen
          onAuthed={onAuthed}
          onCancel={() => setShowAuth(false)}
          requireAuth={false}
        />
      )}
    </AuthContext.Provider>
  );
}

function AuthScreen({
  onAuthed,
  onCancel,
  requireAuth,
}: {
  onAuthed: (me: { email: string; profile: Profile | null }) => void;
  onCancel: (() => void) | null;
  requireAuth: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      // Pull the freshly-created/loaded profile so the UI updates immediately.
      const me = await fetch("/api/auth/me", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      onAuthed({ email: data.email, profile: me?.profile ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <form
      onSubmit={submit}
      className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 shadow-xl"
    >
      <h1 className="text-xl font-semibold tracking-tight">Terax</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {mode === "login"
          ? "Sign in to your account"
          : "Create an account to get started"}
      </p>

      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        Email
      </label>
      <Input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mb-4"
      />

      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        Password
      </label>
      <Input
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
        className="mb-4"
      />

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full rounded-3xl">
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </Button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "login" ? "No account yet? " : "Already have an account? "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {!requireAuth && onCancel && (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <button
            type="button"
            className="font-medium underline-offset-4 hover:underline"
            onClick={onCancel}
          >
            Continue without signing in
          </button>
        </p>
      )}
    </form>
  );

  // Mandatory mode: full-screen. Optional mode: dismissible modal overlay.
  if (requireAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none">
        {card}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-foreground select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      {card}
    </div>
  );
}
