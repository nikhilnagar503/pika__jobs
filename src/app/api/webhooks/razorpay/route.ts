import { AppError, jsonError } from "@/server/http";
import { safeEqualHex, webhookSignature } from "@/server/domain/money";
import { withStore } from "@/server/repositories/file-store";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new AppError(503, "payments_disabled", "The webhook secret is not configured.");
    const raw = await request.text();
    const provided = request.headers.get("x-razorpay-signature") ?? "";
    if (!safeEqualHex(provided, webhookSignature(raw, secret))) {
      throw new AppError(400, "bad_signature", "The webhook signature is not valid.");
    }
    const body = JSON.parse(raw) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } };
    };
    const payment = body.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id) return Response.json({ received: true, ignored: true });
    const result = await withStore((store) =>
      store.applyProviderEvent({
        providerEventId: request.headers.get("x-razorpay-event-id") ?? `${body.event}:${payment.id}`,
        type: body.event ?? payment.status ?? "unknown",
        providerOrderId: payment.order_id ?? "",
        providerPaymentId: payment.id ?? "",
        amountMinor: payment.amount ?? 0,
        currency: payment.currency ?? "INR",
        captured: payment.status === "captured",
        signatureValid: true,
      }),
    );
    return Response.json({ received: true, ...result });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
