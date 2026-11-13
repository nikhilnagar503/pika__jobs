import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";

function GoogleButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontWeight: 500,
        marginBottom: 4,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      {label}
    </button>
  );
}

function OrDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        margin: "16px 0",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 13, color: "var(--muted)" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

export function SignInPage() {
  const { signIn, signInWithGoogle, user, configured } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") || "/feed";

  if (user) return <Navigate to={next} replace />;

  async function onGoogleClick() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1>Sign in</h1>
      {!configured && <p className="error">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env</p>}
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <GoogleButton label="Continue with Google" loading={loading} onClick={onGoogleClick} />
        <OrDivider />
        <form onSubmit={onSubmit}>
          <label className="field">Email<input name="email" type="email" required /></label>
          <label className="field">Password<input name="password" type="password" required minLength={6} /></label>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in with email"}
          </button>
        </form>
      </div>
      <p className="muted">No account? <Link to="/auth/sign-up">Sign up</Link></p>
    </main>
  );
}

export function SignUpPage() {
  const { signUp, signInWithGoogle, user, configured } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const navigate = useNavigate();

  if (user) return <Navigate to="/feed" replace />;

  async function onGoogleClick() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up with Google.");
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    try {
      const result = await signUp(email, String(data.get("password")), String(data.get("name") || ""));
      if (result.needsEmailConfirmation) {
        setPendingEmail(email);
        return;
      }
      navigate("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up.");
    } finally {
      setLoading(false);
    }
  }

  if (pendingEmail) {
    return (
      <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
        <h1>Check your email</h1>
        <div className="panel">
          <p>
            We sent a confirmation link to <strong>{pendingEmail}</strong>.
          </p>
          <p className="muted">Open that email, confirm your account, then sign in.</p>
          <p className="muted">If nothing arrives in a minute, check spam — or confirm Resend/Supabase SMTP is verified.</p>
        </div>
        <p className="muted">
          Ready? <Link to="/auth/sign-in">Sign in</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1>Create account</h1>
      {!configured && <p className="error">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env</p>}
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <GoogleButton label="Continue with Google" loading={loading} onClick={onGoogleClick} />
        <OrDivider />
        <form onSubmit={onSubmit}>
          <label className="field">Name<input name="name" required /></label>
          <label className="field">Email<input name="email" type="email" required /></label>
          <label className="field">Password<input name="password" type="password" required minLength={6} /></label>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Creating…" : "Sign up with email"}
          </button>
        </form>
      </div>
      <p className="muted">Already have an account? <Link to="/auth/sign-in">Sign in</Link></p>
    </main>
  );
}