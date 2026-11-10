import { MemberShell } from "@/components/member-shell";

export const metadata = { title: "Payment result" };

export default async function CheckoutResult({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const status = query.status ?? "pending";
  const copy: Record<string, string> = {
    success: "The payment was captured and the pass was granted.",
    failed: "The payment did not complete. No pass was granted.",
    pending: "The payment is still being confirmed. You can refresh this page.",
    canceled: "Checkout was canceled. No pass was granted.",
  };
  return (
    <MemberShell current="/account">
      <h1>Payment {status}</h1>
      <p>{copy[status] ?? copy.pending}</p>
    </MemberShell>
  );
}
