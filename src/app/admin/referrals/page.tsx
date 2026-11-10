export const metadata = { title: "Referral ledger" };

export default function AdminReferrals() {
  return (
    <>
      <h1>Referrals</h1>
      <p>Commission is calculated from captured eligible product revenue and stored as append-only credits. This screen does not show referred email addresses.</p>
      <p className="muted">Use the payout queue to settle a request only after a real bank reference exists.</p>
    </>
  );
}
