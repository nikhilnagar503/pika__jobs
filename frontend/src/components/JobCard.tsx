import { Link } from "react-router-dom";
import { useState, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

export type JobCardData = {
  id: string;
  title: string;
  companyName: string;
  locationLabel: string;
  payLabel: string;
  opportunityKind: string;
  requirements: string[];
  eligibility: string[];
  responsibilities: string[];
  batchLabel: string | null;
  durationLabel: string | null;
  originalSourceLabel: string | null;
  applyNote: string | null;
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  accessTier: "free" | "pro";
  saved: boolean;
  effectiveJobAt?: string;
  publishedAt?: string | null;
  firstSeenAt?: string;
  sourcePublishedAt?: string | null;
  lifecycle?: string;
};

type JobCardProps = {
  job: JobCardData;
  mode?: "member" | "admin";
  onDeleted?: (jobId: string) => void;
  onPublished?: (jobId: string) => void;
};

function isDraftLifecycle(lifecycle?: string) {
  return lifecycle === "draft" || lifecycle === "in_review";
}

function rememberScroll() {
  try {
    sessionStorage.setItem("pikajobs:scroll:feed", String(window.scrollY));
    sessionStorage.setItem("pikajobs:scroll:admin-feed", String(window.scrollY));
  } catch {
    // ignore
  }
}

function buildMailto(email: string, subject: string | null) {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

function buildGmailCompose(email: string, subject: string | null) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to: email });
  if (subject) params.set("su", subject);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function isDesktopPointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function JobCard({ job, mode = "member", onDeleted, onPublished }: JobCardProps) {
  const [saved, setSaved] = useState(job.saved);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishError, setPublishError] = useState("");
  const postedAt = job.publishedAt || job.firstSeenAt || job.effectiveJobAt;
  const mailto = job.hrEmail ? buildMailto(job.hrEmail, job.emailSubject) : null;
  const facts = [
    job.locationLabel,
    job.payLabel,
    job.durationLabel,
    job.batchLabel ? `Batch ${job.batchLabel}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasDetails = job.eligibility.length > 0 || job.requirements.length > 0 || job.responsibilities.length > 0;

  function openHrEmail(event: MouseEvent<HTMLAnchorElement>) {
    if (!job.hrEmail || !mailto) return;
    rememberScroll();
    if (!isDesktopPointer()) return;
    event.preventDefault();
    const draft = window.open(buildGmailCompose(job.hrEmail, job.emailSubject), "_blank", "noopener,noreferrer");
    if (!draft) window.location.href = mailto;
  }

  async function toggleSave() {
    setPending(true);
    try {
      await api(`/api/v1/me/saved/${job.id}`, { method: saved ? "DELETE" : "PUT" });
      setSaved(!saved);
    } finally {
      setPending(false);
    }
  }

  async function publishJob() {
    setPending(true);
    setPublishError("");
    try {
      await api(`/api/v1/admin/jobs/${job.id}/publish`, { method: "POST" });
      onPublished?.(job.id);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Could not publish this listing.");
    } finally {
      setPending(false);
    }
  }

  async function deleteJob() {
    setPending(true);
    try {
      await api(`/api/v1/admin/jobs/${job.id}/delete`, { method: "POST" });
      onDeleted?.(job.id);
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="job alert-card">
      <header className="alert-head">
        <div className="alert-head-meta">
          <p className="alert-meta-row">
            <span className="alert-kind">{job.opportunityKind.replaceAll("_", " ")}</span>
            <span className="alert-time">{formatRelativeTime(postedAt)}</span>
            {job.lifecycle && mode === "admin" && <span className="alert-time">{job.lifecycle}</span>}
          </p>
          <h2 className="alert-title">{job.title}</h2>
          <p className="alert-company">{job.companyName}</p>
        </div>
        <div className="alert-head-actions">
          {job.accessTier === "pro" && <span className="flag">Pro</span>}
          {mode === "admin" ? (
            <>
              {isDraftLifecycle(job.lifecycle) && (
                <button className="btn-primary save-btn" type="button" onClick={publishJob} disabled={pending}>
                  {pending ? "…" : "Publish"}
                </button>
              )}
              <Link
                className="btn-ghost save-btn"
                to={`/admin/jobs/${job.id}/edit`}
                onClick={rememberScroll}
              >
                Edit
              </Link>
              {confirmDelete ? (
                <>
                  <button className="btn-danger save-btn" type="button" onClick={deleteJob} disabled={pending}>
                    {pending ? "…" : "Yes, delete"}
                  </button>
                  <button className="btn-ghost save-btn" type="button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn-danger save-btn" type="button" onClick={() => setConfirmDelete(true)} disabled={pending}>
                  Delete
                </button>
              )}
            </>
          ) : (
            <button className="btn-ghost save-btn" type="button" onClick={toggleSave} disabled={pending} aria-pressed={saved}>
              {pending ? "…" : saved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </header>
      {publishError && <p className="error">{publishError}</p>}
      {facts.length > 0 && (
        <ul className="alert-facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {hasDetails && (
        <details className="alert-more" open={mode === "admin"}>
          <summary>Role details</summary>
          {job.eligibility.length > 0 && (
            <section className="alert-section">
              <p>Eligibility</p>
              <ul>{job.eligibility.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
          {job.requirements.length > 0 && (
            <section className="alert-section">
              <p>Requirements</p>
              <ul>{job.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
          {job.responsibilities.length > 0 && (
            <section className="alert-section">
              <p>Responsibilities</p>
              <ul>{job.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
        </details>
      )}
      {(job.applicationUrl || mailto || job.applyNote) && (
        <div className="alert-apply">
          {job.applicationUrl && (
            <a
              className="btn-primary save-btn"
              href={job.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={rememberScroll}
            >
              Apply
            </a>
          )}
          {mailto && job.hrEmail && (
            <a
              className={`save-btn ${job.applicationUrl ? "btn-ghost" : "btn-primary"}`}
              href={mailto}
              title={job.hrEmail}
              onClick={openHrEmail}
            >
              {job.applicationUrl ? "Email HR" : "Apply by email"}
            </a>
          )}
          {job.applyNote && <p className="alert-note">{job.applyNote}</p>}
        </div>
      )}
    </article>
  );
}
