import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FeedDayList } from "@/components/FeedDayList";
import { FeedFilterToggle } from "@/components/FeedFilters";
import { type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getCached, setCached } from "@/lib/feed-cache";
import { activeFilterCount, feedQueryKey, readFeedQuery, toFeedApiQuery, toFeedSearchParams } from "@/lib/feed-query";
import { restoreScroll, saveScroll } from "@/lib/scroll";

type FeedItem = { type: "job"; job: JobCardData };

type FeedPageData = {
  items: FeedItem[];
  nextCursor: string | null;
  total: number;
};

type FeedCacheData = {
  items: FeedItem[];
  nextCursor: string | null;
};

function cacheKey(key: string) {
  return `member-feed:${key}`;
}

export function FeedPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFeedQuery(params), [params]);
  const filterKey = feedQueryKey(filters);
  const q = filters.q;
  const initial = getCached<FeedCacheData>(cacheKey(filterKey));
  const [items, setItems] = useState<FeedItem[]>(initial?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const persist = useCallback((nextItems: FeedItem[], cursor: string | null) => {
    setCached(cacheKey(filterKey), { items: nextItems, nextCursor: cursor });
  }, [filterKey]);

  const loadPage = useCallback(async (cursor: string | null, replace: boolean) => {
    const query = toFeedApiQuery(filters);
    if (cursor) query.set("cursor", cursor);
    const body = await api<FeedPageData>(`/api/v1/jobs?${query}`);
    setItems((current) => {
      const next = replace ? body.items : [...current, ...body.items];
      persist(next, body.nextCursor);
      return next;
    });
    setNextCursor(body.nextCursor);
    return body;
  }, [filters, persist]);

  useEffect(() => {
    if (!user) return;
    const cached = getCached<FeedCacheData>(cacheKey(filterKey));
    if (cached) {
      setItems(cached.items);
      setNextCursor(cached.nextCursor);
      setLoading(false);
      setRefreshing(true);
      loadPage(null, true)
        .catch(() => {
          // keep cached data if refresh fails
        })
        .finally(() => setRefreshing(false));
      return;
    }

    setLoading(true);
    setError("");
    setItems([]);
    setNextCursor(null);
    loadPage(null, true)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load feed."))
      .finally(() => setLoading(false));
  }, [user, filterKey, loadPage]);

  useEffect(() => {
    if (loading) return;
    restoreScroll("feed");
    const onScroll = () => saveScroll("feed");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, items.length]);

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
    const value = String(data.get("q") || "").trim();
    setParams(toFeedSearchParams({ ...filters, q: value }));
  }

  const jobCount = items.filter((item) => item.type === "job").length;

  return (
    <>
      <div className="feed-toolbar">
        <div className="feed-title-row">
          <h1>Feed</h1>
          <p className="feed-sort">{refreshing ? "Updating…" : "Newest first"}</p>
        </div>
        <form className="feed-search" onSubmit={onSearch}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, company, stipend, internship, job…"
            aria-label="Search"
          />
          <button className="btn-ghost" type="submit">Search</button>
          <FeedFilterToggle />
          <Link className="feed-clear" to="/feed">Clear</Link>
        </form>
      </div>
      {loading && <p className="muted">Loading listings…</p>}
      {error && <p className="error">{error}</p>}
      {items.length > 0 && (
        <FeedDayList jobs={items.filter((item) => item.type === "job").map((item) => item.job)} />
      )}
      {!loading && items.length === 0 && (
        <div className="panel">
          <h2>No listings yet</h2>
          <p className="muted">
            {activeFilterCount(filters)
              ? "Nothing matches these filters. Reset them to see more listings."
              : "Published jobs from the last 7 days will appear here."}
          </p>
        </div>
      )}
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
