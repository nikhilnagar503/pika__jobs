import { AppError, jsonError } from "@/server/http";
import { safeEqualHex, webhookSignature } from "@/server/domain/money";
import { withStore } from "@/server/repositories/file-store";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const secret = process.env.PIKAJOBS_TASK_SECRET;
    if (!secret) throw new AppError(503, "task_secret_missing", "The task runner secret is not configured.");
    const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const expected = webhookSignature("tasks", secret);
    if (!safeEqualHex(provided, expected) && provided !== secret) {
      throw new AppError(401, "invalid_token", "The task secret is not valid.");
    }
    const body = (await request.json()) as { task?: string };
    if (body.task !== "archive") throw new AppError(422, "unknown_task", "That task is not allowed.");
    const result = await withStore((store) => store.archiveDue(new Date()));
    return Response.json(result);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
