import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type AuthState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      configured: supabaseConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/email not confirmed/i.test(error.message)) {
            throw new Error("Confirm your email first. Check your inbox for the Pikajobs link.");
          }
          throw error;
        }
      },
      async signUp(email, password, displayName) {
        if (!supabase) throw new Error("Supabase is not configured.");
        // Always send confirmation links to the real domain — never a Vercel preview URL.
        const appOrigin =
          import.meta.env.VITE_APP_URL?.replace(/\/$/, "") ||
          (window.location.hostname.endsWith("pikajobs.com")
            ? window.location.origin
            : "https://pikajobs.com");
        const redirectTo = `${appOrigin}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { display_name: displayName, adult_confirmed: true },
          },
        });
        if (error) throw error;
        // Supabase returns an empty identities list when the email is already registered.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Sign in instead.");
        }
        return { needsEmailConfirmation: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
