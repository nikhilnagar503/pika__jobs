import { run } from "@/server/api";

export async function PATCH(request: Request) {
  const body = await request.json();
  return run(request, (store, actor) => store.savePreferences(actor, body), true);
}
