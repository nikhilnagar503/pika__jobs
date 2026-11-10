import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { JobCardView } from "@/components/job-card";
import { markApplied, reportListing, toggleSave } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Job", robots: { index: false, follow: false } };

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reported?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const data = await withStore(async (store) => {
    const actor = await readActor(store);
    try {
      const view = store.getJob(actor, id);
      return { actorKind: actor.kind, view };
    } catch {
      return { actorKind: actor.kind, view: { status: "unavailable" as const } };
    }
  });
  if (data.view.status === "sign_in" || data.actorKind !== "user") redirect(`/auth/sign-in?next=/jobs/${id}`);
  if (!data.view || data.view.status === "unavailable") {
    return (
      <MemberShell current="/feed">
        <div className="panel"><h1>This listing is not available</h1><p className="muted">It may have expired or been removed. The application route is not shown.</p></div>
      </MemberShell>
    );
  }
  if (data.view.status === "upgrade") {
    return (
      <MemberShell current="/feed">
        <div className="panel">
          <h1>This is a Pro listing</h1>
          <p>Category: {data.view.teaser.opportunityKind}. Work mode: {data.view.teaser.workMode}. Pay disclosure: {data.view.teaser.disclosureStatus}.</p>
          <p className="muted">The role, employer, description, and application route stay on the server until a valid pass is active.</p>
          <Link className="btn-primary" href="/pricing">See Pro</Link>
        </div>
      </MemberShell>
    );
  }
  if (data.view.status !== "ok") notFound();
  const job = data.view.job;
  return (
    <MemberShell current="/feed">
      <JobCardView job={job} href={false} />
      {job.requirements.length > 0 && (
        <section>
          <h2>Requirements</h2>
          <ul>{job.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {job.eligibleCountries.length > 0 && <p className="muted">Eligible countries: {job.eligibleCountries.join(", ")}. Remote does not mean worldwide.</p>}
      {job.government && <p>Official notice: {Object.values(job.government).join(" · ")}. Verify eligibility on the official notice.</p>}
      <p className="meta">Verification: {job.verification}. Source: {job.sourceUrl}</p>
      {query.reported && <p className="notice">Report received. The employer is not shown your identity.</p>}
      <div className="cluster">
        <ApplyButton jobId={job.id} label={job.applicationKind === "email" ? "Email HR" : "Apply on company site"} />
        <form action={toggleSave}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="saved" value={job.saved ? "no" : "yes"} />
          <input type="hidden" name="next" value={`/jobs/${job.id}`} />
          <button className="btn-ghost" type="submit">{job.saved ? "Unsave" : "Save"}</button>
        </form>
        <form action={markApplied}>
          <input type="hidden" name="jobId" value={job.id} />
          <button className="btn-ghost" type="submit">Mark as applied</button>
        </form>
      </div>
      <form action={reportListing}>
        <input type="hidden" name="jobId" value={job.id} />
        <label className="field">Reason
          <select name="reason">
            <option>Suspicious email</option>
            <option>Duplicate</option>
            <option>Wrong location</option>
            <option>Missing pay</option>
            <option>Expired role</option>
          </select>
        </label>
        <label className="field">Detail<textarea name="detail" rows={3} /></label>
        <button className="btn-ghost" type="submit">Report listing</button>
      </form>
    </MemberShell>
  );
}

function ApplyButton({ jobId, label }: { jobId: string; label: string }) {
  return (
    <form action={`/api/v1/jobs/${jobId}/open-application`} method="post">
      <button className="btn-primary" type="submit">{label}</button>
    </form>
  );
}
