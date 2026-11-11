import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

type AdminJob = {
  jobId: string;
  title: string;
  companyName: string;
  lifecycle: string;
  accessTier: string;
};

export function AdminJobsPage() {
  const [items, setItems] = useState<AdminJob[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  const load = useCallback(() => {
    Promise.all([
      api<{ items: AdminJob[] }>("/api/v1/admin/jobs"),
      api<{ items: AdminJob[] }>("/api/v1/admin/jobs?scope=review"),
    ])
      .then(([current, drafts]) => {
        setItems([...current.items, ...drafts.items]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeJob(job: AdminJob) {
    const ok = window.confirm(`Remove "${job.title}" at ${job.companyName} from the live platform?`);
    if (!ok) return;
    setPendingId(job.jobId);
    setError("");
    try {
      await api(`/api/v1/admin/jobs/${job.jobId}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.jobId !== job.jobId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove job.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">Live and draft listings. Remove is admin-only.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn-ghost" to="/admin/jobs/import">Import JSON</Link>
          <Link className="btn-primary" to="/admin/jobs/new">Post a job</Link>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="admin-job-list">
        {items.map((job) => (
          <article className="admin-job-card" key={job.jobId}>
            <div>
              <h2>{job.title}</h2>
              <p className="meta">{job.companyName} · {job.lifecycle} · {job.accessTier}</p>
            </div>
            <div className="admin-job-actions">
              <button
                className="btn-ghost"
                type="button"
                disabled={pendingId === job.jobId}
                onClick={() => removeJob(job)}
              >
                {pendingId === job.jobId ? "Removing…" : "Remove"}
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="muted">No live or draft jobs right now.</p>}
      </div>
    </div>
  );
}
