import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const next = url.searchParams.get("next") || "/feed";
      const authError = url.searchParams.get("error_description") || url.searchParams.get("error");

      if (authError) {
        setError(authError);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            // Hash tokens are parsed asynchronously by the client.
            await new Promise((resolve) => setTimeout(resolve, 400));
            const again = await supabase.auth.getSession();
            if (!again.data.session) {
              throw new Error("Confirmation finished, but no session was created. Try signing in.");
            }
          }
        }
        if (!cancelled) navigate(next, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not finish authentication.");
        }
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1>Signing you in…</h1>
      {error ? (
        <div className="panel">
          <p className="error">{error}</p>
          <p className="muted">
            <Link to="/auth/sign-in">Back to sign in</Link>
          </p>
        </div>
      ) : (
        <p className="muted">Please wait a moment.</p>
      )}
    </main>
  );
}
``