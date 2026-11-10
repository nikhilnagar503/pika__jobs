import { publishJobAction } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Review" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const data = await withStore(async (store) => {
    const actor = await readActor(store);
    return { jobs: store.listAdminJobs(actor, "review"), reports: store.reports(actor) };
  });
  return (
    <>
      <h1>Review queue</h1>
      {query.error && <p className="error">{query.error}</p>}
      {data.jobs.map((job) => (
        <article className="card" key={job.jobId}>
          <h2>{job.title}</h2>
          <p>{job.summary}</p>
          <form action={publishJobAction}><input type="hidden" name="jobId" value={job.jobId} /><button className="btn-primary" type="submit">Publish</button></form>
        </article>
      ))}
      <h2>Reports</h2>
      {data.reports.map((report) => <p key={report.id}>{report.reason}: {report.detail}</p>)}
      {data.jobs.length === 0 && data.reports.length === 0 && <p className="muted">The queue is empty.</p>}
    </>
  );
}
