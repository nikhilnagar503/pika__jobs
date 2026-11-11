import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/config";

const memberLinks = [
  ["/feed", "Feed"],
  ["/saved", "Saved"],
  ["/activity", "Activity"],
  ["/account", "Account"],
] as const;

export function PublicShell() {
  const { user } = useAuth();
  return (
    <>
      <header className="wrap topbar">
        <Link className="wordmark" to="/">Pikajobs</Link>
        <nav className="nav-links">
          <Link to="/pricing">Pricing</Link>
          {user ? (
            <Link className="btn-primary" to="/feed">Open feed</Link>
          ) : (
            <>
              <Link to="/auth/sign-in">Sign in</Link>
              <Link className="btn-primary" to="/auth/sign-up">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
    </>
  );
}

export function MemberShell() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  return (
    <div className="app">
      <nav className="side" aria-label="Account">
        <Link className="wordmark" to="/feed">Pikajobs</Link>
        {memberLinks.map(([href, label]) => (
          <NavLink key={href} to={href}>{label}</NavLink>
        ))}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <main id="main" className="feed">
        <Outlet />
      </main>
      <aside className="rail">
        <div className="panel">
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Fresh listings</h2>
          <p className="muted">Feed shows the newest roles first. Only the last 14 days stay live.</p>
        </div>
      </aside>
      <nav className="bottom" aria-label="Mobile">
        {memberLinks.map(([href, label]) => (
          <NavLink key={href} to={href}>{label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
