import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FeedFilters } from "@/components/FeedFilters";
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
      <footer className="wrap footer">
        <p>© {new Date().getFullYear()} Pikajobs. Curated opportunities.</p>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </div>
      </footer>
    </>
  );
}

export function MemberShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const isFeed = location.pathname === "/feed";
  return (
    <div className={isFeed ? "app" : "app app-no-rail"}>
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
      {isFeed && (
        <aside className="rail" aria-label="Filters">
          <div className="panel feed-filter-panel">
            <FeedFilters />
          </div>
        </aside>
      )}
      <nav className="bottom" aria-label="Mobile">
        {memberLinks.map(([href, label]) => (
          <NavLink key={href} to={href}>{label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
