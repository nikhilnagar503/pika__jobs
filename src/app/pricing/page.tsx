import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { formatInr, product } from "@/shared/product";
import { paymentsEnabled } from "@/server/repositories/file-store";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  const open = paymentsEnabled();
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section">
        <h1>Pro pass</h1>
        <p className="lede">{formatInr(product.draftPriceMinor)} for {product.proPassDays} days. One purchase. No automatic renewal.</p>
        <table className="table">
          <thead><tr><th>Capability</th><th>Free</th><th>Pro</th></tr></thead>
          <tbody>
            <tr><td>Account and preferences</td><td>Included</td><td>Included</td></tr>
            <tr><td>Curated free listings</td><td>Included</td><td>Included</td></tr>
            <tr><td>Extra Pro collection</td><td>Locked</td><td>Included while the pass is valid</td></tr>
            <tr><td>Save and track what you opened</td><td>Included for accessible jobs</td><td>Included</td></tr>
            <tr><td>Ads</td><td>Only when a real campaign is configured</td><td>None</td></tr>
            <tr><td>Getting hired</td><td>Never promised</td><td>Never promised</td></tr>
          </tbody>
        </table>
        <p className="muted">The draft price is a founder-editable experiment. Employers may post the same roles elsewhere. Pikajobs does not charge employers in this release and does not guarantee interviews, offers, or pay.</p>
        {open ? <Link className="btn-primary" href="/checkout">Continue to checkout</Link> : <button className="btn-primary" disabled>Payments are not open yet</button>}
      </main>
      <SiteFooter />
    </>
  );
}
