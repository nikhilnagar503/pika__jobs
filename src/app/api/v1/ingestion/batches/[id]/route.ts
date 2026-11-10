import { run } from "@/server/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(request, (store, actor) => store.getBatch(actor, id));
}
