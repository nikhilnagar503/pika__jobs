import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { FeedClient } from "@/features/jobs/feed-client";
import { requireMember } from "@/server/auth/gates";
import { type FeedFilters } from "@/server/domain/jobs/feed";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Feed" };

export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const sort = query.sort === "latest" ? "latest" : "for_you";
  const preview = query.preview === "free" || query.preview === "pro" ? query.preview : null;
  const filters: Partial<FeedFilters> = {
    q: typeof query.q === "string" ? query.q : undefined,
    kinds: list(query.kind),
    sectors: list(query.sector),
    workModes: list(query.mode),
    roleFamilies: list(query.role),
  };
  if (query.unknown === "0" || query.unknown === "1") filters.includeUnknownPay = query.unknown === "1";
  const data = await withStore(async (store) => {
    const gate = await requireMember(store, "/feed");
    if ("redirectTo" in gate) return gate;
    const page = store.listFeed(gate.actor, { filters, sort, preview: gate.actor.roles.includes("admin") ? preview : null });
    return { page, admin: gate.actor.roles.includes("admin") };
  });
  if ("redirectTo" in data) redirect(data.redirectTo);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && key !== "cursor") search.set(key, value);
  }
  return (
    <MemberShell current="/feed">
      <div className="cluster">
        <h1 style={{ margin: 0 }}>Feed</h1>
        <Link href={sort === "latest" ? "/feed" : "/feed?sort=latest"}>{sort === "latest" ? "Latest" : "For you"}</Link>
      </div>
      {preview && data.admin && <p className="notice">Previewing as {preview}. This does not change your pass. <Link href="/feed">Exit preview</Link></p>}
      <form className="cluster" action="/feed">
        <input name="q" defaultValue={typeof query.q === "string" ? query.q : ""} placeholder="Search" aria-label="Search" />
        <input type="hidden" name="sort" value={sort} />
        <button className="btn-ghost" type="submit">Search</button>
        <Link href="/feed">Clear all</Link>
      </form>
      <div className="chips">
        <Link href="/feed?kind=job">Jobs</Link>
        <Link href="/feed?kind=internship">Internships</Link>
        <Link href="/feed?mode=remote">Remote</Link>
        <Link href="/feed?sector=government">Government</Link>
      </div>
      <p className="meta">{data.page.total} accessible listings</p>
      <FeedClient initial={data.page} sort={sort} query={search.toString()} />
    </MemberShell>
  );
}

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(",")).filter(Boolean);
}
