import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL } from "./config";
import { clearSession, loadSession, saveSession, type StoredSession } from "./tokenStore";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; session: StoredSession };

type Auth = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Create an account (as a member) and sign in. Returns an error message, or null. */
  join: (input: { name: string; email: string; password: string; title: string }) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    loadSession().then((session) => setState(session ? { status: "signedIn", session } : { status: "signedOut" }));
  }, []);

  /** Returns an error message to show, or null on success. */
  const signIn = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return `Can't reach the server at ${API_URL}. Check that npm run dev is running and your phone is on the same Wi-Fi.`;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return json.error ?? "Sign-in failed. Try again.";
    const session: StoredSession = { token: json.token, userId: json.userId, expiresAt: json.expiresAt };
    await saveSession(session);
    setState({ status: "signedIn", session });
    return null;
  }, []);

  const join = useCallback(async (input: { name: string; email: string; password: string; title: string }) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/auth/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      return `Can't reach the server at ${API_URL}. Check your connection and try again.`;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return json.error ?? "Couldn't create your account. Try again.";
    const session: StoredSession = { token: json.token, userId: json.userId, expiresAt: json.expiresAt };
    await saveSession(session);
    setState({ status: "signedIn", session });
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setState({ status: "signedOut" });
  }, []);

  const value = useMemo(() => ({ state, signIn, join, signOut }), [state, signIn, join, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
