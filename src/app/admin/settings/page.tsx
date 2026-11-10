import { product } from "@/shared/product";
import { paymentsEnabled } from "@/server/repositories/file-store";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      <ul>
        <li>Draft Pro price: INR {product.draftPriceMinor / 100} for {product.proPassDays} days</li>
        <li>Referral rate: {product.referralRateBps / 100}%</li>
        <li>Payout minimum: INR {product.payoutMinimumMinor / 100}</li>
        <li>Visibility window: 30 times 24 hours</li>
        <li>Payments enabled: {paymentsEnabled() ? "yes" : "no"}</li>
        <li>Publication can be paused with the publication_paused flag in the store.</li>
      </ul>
      <p className="muted">Changing a price, payout rule, or flag in production must write an audit event. Do that through the admin service, not by editing a client bundle.</p>
    </>
  );
}
