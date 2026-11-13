import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/config";

type Account = {
  displayName: string;
  email: string;
  countryCode: string;
  roles: string[];
};

export function AccountPage() {
  const { user, ready, signOut } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api<Account>("/api/v1/me")
      .then(setAccount)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load account."));
  }, [user]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/account" replace />;

  const isAdmin = (account?.email || user.email || "").toLowerCase() === ADMIN_EMAIL;
  const initials = (account?.displayName || user.email || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  async function onDeleteAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account? All your saved jobs, preferences, and data will be removed. This action cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      await api("/api/v1/me", { method: "DELETE" });
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account.");
      setDeleting(false);
    }
  }

  return (
    <div className="account">
      <header className="account-hero">
        <div className="account-avatar" aria-hidden="true">{initials || "?"}</div>
        <div>
          <p className="eyebrow">Your account</p>
          <h1>{account?.displayName || "Member"}</h1>
          <p className="muted">{account?.email || user.email}</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="account-grid">
        <article className="account-card">
          <h2>Membership</h2>
          <p>Free member access</p>
          <p className="muted">Country: {account?.countryCode || "IN"}</p>
        </article>
        <article className="account-card">
          <h2>Shortcuts</h2>
          <div className="account-links">
            <Link to="/feed">Open feed</Link>
            <Link to="/saved">Saved listings</Link>
            <Link to="/activity">Activity</Link>
          </div>
        </article>
        <article className="account-card">
          <h2>Access</h2>
          <p className="muted">{account?.roles?.length ? account.roles.join(", ") : "Member"}</p>
          {isAdmin && <Link className="btn-primary" to="/admin">Open admin workspace</Link>}
        </article>
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button className="btn-ghost" type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 32,
          border: "1px solid #fecaca",
          background: "#fff5f5",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, color: "#991b1b", margin: "0 0 8px" }}>Danger Zone</h2>
        <p className="muted" style={{ margin: "0 0 16px" }}>
          Permanently delete your Pikajobs account and all associated saved listings and preferences.
        </p>
        <button
          className="btn-danger"
          type="button"
          onClick={onDeleteAccount}
          disabled={deleting}
        >
          {deleting ? "Deleting account…" : "Delete account"}
        </button>
      </section>
    </div>
  );
}
