import Link from "next/link";
import { labelOf, opportunityKinds, sectors, workModes } from "@/shared/product";
import type { JobCard } from "@/server/repositories/memory";

export function JobCardView({ job, href = true }: { job: JobCard; href?: boolean }) {
  const title = href ? <Link href={`/jobs/${job.id}`}>{job.title}</Link> : job.title;
  return (
    <article className="job">
      <div className="company">
        <div className="avatar" aria-hidden="true">{job.companyInitials}</div>
        <div>
          <div>{job.companyName}</div>
          <h3>{title}</h3>
        </div>
      </div>
      <p className="meta">{job.locationLabel} · {labelOf(workModes, job.workMode)}</p>
      <p>{job.payLabel}</p>
      <p className="meta">{labelOf(opportunityKinds, job.opportunityKind)} · {labelOf(sectors, job.sector)}</p>
      {job.skills.length > 0 && (
        <div className="chips">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      )}
      <p>{job.summary}</p>
      <p className="meta">
        {job.sourcePublishedAt ? `Source posted ${formatDay(job.sourcePublishedAt)}` : "Source date not provided"}
        {job.lastCheckedAt ? ` · checked ${formatDay(job.lastCheckedAt)}` : ""}
        {job.deadlineAt ? ` · deadline ${formatDay(job.deadlineAt)}` : ""}
      </p>
      {job.reasons.length > 0 && <p className="meta">{job.reasons.join(" · ")}</p>}
      {job.accessTier === "pro" && <span className="flag">Pro</span>}
    </article>
  );
}

export function SponsorCard({ name, href }: { name: string; href: string }) {
  return (
    <aside className="card" aria-label="Sponsored">
      <span className="flag">Sponsored</span>
      <h3>{name}</h3>
      <p className="muted">A labeled sponsor placement. This is not a job and not an application button.</p>
      <a href={href} rel="sponsored noopener noreferrer">Visit sponsor</a>
    </aside>
  );
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
