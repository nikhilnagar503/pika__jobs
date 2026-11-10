import { AppError, jsonError } from "@/server/http";
import { paymentsEnabled, withStore } from "@/server/repositories/file-store";
import { readActor } from "@/server/auth/session";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (!paymentsEnabled()) throw new AppError(503, "payments_disabled", "Payments are not open yet.");
    const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const order = await withStore(async (store) => {
      const actor = await readActor(store);
      return store.createOrder(actor, {
        async createOrder(input) {
          const response = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt }),
          });
          if (!response.ok) throw new Error("provider_rejected");
          return response.json() as Promise<{ id: string }>;
        },
      });
    });
    return Response.json({ orderId: order.id, providerOrderId: order.providerOrderId, keyId, amountMinor: order.productMinor + order.taxMinor, currency: order.currency });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
