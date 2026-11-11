import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState("");

  const load = useCallback(() => {
    Promise.all([
      api<{ items: AdminJob[] }>("/api/v1/admin/jobs"),
      api<{ items: AdminJob[] }>("/api/v1/admin/jobs?scope=review"),
    ])
      .then(([current, drafts]) => {
        setItems([...current.items, ...drafts.items]);
        setSelected({});
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedIds = useMemo(
    () => items.filter((job) => selected[job.jobId]).map((job) => job.jobId),
    [items, selected],
  );

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const job of items) next[job.jobId] = true;
    setSelected(next);
  }

  async function deleteIds(jobIds: string[]) {
    if (!jobIds.length) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ deletedCount: number; failedCount: number }>(
        "/api/v1/admin/jobs/delete-many",
        {
          method: "POST",
          body: JSON.stringify({ jobIds }),
        },
      );
      setItems((current) => current.filter((job) => !jobIds.includes(job.jobId)));
      setSelected({});
      setConfirmId("");
      setMessage(
        result.failedCount
          ? `Deleted ${result.deletedCount}. Failed ${result.failedCount}.`
          : `Deleted ${result.deletedCount} job${result.deletedCount === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete jobs.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">Select jobs and delete them, or delete one by one.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/jobs/import">Import JSON</Link>
          <Link className="btn-primary" to="/admin/jobs/new">Post a job</Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="meta">{message}</p>}

      <div className="admin-bulk-bar">
        <label className="checks">
          <input
            type="checkbox"
            checked={items.length > 0 && selectedIds.length === items.length}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          Select all ({selectedIds.length}/{items.length})
        </label>
        <button
          className="btn-danger"
          type="button"
          disabled={pending || selectedIds.length === 0}
          onClick={() => deleteIds(selectedIds)}
        >
          {pending ? "Deleting…" : `Delete selected (${selectedIds.length})`}
        </button>
      </div>

      <div className="admin-job-list">
        {items.map((job) => (
          <article className="admin-job-card" key={job.jobId}>
            <label className="admin-job-select">
              <input
                type="checkbox"
                checked={Boolean(selected[job.jobId])}
                onChange={(e) =>
                  setSelected((current) => ({ ...current, [job.jobId]: e.target.checked }))
                }
              />
              <span>
                <h2>{job.title}</h2>
                <p className="meta">{job.companyName} · {job.lifecycle} · {job.accessTier}</p>
              </span>
            </label>
            <div className="admin-job-actions">
              {confirmId === job.jobId ? (
                <>
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={pending}
                    onClick={() => deleteIds([job.jobId])}
                  >
                    Yes, delete
                  </button>
                  <button className="btn-ghost" type="button" onClick={() => setConfirmId("")}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="btn-danger"
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmId(job.jobId)}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="muted">No live or draft jobs right now.</p>}
      </div>
    </div>
  );
}
