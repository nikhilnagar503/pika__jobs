import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/config";

export function AdminLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/admin" replace />;
  if (user.email?.toLowerCase() !== ADMIN_EMAIL) return <Navigate to="/feed" replace />;

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <Link className="wordmark" to="/admin">Pikajobs Admin</Link>
          <p className="meta">{ADMIN_EMAIL}</p>
        </div>
        <div className="admin-nav-group">
          <p className="admin-nav-label">Operate</p>
          <NavLink to="/admin" end>Overview</NavLink>
          <NavLink to="/admin/feed">Admin feed</NavLink>
          <NavLink to="/admin/jobs" end>Jobs list</NavLink>
          <NavLink to="/admin/jobs/new">Post a job</NavLink>
          <NavLink to="/admin/jobs/import">Import JSON</NavLink>
        </div>
        <Link className="admin-exit" to="/feed">Exit to feed</Link>
      </aside>
      <main id="main" className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
