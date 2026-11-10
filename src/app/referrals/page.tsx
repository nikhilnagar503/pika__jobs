import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { acceptTerms, requestPayout } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { formatInr } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Referrals" };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const data = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return null;
    return store.referralDashboard(actor);
  });
  if (!data) redirect("/auth/sign-in?next=/referrals");
  return (
    <MemberShell current="/referrals">
      <h1>Referrals</h1>
      <p>Share Pikajobs. Earn 10% on eligible purchases. There is no reward just for signing up.</p>
      {query.error && <p className="error">{query.error}</p>}
      {!data.termsAccepted ? (
        <form action={acceptTerms}><button className="btn-primary" type="submit">Accept referral terms</button></form>
      ) : (
        <p>Your link: <strong>{data.link}</strong></p>
      )}
      <div className="grid-3">
        <Stat label="Verified signups" value={String(data.signups)} />
        <Stat label="Purchases" value={String(data.purchases)} />
        <Stat label="Pending" value={formatInr(data.balances.pending)} />
        <Stat label="Available" value={formatInr(data.balances.available)} />
        <Stat label="Reserved" value={formatInr(data.balances.reserved)} />
        <Stat label="Paid" value={formatInr(data.balances.paid)} />
      </div>
      <form action={requestPayout}>
        <label className="field">Amount in rupees<input name="amount" inputMode="decimal" defaultValue="500" /></label>
        <label className="field">Masked beneficiary reference<input name="beneficiary" placeholder="UPI ····@bank" required /></label>
        <button className="btn-ghost" type="submit">Request payout</button>
      </form>
      <p className="muted">Payouts are manual, INR only, and stay reserved until a confirmed settlement. Payments are not open yet, so new commission cannot accrue.</p>
    </MemberShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="card"><p className="meta">{label}</p><strong>{value}</strong></article>;
}
