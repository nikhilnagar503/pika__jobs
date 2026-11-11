import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function SignInPage() {
  const { signIn, user, configured } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") || "/feed";

  if (user) return <Navigate to={next} replace />;

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
      <form onSubmit={onSubmit} className="panel">
        <label className="field">Email<input name="email" type="email" required /></label>
        <label className="field">Password<input name="password" type="password" required minLength={6} /></label>
        <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="muted">No account? <Link to="/auth/sign-up">Sign up</Link></p>
    </main>
  );
}

export function SignUpPage() {
  const { signUp, user, configured } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const navigate = useNavigate();

  if (user) return <Navigate to="/feed" replace />;

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
      <form onSubmit={onSubmit} className="panel">
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Email<input name="email" type="email" required /></label>
        <label className="field">Password<input name="password" type="password" required minLength={6} /></label>
        <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Creating…" : "Sign up"}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/auth/sign-in">Sign in</Link></p>
    </main>
  );
}
