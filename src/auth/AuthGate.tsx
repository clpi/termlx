import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type AuthState = { email: string; signOut: () => Promise<void> };

const AuthContext = createContext<AuthState | null>(null);

/** Access the signed-in user. Only valid inside the authed app tree. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthGate");
  return ctx;
}

type Status =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "in"; email: string };

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setStatus(d?.email ? { kind: "in", email: d.email } : { kind: "out" });
      })
      .catch(() => alive && setStatus({ kind: "out" }));
    return () => {
      alive = false;
    };
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    setStatus({ kind: "out" });
  };

  if (status.kind === "loading") {
    return <div className="h-screen w-screen bg-background" />;
  }

  if (status.kind === "out") {
    return <AuthScreen onAuthed={(email) => setStatus({ kind: "in", email })} />;
  }

  return (
    <AuthContext.Provider value={{ email: status.email, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (email: string) => void }) {
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
      onAuthed(data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 shadow-xl"
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
      </form>
    </div>
  );
}
