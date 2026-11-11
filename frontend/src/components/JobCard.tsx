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
  sourcePublishedAt?: string | null;
};

export function JobCard({ job }: { job: JobCardData }) {
  const [saved, setSaved] = useState(job.saved);
  const [pending, setPending] = useState(false);
  const payKey = job.opportunityKind === "internship" ? "Stipend" : "CTC";
  const postedAt = job.sourcePublishedAt || job.effectiveJobAt;
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

  return (
    <article className="job alert-card">
      <header className="alert-head">
        <div className="alert-head-meta">
          <p className="alert-kind">{job.opportunityKind.replaceAll("_", " ")}</p>
          <p className="alert-time">{formatRelativeTime(postedAt)}</p>
        </div>
        <div className="alert-head-actions">
          {job.accessTier === "pro" && <span className="flag">Pro</span>}
          <button className="btn-ghost save-btn" type="button" onClick={toggleSave} disabled={pending} aria-pressed={saved}>
            {pending ? "…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </header>
      <div className="alert-body">
        <p><strong>Company:</strong> {job.companyName}</p>
        <p><strong>Role:</strong> <Link className="alert-role" to={`/jobs/${job.id}`}>{job.title}</Link></p>
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
                <a className="alert-link" href={job.applicationUrl} target="_blank" rel="noreferrer">{job.applicationUrl}</a>
              </p>
            )}
            {mailto && job.hrEmail && (
              <>
                <p>
                  <strong>Apply -</strong>{" "}
                  <a className="alert-link" href={mailto}>{job.hrEmail}</a>
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
