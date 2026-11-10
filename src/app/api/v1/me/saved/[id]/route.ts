import { run } from "@/server/api";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(request, (store, actor) => store.setSaved(actor, id, true), true);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(request, (store, actor) => store.setSaved(actor, id, false), true);
}
