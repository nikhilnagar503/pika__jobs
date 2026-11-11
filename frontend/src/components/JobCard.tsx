import { Link } from "react-router-dom";
import { useState } from "react";
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
};

export function JobCard({ job, mode = "member", onDeleted }: JobCardProps) {
  const [saved, setSaved] = useState(job.saved);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const payKey = job.opportunityKind === "internship" ? "Stipend" : "CTC";
  const postedAt = job.publishedAt || job.firstSeenAt || job.effectiveJobAt;
  const mailto = job.hrEmail
    ? `mailto:${job.hrEmail}${job.emailSubject ? `?subject=${encodeURIComponent(job.emailSubject)}` : ""}`
    : null;

  async function toggleSave() {
    setPending(true);
    try {
      await api(`/api/v1/me/saved/${job.id}`, { method: saved ? "DELETE" : "PUT" });
      setSaved(!saved);
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
          <p className="alert-kind">{job.opportunityKind.replaceAll("_", " ")}</p>
          <p className="alert-time">{formatRelativeTime(postedAt)}</p>
          {job.lifecycle && mode === "admin" && <p className="alert-time">{job.lifecycle}</p>}
        </div>
        <div className="alert-head-actions">
          {job.accessTier === "pro" && <span className="flag">Pro</span>}
          {mode === "admin" ? (
            <>
              <Link
                className="btn-ghost save-btn"
                to={`/admin/jobs/${job.id}/edit`}
                onClick={() => {
                  try {
                    sessionStorage.setItem("pikajobs:scroll:admin-feed", String(window.scrollY));
                  } catch {
                    // ignore
                  }
                }}
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
      <div className="alert-body">
        <p><strong>Company:</strong> {job.companyName}</p>
        <p>
          <strong>Role:</strong> <span className="alert-role">{job.title}</span>
        </p>
        {job.batchLabel && <p><strong>Batch:</strong> {job.batchLabel}</p>}
        <p><strong>{payKey}:</strong> {job.payLabel}</p>
        <p><strong>Location:</strong> {job.locationLabel}</p>
        {job.durationLabel && <p><strong>Duration:</strong> {job.durationLabel}</p>}
        {job.eligibility.length > 0 && (
          <section className="alert-section">
            <p><strong>Eligibility:</strong></p>
            <ul>{job.eligibility.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}
        {job.requirements.length > 0 && (
          <section className="alert-section">
            <p><strong>Requirements:</strong></p>
            <ul>{job.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}
        {job.responsibilities.length > 0 && (
          <section className="alert-section">
            <p><strong>Responsibilities:</strong></p>
            <ul>{job.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}
        {(job.applicationUrl || mailto || job.applyNote) && (
          <section className="alert-apply">
            {job.applicationUrl && (
              <p>
                <strong>Apply Link -</strong>{" "}
                <a
                  className="alert-link"
                  href={job.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseDown={() => {
                    try {
                      sessionStorage.setItem("pikajobs:scroll:feed", String(window.scrollY));
                      sessionStorage.setItem("pikajobs:scroll:admin-feed", String(window.scrollY));
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {job.applicationUrl}
                </a>
              </p>
            )}
            {mailto && job.hrEmail && (
              <>
                <p>
                  <strong>Apply -</strong>{" "}
                  <a className="alert-link" href={mailto} target="_blank" rel="noopener noreferrer">{job.hrEmail}</a>
                </p>
                {job.emailSubject && <p><strong>Subject:</strong> {job.emailSubject}</p>}
              </>
            )}
            {job.applyNote && (
              <p><strong>Apply note -</strong> {job.applyNote}</p>
            )}
          </section>
        )}
      </div>
    </article>
  );
}
