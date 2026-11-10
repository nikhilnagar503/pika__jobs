import { run } from "@/server/api";

export async function POST(request: Request) {
  const raw = await request.json();
  const key = request.headers.get("idempotency-key") ?? "dry-run";
  return run(request, (store, actor) => store.submitBatch(actor, raw, key, true), true);
}
