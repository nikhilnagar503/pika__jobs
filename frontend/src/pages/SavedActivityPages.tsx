import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function SavedPage() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<JobCardData[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ items: JobCardData[] }>("/api/v1/me/saved")
      .then((body) => setItems(body.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load saved."));
  }, [user]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/saved" replace />;

  return (
    <>
      <h1>Saved</h1>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">Nothing saved yet. Use Save on feed cards.</p>}
      <div className="feed">{items.map((job) => <JobCard key={job.id} job={job} />)}</div>
    </>
  );
}

export function ActivityPage() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Array<{ id: string; kind: string; occurredAt: string; jobId: string; title?: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ items: typeof items }>("/api/v1/me/activity")
      .then((body) => setItems(body.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load activity."));
  }, [user]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/auth/sign-in?next=/activity" replace />;

  return (
    <>
      <h1>Activity</h1>
      <p className="muted">
        This is your personal history: when you open an apply link or mark a role as applied. Saved jobs stay under Saved.
      </p>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">No apply activity yet. Open an apply link from a listing to see it here.</p>}
      <ul className="activity-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.kind === "applied" ? "Marked applied" : "Opened apply"}</strong>
            {" · "}
            {item.title || item.jobId}
            <span className="meta"> · {new Date(item.occurredAt).toLocaleString("en-IN")}</span>
          </li>
        ))}
      </ul>
    </>
  );
}


