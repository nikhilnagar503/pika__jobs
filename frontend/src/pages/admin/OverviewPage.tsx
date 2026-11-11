import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

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
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/feed">Admin feed</Link>
          <Link className="btn-primary" to="/admin/jobs/new">Post a job</Link>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="admin-stat-grid">
        {overview &&
          Object.entries(overview).map(([key, value]) => (
            <div className="admin-stat" key={key}>
              <p className="meta">{key}</p>
              <strong>{value}</strong>
            </div>
          ))}
      </div>
    </div>
  );
}
