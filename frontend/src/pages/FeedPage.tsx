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
  const sort = params.get("sort") === "latest" ? "latest" : "for_you";
  const q = params.get("q") || "";

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const query = new URLSearchParams();
    query.set("sort", sort);
    if (q) query.set("q", q);
    const kind = params.get("kind");
    const mode = params.get("mode");
    const sector = params.get("sector");
    if (kind) query.set("kind", kind);
    if (mode) query.set("mode", mode);
    if (sector) query.set("sector", sector);
    api<FeedPageData>(`/api/v1/jobs?${query}`)
      .then(setPage)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load feed."))
      .finally(() => setLoading(false));
  }, [user, sort, q, params]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/feed" replace />;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams(params);
    const value = String(data.get("q") || "");
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next);
  }

  return (
    <>
      <div className="feed-toolbar">
        <div className="feed-title-row">
          <h1>Feed</h1>
          <Link className="feed-sort" to={sort === "latest" ? "/feed" : "/feed?sort=latest"}>
            {sort === "latest" ? "Latest" : "For you"}
          </Link>
        </div>
        <form className="feed-search" onSubmit={onSearch}>
          <input name="q" defaultValue={q} placeholder="Search roles, companies, skills" aria-label="Search" />
          <button className="btn-ghost" type="submit">Search</button>
          <Link className="feed-clear" to="/feed">Clear all</Link>
        </form>
        <div className="feed-filters">
          <Link to="/feed?kind=job">Jobs</Link>
          <Link to="/feed?kind=internship">Internships</Link>
          <Link to="/feed?mode=remote">Remote</Link>
          <Link to="/feed?sector=government">Government</Link>
        </div>
        <p className="feed-count">{page?.total ?? 0} accessible listings</p>
      </div>
      {loading && <p className="muted">Loading listings…</p>}
      {error && <p className="error">{error}</p>}
      <div className="feed">
        {page?.items.map((item) =>
          item.type === "job" ? <JobCard key={item.job.id} job={item.job} /> : null,
        )}
        {!loading && page && page.items.length === 0 && (
          <div className="panel">
            <h2>We are preparing the first collection</h2>
            <p className="muted">Published listings will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}
