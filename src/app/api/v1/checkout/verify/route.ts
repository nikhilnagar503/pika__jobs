import { AppError, assertSameOrigin, jsonError } from "@/server/http";
import { checkoutSignature, safeEqualHex } from "@/server/domain/money";
import { paymentsEnabled, withStore } from "@/server/repositories/file-store";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    if (!paymentsEnabled()) throw new AppError(503, "payments_disabled", "Payments are not open yet.");
    const body = (await request.json()) as { providerOrderId?: string; providerPaymentId?: string; signature?: string };
    const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const signatureValid = Boolean(
      body.providerOrderId &&
        body.providerPaymentId &&
        body.signature &&
        safeEqualHex(body.signature, checkoutSignature(body.providerOrderId, body.providerPaymentId, secret)),
    );
    if (!signatureValid) throw new AppError(400, "bad_signature", "The payment signature is not valid.");
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const payment = await fetch(`https://api.razorpay.com/v1/payments/${body.providerPaymentId}`, {
      headers: { authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
    });
    if (!payment.ok) throw new AppError(503, "provider_uncertain", "The payment could not be confirmed with Razorpay.");
    const payload = (await payment.json()) as { id: string; order_id: string; amount: number; currency: string; status: string };
    const result = await withStore((store) =>
      store.applyProviderEvent({
        providerEventId: `callback:${payload.id}`,
        type: payload.status === "captured" ? "payment.captured" : payload.status,
        providerOrderId: payload.order_id,
        providerPaymentId: payload.id,
        amountMinor: payload.amount,
        currency: payload.currency,
        captured: payload.status === "captured",
        signatureValid: true,
      }),
    );
    return Response.json({ ...result, status: payload.status === "captured" ? "success" : "pending" });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
