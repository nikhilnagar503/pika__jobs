import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";

type AdminJobRecord = {
  jobId: string;
  title: string;
  companyName: string;
  locationLabel: string;
  payDisplayLabel: string | null;
  opportunityKind: string;
  requirements?: string[];
  eligibility?: string[];
  responsibilities?: string[];
  batchLabel: string | null;
  durationLabel: string | null;
  originalSourceLabel: string | null;
  applyNote: string | null;
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  accessTier: "free" | "pro";
  effectiveJobAt: string;
  sourcePublishedAt: string | null;
  lifecycle: string;
};

function toCard(job: AdminJobRecord): JobCardData {
  return {
    id: job.jobId,
    title: job.title,
    companyName: job.companyName,
    locationLabel: job.locationLabel,
    payLabel: job.payDisplayLabel || "Pay not disclosed",
    opportunityKind: job.opportunityKind,
    requirements: job.requirements ?? [],
    eligibility: job.eligibility ?? [],
    responsibilities: job.responsibilities ?? [],
    batchLabel: job.batchLabel,
    durationLabel: job.durationLabel,
    originalSourceLabel: null,
    applyNote: job.applyNote,
    applicationUrl: job.applicationUrl,
    hrEmail: job.hrEmail,
    emailSubject: job.emailSubject,
    accessTier: job.accessTier,
    saved: false,
    effectiveJobAt: job.effectiveJobAt,
    sourcePublishedAt: job.sourcePublishedAt,
    lifecycle: job.lifecycle,
  };
}

export function AdminFeedPage() {
  const [items, setItems] = useState<JobCardData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ items: AdminJobRecord[] }>("/api/v1/admin/jobs"),
      api<{ items: AdminJobRecord[] }>("/api/v1/admin/jobs?scope=review"),
    ])
      .then(([current, drafts]) => {
        const cards = [...current.items, ...drafts.items]
          .map(toCard)
          .sort((a, b) => {
            const aTime = new Date(a.sourcePublishedAt || a.effectiveJobAt || 0).getTime();
            const bTime = new Date(b.sourcePublishedAt || b.effectiveJobAt || 0).getTime();
            return bTime - aTime;
          });
        setItems(cards);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load admin feed."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((job) =>
      [job.title, job.companyName, job.payLabel, job.opportunityKind, job.locationLabel]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, q]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setQ(String(data.get("q") || ""));
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin feed</h1>
          <p className="muted">Same card view as the member feed, with Edit and Delete.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/jobs">Manage list</Link>
          <Link className="btn-primary" to="/admin/jobs/import">Import JSON</Link>
        </div>
      </header>

      <div className="feed-toolbar" style={{ marginBottom: 16 }}>
        <form className="feed-search" onSubmit={onSearch}>
          <input name="q" defaultValue={q} placeholder="Search title, company, stipend…" aria-label="Search" />
          <button className="btn-ghost" type="submit">Search</button>
          <button className="feed-clear" type="button" onClick={() => setQ("")}>Clear</button>
        </form>
        <p className="feed-count">{filtered.length} listings</p>
      </div>

      {loading && <p className="muted">Loading admin feed…</p>}
      {error && <p className="error">{error}</p>}

      <div className="feed">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            mode="admin"
            onDeleted={(jobId) => setItems((current) => current.filter((item) => item.id !== jobId))}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="panel">
            <h2>No listings</h2>
            <p className="muted">Import JSON or post a job to see cards here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
