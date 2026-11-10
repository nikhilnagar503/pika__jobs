import Link from "next/link";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const overview = await withStore(async (store) => store.overview(await readActor(store)));
  const cards = [
    ["Live free", overview.liveFree, "/admin/jobs"],
    ["Live Pro", overview.livePro, "/admin/jobs"],
    ["Pending review", overview.pendingReview, "/admin/review"],
    ["Open reports", overview.openReports, "/admin/review"],
    ["Paid orders", overview.paidOrders, "/admin/orders"],
    ["Payout queue", overview.payoutQueue, "/admin/payouts"],
  ];
  return (
    <>
      <h1>Overview</h1>
      <p className="muted">Counts come from the current store. Nothing here is simulated revenue.</p>
      <div className="grid-3">
        {cards.map(([label, value, href]) => (
          <Link key={String(label)} className="card" href={String(href)}><p className="meta">{label}</p><strong>{value}</strong></Link>
        ))}
      </div>
    </>
  );
}
