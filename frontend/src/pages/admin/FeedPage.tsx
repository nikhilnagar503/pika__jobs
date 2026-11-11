import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";
import { getCached, invalidateCached, setCached } from "@/lib/feed-cache";
import { restoreScroll, saveScroll } from "@/lib/scroll";

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
  publishedAt: string | null;
  firstSeenAt: string;
  sourcePublishedAt: string | null;
  lifecycle: string;
};

const ADMIN_FEED_KEY = "admin-feed";

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
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt,
    sourcePublishedAt: job.sourcePublishedAt,
    lifecycle: job.lifecycle,
  };
}

function sortCards(cards: JobCardData[]) {
  return [...cards].sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.firstSeenAt || a.effectiveJobAt || 0).getTime();
    const bTime = new Date(b.publishedAt || b.firstSeenAt || b.effectiveJobAt || 0).getTime();
    return bTime - aTime;
  });
}

export function AdminFeedPage() {
  const initial = getCached<JobCardData[]>(ADMIN_FEED_KEY);
  const [items, setItems] = useState<JobCardData[]>(initial ?? []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const cached = getCached<JobCardData[]>(ADMIN_FEED_KEY);
    if (cached) {
      setItems(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    Promise.all([
      api<{ items: AdminJobRecord[] }>("/api/v1/admin/jobs"),
      api<{ items: AdminJobRecord[] }>("/api/v1/admin/jobs?scope=review"),
    ])
      .then(([current, drafts]) => {
        const cards = sortCards([...current.items, ...drafts.items].map(toCard));
        setItems(cards);
        setCached(ADMIN_FEED_KEY, cards);
        setError("");
      })
      .catch((err) => {
        if (!cached) setError(err instanceof Error ? err.message : "Could not load admin feed.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
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

  useEffect(() => {
    if (loading) return;
    restoreScroll("admin-feed");
    const onScroll = () => saveScroll("admin-feed");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, filtered.length]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setQ(String(data.get("q") || ""));
  }

  function onDeleted(jobId: string) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== jobId);
      setCached(ADMIN_FEED_KEY, next);
      return next;
    });
    invalidateCached("member-feed:");
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin feed</h1>
          <p className="muted">
            Same card view as the member feed, with Edit and Delete.
            {refreshing ? " Updating…" : ""}
          </p>
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
        <p className="feed-count">{filtered.length} listings · last 14 days</p>
      </div>

      {loading && <p className="muted">Loading admin feed…</p>}
      {error && <p className="error">{error}</p>}

      <div className="feed admin-feed-list">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            mode="admin"
            onDeleted={onDeleted}
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
