import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type FeedPageData = {
  items: Array<{ type: "job"; job: JobCardData } | { type: "sponsored" }>;
  nextCursor: string | null;
  total: number;
};

export function FeedPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState<FeedPageData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const q = params.get("q") || "";

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const query = new URLSearchParams();
    query.set("sort", "latest");
    if (q) query.set("q", q);
    api<FeedPageData>(`/api/v1/jobs?${query}`)
      .then(setPage)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load feed."))
      .finally(() => setLoading(false));
  }, [user, q]);

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
        <p className="feed-count">{page?.total ?? 0} listings · last 14 days</p>
      </div>
      {loading && <p className="muted">Loading listings…</p>}
      {error && <p className="error">{error}</p>}
      <div className="feed">
        {page?.items.map((item) =>
          item.type === "job" ? <JobCard key={item.job.id} job={item.job} /> : null,
        )}
        {!loading && page && page.items.length === 0 && (
          <div className="panel">
            <h2>No listings yet</h2>
            <p className="muted">Published jobs from the last 14 days will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}
