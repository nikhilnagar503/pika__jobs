import { run } from "@/server/api";

export async function POST(request: Request) {
  const body = (await request.json()) as { amountMinor?: number; beneficiaryMasked?: string };
  return run(request, (store, actor) => store.requestPayout(actor, {
    amountMinor: Number(body.amountMinor ?? 0),
    beneficiaryMasked: String(body.beneficiaryMasked ?? ""),
  }), true);
}
