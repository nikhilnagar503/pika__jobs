import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

const STATS: Array<{ key: string; label: string; to?: string }> = [
  { key: "liveJobs", label: "Live on feed", to: "/admin/feed?lifecycle=published" },
  { key: "pendingReview", label: "Drafts (not live yet)", to: "/admin/feed?lifecycle=draft" },
  { key: "archived", label: "Archived / deleted", to: "/admin/archive" },
  { key: "members", label: "Members (sign-ups)", to: "/admin/members" },
];

export function AdminOverviewPage() {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Record<string, number>>("/api/v1/admin/overview")
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load overview."));
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Overview</h1>
          <p className="muted">Click a number to open that list. Drafts need Publish. Archive is deleted or expired jobs. Members are sign-ups.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/feed?lifecycle=draft">Open drafts</Link>
          <Link className="btn-primary" to="/admin/jobs/new">Post a job</Link>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="admin-stat-grid">
        {overview &&
          STATS.map((stat) => {
            const value = overview[stat.key];
            if (value == null) return null;
            const inner = (
              <>
                <p className="meta">{stat.label}</p>
                <strong>{value}</strong>
              </>
            );
            return stat.to ? (
              <Link className="admin-stat" key={stat.key} to={stat.to}>
                {inner}
              </Link>
            ) : (
              <div className="admin-stat" key={stat.key}>
                {inner}
              </div>
            );
          })}
      </div>
    </div>
  );
}
