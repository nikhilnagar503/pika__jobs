import { jsonError } from "@/server/http";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const requestId = crypto.randomUUID();
  try {
    const body = await withStore(async (store) => store.getJob(await readActor(store), id));
    if (body.status === "sign_in") return Response.json({ code: "sign_in_required", message: "Sign in to view this listing.", request_id: requestId }, { status: 401 });
    if (body.status === "upgrade") return Response.json({ code: "pro_required", message: "This listing is in the Pro collection.", teaser: body.teaser, request_id: requestId }, { status: 403 });
    if (body.status !== "ok") return Response.json({ code: "not_available", message: "This listing is not available.", request_id: requestId }, { status: 404 });
    return Response.json(body.job);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
