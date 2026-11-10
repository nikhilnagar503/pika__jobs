import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { readActor } from "@/server/auth/session";
import { formatInr, product } from "@/shared/product";
import { paymentsEnabled, withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const signedIn = await withStore(async (store) => (await readActor(store)).kind === "user");
  if (!signedIn) redirect("/auth/sign-in?next=/checkout");
  const open = paymentsEnabled();
  return (
    <MemberShell current="/account">
      <h1>Checkout</h1>
      <p>{formatInr(product.draftPriceMinor)} for {product.proPassDays} days. The amount is set on the server. This pass does not renew automatically.</p>
      {open ? <p>Razorpay test checkout can be started from the API once keys are present.</p> : <p className="notice">Payments are not open yet. No charge will be created.</p>}
      <Link href="/pricing">Back to pricing</Link>
    </MemberShell>
  );
}
