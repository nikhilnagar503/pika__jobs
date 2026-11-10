import { run } from "@/server/api";

async function intake(request: Request, dryRun: boolean) {
  const raw = await request.json();
  const key = request.headers.get("idempotency-key") ?? "";
  return run(request, (store, actor) => store.submitBatch(actor, raw, key, dryRun), true);
}

export async function POST(request: Request) {
  return intake(request, false);
}
