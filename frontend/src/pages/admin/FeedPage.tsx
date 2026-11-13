import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FeedDayList } from "@/components/FeedDayList";
import { type JobCardData } from "@/components/JobCard";
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

function isDraft(job: JobCardData) {
  return job.lifecycle === "draft" || job.lifecycle === "in_review";
}

export function AdminFeedPage() {
  const [params, setParams] = useSearchParams();
  const lifecycleFilter = params.get("lifecycle") === "draft" || params.get("lifecycle") === "published"
    ? params.get("lifecycle")
    : "all";
  const initial = getCached<JobCardData[]>(ADMIN_FEED_KEY);
  const [items, setItems] = useState<JobCardData[]>(initial ?? []);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
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

  const drafts = useMemo(() => items.filter(isDraft), [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((job) => {
      if (lifecycleFilter === "draft" && !isDraft(job)) return false;
      if (lifecycleFilter === "published" && job.lifecycle !== "published") return false;
      if (!query) return true;
      return [job.title, job.companyName, job.payLabel, job.opportunityKind, job.locationLabel]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [items, q, lifecycleFilter]);

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

  function onPublished(jobId: string) {
    setItems((current) => {
      const next = current.map((item) =>
        item.id === jobId ? { ...item, lifecycle: "published", publishedAt: new Date().toISOString() } : item,
      );
      setCached(ADMIN_FEED_KEY, next);
      return next;
    });
    invalidateCached("member-feed:");
    setMessage("Published to the member feed.");
  }

  function setLifecycleFilter(value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("lifecycle");
    else next.set("lifecycle", value);
    setParams(next, { replace: true });
  }

  async function publishAllDrafts() {
    if (!drafts.length) return;
    setPublishing(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{
        publishedCount: number;
        failedCount: number;
        published: Array<{ jobId: string }>;
        failed: Array<{ companyName: string; title: string; message: string }>;
      }>("/api/v1/admin/jobs/publish-many", {
        method: "POST",
        body: JSON.stringify({ jobIds: drafts.map((job) => job.id) }),
      });
      const publishedIds = new Set(result.published.map((item) => item.jobId));
      if (publishedIds.size) {
        const publishedAt = new Date().toISOString();
        setItems((current) => {
          const next = current.map((item) =>
            publishedIds.has(item.id) ? { ...item, lifecycle: "published", publishedAt } : item,
          );
          setCached(ADMIN_FEED_KEY, next);
          return next;
        });
        invalidateCached("member-feed:");
      }
      const failedNote = result.failed
        .map((item) => `${item.companyName} · ${item.title}: ${item.message}`)
        .join(" ");
      setMessage(
        result.failedCount
          ? `Published ${result.publishedCount}. Could not publish ${result.failedCount}. ${failedNote}`
          : `Published ${result.publishedCount} draft${result.publishedCount === 1 ? "" : "s"} to the member feed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish drafts.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin feed</h1>
          <p className="muted">
            Drafts stay off the member feed until you publish them.
            {refreshing ? " Updating…" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/jobs">Manage list</Link>
          <Link className="btn-primary" to="/admin/jobs/import">Import JSON</Link>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Listing status">
        <Link to="/admin/feed" aria-current={lifecycleFilter === "all" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setLifecycleFilter("all"); }}>All</Link>
        <Link to="/admin/feed?lifecycle=published" aria-current={lifecycleFilter === "published" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setLifecycleFilter("published"); }}>Live</Link>
        <Link to="/admin/feed?lifecycle=draft" aria-current={lifecycleFilter === "draft" ? "page" : undefined} onClick={(event) => { event.preventDefault(); setLifecycleFilter("draft"); }}>Drafts ({drafts.length})</Link>
      </nav>

      {drafts.length > 0 && (
        <div className="notice" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0 }}>
            {drafts.length} draft{drafts.length === 1 ? "" : "s"} are not on the member feed. Publish from the card, or publish all.
          </p>
          <button className="btn-primary" type="button" onClick={publishAllDrafts} disabled={publishing}>
            {publishing ? "Publishing…" : `Publish ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      <div className="feed-toolbar" style={{ marginBottom: 16 }}>
        <form className="feed-search" onSubmit={onSearch}>
          <input name="q" defaultValue={q} placeholder="Search title, company, stipend…" aria-label="Search" />
          <button className="btn-ghost" type="submit">Search</button>
          <button className="feed-clear" type="button" onClick={() => setQ("")}>Clear</button>
        </form>
        <p className="feed-count">{filtered.length} listings</p>
      </div>

      {loading && <p className="muted">Loading admin feed…</p>}
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {filtered.length > 0 && (
        <FeedDayList
          jobs={filtered}
          mode="admin"
          onDeleted={onDeleted}
          onPublished={onPublished}
        />
      )}
      {!loading && filtered.length === 0 && (
        <div className="panel">
          <h2>No listings</h2>
          <p className="muted">Import JSON or post a job to see cards here.</p>
        </div>
      )}
    </div>
  );
}
