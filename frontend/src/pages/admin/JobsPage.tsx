import { useEffect, useState } from "react";
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

  useEffect(() => {
    api<{ items: AdminJob[] }>("/api/v1/admin/jobs")
      .then((body) => setItems(body.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."));
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">Current listings in the API store.</p>
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
          </article>
        ))}
      </div>
    </div>
  );
}
