"use client";

import { useState } from "react";
import { JobCardView, SponsorCard } from "@/components/job-card";
import type { FeedPage } from "@/server/repositories/memory";

export function FeedClient({ initial, sort, query }: { initial: FeedPage; sort: string; query: string }) {
  const [page, setPage] = useState(initial);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/v1/jobs?cursor=${encodeURIComponent(cursor)}&sort=${sort}&${query}`);
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.message ?? "Could not load more.");
      return;
    }
    setPage((current) => ({ ...body, items: [...current.items, ...body.items] }));
    setCursor(body.nextCursor);
  }

  return (
    <div className="feed">
      {page.items.map((item, index) =>
        item.type === "job" ? (
          <JobCardView key={item.job.id} job={item.job} />
        ) : (
          <SponsorCard key={`ad-${index}`} name={page.sponsor?.name ?? "Sponsor"} href={page.sponsor?.destinationUrl ?? "/pricing"} />
        ),
      )}
      {page.items.length === 0 && (
        <div className="panel">
          <h2>We are preparing the first collection</h2>
          <p className="muted">Published listings will appear here. Sample cards on the homepage are not live jobs.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {cursor && (
        <button className="btn-ghost" type="button" onClick={more} disabled={loading}>
          {loading ? "Loading" : "Load more"}
        </button>
      )}
      {!cursor && page.items.length > 0 && <p className="muted">You&apos;re caught up.</p>}
    </div>
  );
}
