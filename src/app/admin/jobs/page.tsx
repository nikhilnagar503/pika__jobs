import { archiveJobAction, publishJobAction, saveJobAction } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { opportunityKinds, sectors, workModes } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Jobs" };

export default async function AdminJobs({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const query = await searchParams;
  const scope = query.scope === "archive" || query.scope === "review" ? query.scope : "current";
  const data = await withStore(async (store) => {
    const actor = await readActor(store);
    return { jobs: store.listAdminJobs(actor, scope), sources: store.listSources(actor) };
  });
  return (
    <>
      <h1>Jobs</h1>
      <p className="cluster"><a href="/admin/jobs">Current</a><a href="/admin/jobs?scope=review">Review</a><a href="/admin/jobs?scope=archive">Archive</a></p>
      {data.jobs.length === 0 && <p className="muted">Nothing in this view.</p>}
      {data.jobs.map((job) => (
        <article className="card" key={job.jobId}>
          <h2>{job.title}</h2>
          <p className="meta">{job.companyName} · {job.lifecycle} · version {job.version} · {job.accessTier}</p>
          {job.lifecycle !== "archived" && job.lifecycle !== "removed" && (
            <form action={publishJobAction}><input type="hidden" name="jobId" value={job.jobId} /><button className="btn-ghost" type="submit">Publish</button></form>
          )}
          {scope === "current" && (
            <form action={archiveJobAction}>
              <input type="hidden" name="jobId" value={job.jobId} />
              <input name="reason" placeholder="Reason" required />
              <button className="btn-ghost" type="submit">Archive</button>
            </form>
          )}
        </article>
      ))}
      <form action={saveJobAction} className="panel">
        <h2>Manual listing</h2>
        <label className="field">Title<input name="title" required /></label>
        <label className="field">Company<input name="company" required /></label>
        <label className="field">Summary<textarea name="summary" required maxLength={400} /></label>
        <label className="field">Kind<select name="kind">{opportunityKinds.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        <label className="field">Sector<select name="sector">{sectors.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        <label className="field">Work mode<select name="mode">{workModes.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        <label className="field">Location<input name="location" /></label>
        <label className="checks"><input type="checkbox" name="locationUnknown" value="yes" /> Location unknown</label>
        <label className="field">Pay type
          <select name="compensationType"><option value="not_disclosed">Not disclosed</option><option value="salary">Salary</option><option value="stipend">Stipend</option><option value="unpaid">Unpaid</option></select>
        </label>
        <label className="field">Minimum rupees<input name="payMin" /></label>
        <label className="field">Maximum rupees<input name="payMax" /></label>
        <label className="field">Period<select name="period"><option value="annual">Annual</option><option value="monthly">Monthly</option></select></label>
        <input type="hidden" name="basis" value="not_stated" />
        <label className="field">Application<select name="applicationMethod"><option value="url">Company site</option><option value="email">Email</option></select></label>
        <label className="field">Application URL<input name="applicationUrl" /></label>
        <label className="field">HR email<input name="hrEmail" /></label>
        <label className="checks"><input type="checkbox" name="hrApproved" value="yes" /> HR email is approved for publication</label>
        <label className="field">Source
          <select name="sourceId" required>{data.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
        </label>
        <label className="field">Source URL<input name="sourceUrl" required /></label>
        <label className="field">Source published at<input name="sourcePublishedAt" type="datetime-local" /></label>
        <label className="field">Tier<select name="tier"><option value="free">Free</option><option value="pro">Pro</option></select></label>
        <label className="field">Evidence excerpt<textarea name="evidence" required /></label>
        <button className="btn-ghost" type="submit">Save draft</button>
        <button className="btn-primary" name="publish" value="yes" type="submit">Save and publish</button>
      </form>
    </>
  );
}
