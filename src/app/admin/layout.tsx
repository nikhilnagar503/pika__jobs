import Link from "next/link";
import { redirect } from "next/navigation";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

const links = [
  ["/admin", "Overview"],
  ["/admin/jobs", "Jobs"],
  ["/admin/review", "Review"],
  ["/admin/import", "Import"],
  ["/admin/sources", "Sources and agents"],
  ["/admin/users", "Users"],
  ["/admin/orders", "Orders"],
  ["/admin/referrals", "Referrals"],
  ["/admin/payouts", "Payouts"],
  ["/admin/ads", "Ads"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await withStore(async (store) => {
    const actor = await readActor(store);
    return actor.kind === "user" && (actor.roles.includes("admin") || actor.roles.includes("reviewer"));
  });
  if (!allowed) redirect("/auth/sign-in?next=/admin");
  return (
    <div className="app" style={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}>
      <nav className="side" aria-label="Admin">
        <Link className="wordmark" href="/admin">Admin</Link>
        {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        <Link href="/feed">Exit</Link>
      </nav>
      <main id="main" className="feed">{children}</main>
    </div>
  );
}
