import { settlePayoutAction } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { formatInr } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const payouts = await withStore(async (store) => {
    const actor = await readActor(store);
    return store.db.payouts.filter(() => actor.kind === "user" && actor.roles.includes("admin"));
  });
  return (
    <>
      <h1>Payouts</h1>
      <p className="muted">Mark paid only after the transfer has settled. Do not invent a bank reference.</p>
      {payouts.map((payout) => (
        <form key={payout.id} action={settlePayoutAction} className="card">
          <input type="hidden" name="payoutId" value={payout.id} />
          <input type="hidden" name="amount" value={payout.amountMinor / 100} />
          <p>{formatInr(payout.amountMinor)} · {payout.status} · {payout.beneficiaryMasked}</p>
          <label className="field">Bank reference<input name="reference" /></label>
          <button className="btn-ghost" name="status" value="paid" type="submit">Mark paid</button>
          <button className="btn-ghost" name="status" value="failed" type="submit">Mark failed</button>
        </form>
      ))}
    </>
  );
}
