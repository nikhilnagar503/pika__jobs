import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { JobCardView } from "@/components/job-card";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Saved" };

export default async function SavedPage() {
  const jobs = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return null;
    return store.listSaved(actor);
  });
  if (!jobs) redirect("/auth/sign-in?next=/saved");
  return (
    <MemberShell current="/saved">
      <h1>Saved</h1>
      {jobs.length === 0 && <p className="muted">Nothing saved yet. <Link href="/feed">Browse the feed</Link></p>}
      {jobs.map((job) => <JobCardView key={job.id} job={job} href={job.title !== "Listing unavailable"} />)}
    </MemberShell>
  );
}
