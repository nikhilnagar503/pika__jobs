import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type FeedItem = { type: "job"; job: JobCardData } | { type: "sponsored" };

type FeedPageData = {
  items: FeedItem[];
  nextCursor: string | null;
  total: number;
};

export function FeedPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const q = params.get("q") || "";

  const loadPage = useCallback(async (cursor: string | null, replace: boolean) => {
    const query = new URLSearchParams();
    query.set("sort", "latest");
    if (q) query.set("q", q);
    if (cursor) query.set("cursor", cursor);
    const body = await api<FeedPageData>(`/api/v1/jobs?${query}`);
    setItems((current) => (replace ? body.items : [...current, ...body.items]));
    setNextCursor(body.nextCursor);
  }, [q]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    setItems([]);
    setNextCursor(null);
    loadPage(null, true)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load feed."))
      .finally(() => setLoading(false));
  }, [user, q, loadPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      await loadPage(nextCursor, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more listings.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/feed" replace />;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const value = String(data.get("q") || "").trim();
    if (value) next.set("q", value);
    setParams(next);
  }

  const jobCount = items.filter((item) => item.type === "job").length;

  return (
    <>
      <div className="feed-toolbar">
        <div className="feed-title-row">
          <h1>Feed</h1>
          <p className="feed-sort">Newest first</p>
        </div>
        <form className="feed-search" onSubmit={onSearch}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, company, stipend, internship, job…"
            aria-label="Search"
          />
          <button className="btn-ghost" type="submit">Search</button>
          <Link className="feed-clear" to="/feed">Clear</Link>
        </form>
      </div>
      {loading && <p className="muted">Loading listings…</p>}
      {error && <p className="error">{error}</p>}
      <div className="feed">
        {items.map((item, index) =>
          item.type === "job" ? <JobCard key={`${item.job.id}-${index}`} job={item.job} /> : null,
        )}
        {!loading && items.length === 0 && (
          <div className="panel">
            <h2>No listings yet</h2>
            <p className="muted">Published jobs from the last 14 days will appear here.</p>
          </div>
        )}
      </div>
      {!loading && nextCursor && (
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more (${jobCount} shown)`}
          </button>
        </div>
      )}
    </>
  );
}
