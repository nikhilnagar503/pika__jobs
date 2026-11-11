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
  const [items, setItems] = useState<Array<{ id: string; kind: string; occurredAt: string; jobId: string }>>([]);
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
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">No activity yet.</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id} className="meta">{item.kind} · {item.jobId} · {new Date(item.occurredAt).toLocaleString("en-IN")}</li>
        ))}
      </ul>
    </>
  );
}

export function PricingPage() {
  return (
    <main className="wrap" style={{ paddingTop: 32 }}>
      <h1>Pricing</h1>
      <p className="muted">Free feed access after signup. Pro is an optional 30-day pass.</p>
    </main>
  );
}

export function OnboardingPage() {
  return (
    <>
      <h1>Improve your feed</h1>
      <p className="muted">Preferences UI will grow here. For now, use feed filters.</p>
    </>
  );
}
