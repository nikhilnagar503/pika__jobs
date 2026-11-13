import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type ArchivedJob = {
  jobId: string;
  title: string;
  companyName: string;
  locationLabel: string;
  opportunityKind: string;
  lifecycle: string;
  archiveReason?: string;
  archivedAt?: string;
};

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminArchivePage() {
  const [items, setItems] = useState<ArchivedJob[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ items: ArchivedJob[] }>("/api/v1/admin/jobs?scope=archive")
      .then((body) => {
        const sorted = [...body.items].sort((a, b) => {
          const aTime = new Date(a.archivedAt || 0).getTime();
          const bTime = new Date(b.archivedAt || 0).getTime();
          return bTime - aTime;
        });
        setItems(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load archive."));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((job) =>
      [job.title, job.companyName, job.locationLabel, job.archiveReason, job.lifecycle]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, q]);

  const deletedCount = items.filter((job) => job.archiveReason === "Deleted by admin" || job.lifecycle === "removed").length;
  const expiredCount = items.filter((job) => job.archiveReason === "visibility_cutoff").length;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Archive</h1>
          <p className="muted">
            Jobs leave the live feed after 14 days, or when you delete them. Students do not see this list.
          </p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="import-count-grid">
        <div className="import-count">
          <strong>{items.length}</strong>
          <span>In archive</span>
        </div>
        <div className="import-count is-blocked">
          <strong>{deletedCount}</strong>
          <span>Deleted by admin</span>
        </div>
        <div className="import-count">
          <strong>{expiredCount}</strong>
          <span>Expired after 14 days</span>
        </div>
        <div className="import-count">
          <strong>{items.length - deletedCount - expiredCount}</strong>
          <span>Other</span>
        </div>
      </div>

      <label className="field">
        Search archive
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, role, reason…" />
      </label>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Why it left the feed</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.jobId}>
                <td>
                  <strong>{job.companyName}</strong>
                  <div className="meta">{job.opportunityKind} · {job.locationLabel || "Location not stated"}</div>
                </td>
                <td>{job.title}</td>
                <td>{job.archiveReason || job.lifecycle}</td>
                <td>
                  {formatWhen(job.archivedAt)}
                  <div className="meta">{formatRelativeTime(job.archivedAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="muted">No archived jobs match this search.</p>}
    </div>
  );
}
