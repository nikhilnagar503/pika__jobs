import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/config";

type Account = {
  displayName: string;
  email: string;
  countryCode: string;
  proUntil: string | null;
  roles: string[];
};

export function AccountPage() {
  const { user, ready, signOut } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");

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
          <p>Plan: {account?.proUntil ? "Pro pass" : "Free"}</p>
          <p className="muted">Country: {account?.countryCode || "IN"}</p>
          <Link className="btn-ghost" to="/pricing">See Pro</Link>
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
      <button className="btn-ghost" type="button" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
