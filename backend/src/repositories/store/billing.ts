/** Orders, entitlements, referrals, and payouts. */
import { product } from "@/shared/product";
import {
  commissionMinor,
  entitlementWindow,
  referralCode,
} from "@/domain/money";
import type { Actor } from "@/domain/types";
import { AppError } from "@/http";
import {
  audit,
  balances,
  defaultPlan,
  type OrderRecord,
  type PayoutRecord,
} from "@/repositories/db";


import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithBilling<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
  createOrder(actor: Actor, razorpay: { createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ id: string }> }, now = new Date()): Promise<OrderRecord> {
    const user = this.user(actor);
    if (!this.paymentsOn()) throw new AppError(503, "payments_disabled", "Payments are not open yet.");
    const existing = this.db.orders.find((order) => order.userId === user.userId && order.planId === defaultPlan.id && (order.state === "pending" || order.state === "uncertain") && order.providerOrderId);
    if (existing) return Promise.resolve(existing);
    const attribution = this.db.attributions.find((item) => item.referredUserId === user.userId);
    const order: OrderRecord = {
      id: crypto.randomUUID(),
      userId: user.userId,
      planId: defaultPlan.id,
      productMinor: defaultPlan.priceMinor,
      taxMinor: 0,
      currency: defaultPlan.currency,
      days: defaultPlan.days,
      commissionable: defaultPlan.commissionable,
      rateBps: product.referralRateBps,
      referrerUserId: attribution?.referrerUserId ?? null,
      providerOrderId: null,
      state: "pending",
      createdAt: now.toISOString(),
      refundedProductMinor: 0,
    };
    this.db.orders.push(order);
    return razorpay.createOrder({ amount: order.productMinor + order.taxMinor, currency: order.currency, receipt: order.id }).then(
      (provider) => {
        order.providerOrderId = provider.id;
        return order;
      },
      (error: unknown) => {
        order.state = "uncertain";
        audit(this.db, user.userId, "order_uncertain", order.id, error instanceof Error ? error.name : "provider_error", now.toISOString());
        throw new AppError(503, "provider_uncertain", "The payment order could not be confirmed. Retry before starting another payment.");
      },
    );
  }

  applyProviderEvent(input: {
    providerEventId: string;
    type: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    captured: boolean;
    signatureValid: boolean;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    if (!input.signatureValid) throw new AppError(400, "bad_signature", "The payment signature is not valid.");
    if (this.db.events.some((event) => event.providerEventId === input.providerEventId)) {
      return { duplicate: true as const };
    }
    const order = this.db.orders.find((item) => item.providerOrderId === input.providerOrderId);
    if (!order) throw new AppError(404, "unknown_order", "The payment does not match a Pikajobs order.");
    if (input.captured && input.amountMinor !== order.productMinor + order.taxMinor) {
      throw new AppError(422, "amount_mismatch", "The captured amount does not match the order.");
    }
    if (input.captured && input.currency !== order.currency) {
      throw new AppError(422, "amount_mismatch", "The captured currency does not match the order.");
    }
    this.db.events.push({
      providerEventId: input.providerEventId,
      type: input.type,
      orderId: order.id,
      providerPaymentId: input.providerPaymentId,
      createdAt: now.toISOString(),
    });
    if (!input.captured || (input.type !== "payment.captured" && input.type !== "order.paid")) {
      return { duplicate: false as const, granted: false as const };
    }
    if (this.db.entitlements.some((item) => item.orderId === order.id)) {
      return { duplicate: true as const, granted: false as const };
    }
    const window = entitlementWindow({
      existingEnds: this.db.entitlements.filter((item) => item.userId === order.userId && item.state === "active").map((item) => new Date(item.endsAt)),
      purchaseAt: now,
      days: order.days,
    });
    this.db.entitlements.push({
      id: crypto.randomUUID(),
      userId: order.userId,
      orderId: order.id,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      state: "active",
    });
    order.state = "paid";
    const economicKey = `v1:${order.id}:${input.providerPaymentId}:earn`;
    if (order.commissionable && order.referrerUserId && !this.db.credits.some((item) => item.economicKey === economicKey)) {
      this.db.credits.push({
        id: crypto.randomUUID(),
        economicKey,
        referrerUserId: order.referrerUserId,
        referredUserId: order.userId,
        orderId: order.id,
        paymentId: input.providerPaymentId,
        currency: order.currency,
        amountMinor: commissionMinor(order.productMinor, order.rateBps),
        reversedMinor: 0,
        reservedMinor: 0,
        paidMinor: 0,
        availableAt: new Date(now.getTime() + product.referralHoldDays * 86400000).toISOString(),
        frozen: false,
        createdAt: now.toISOString(),
      });
    }
    return { duplicate: false as const, granted: true as const };
  }

  applyRefund(input: { refundId: string; providerPaymentId: string; productMinor: number; taxMinor: number; now?: Date }) {
    const now = input.now ?? new Date();
    if (this.db.refundIds.includes(input.refundId)) return { duplicate: true as const };
    const paymentEvent = this.db.events.find((item) => item.providerPaymentId === input.providerPaymentId);
    const order = paymentEvent ? this.db.orders.find((item) => item.id === paymentEvent.orderId) : undefined;
    const credit = this.db.credits.find((item) => item.paymentId === input.providerPaymentId && item.amountMinor > 0);
    if (!order) throw new AppError(404, "unknown_payment", "Refund does not match a payment.");
    if (input.productMinor > order.productMinor - order.refundedProductMinor) {
      throw new AppError(422, "refund_too_large", "The refund exceeds the remaining product amount.");
    }
    this.db.refundIds.push(input.refundId);
    order.refundedProductMinor += input.productMinor;
    if (order.refundedProductMinor >= order.productMinor && input.productMinor > 0) {
      order.state = "refunded";
      for (const entitlement of this.db.entitlements.filter((item) => item.orderId === order.id)) {
        entitlement.state = "revoked";
      }
    }
    const reversal = commissionMinor(input.productMinor, order.rateBps);
    if (credit && reversal > 0) {
      const open = credit.amountMinor - credit.reversedMinor - credit.reservedMinor - credit.paidMinor;
      const fromOpen = Math.min(Math.max(open, 0), reversal);
      credit.reversedMinor += fromOpen;
      const carry = reversal - fromOpen;
      if (carry > 0) {
        const key = `v1:${order.id}:${input.refundId}:carry`;
        if (!this.db.credits.some((item) => item.economicKey === key)) {
          this.db.credits.push({
            ...credit,
            id: crypto.randomUUID(),
            economicKey: key,
            amountMinor: -carry,
            reversedMinor: 0,
            reservedMinor: 0,
            paidMinor: 0,
            availableAt: now.toISOString(),
            frozen: false,
            createdAt: now.toISOString(),
          });
        }
      }
    }
    return { duplicate: false as const };
  }

  acceptReferralTerms(actor: Actor, now = new Date()) {
    const user = this.user(actor);
    if (!user.referralCode) {
      let code = referralCode();
      while (this.db.users.some((item) => item.referralCode === code)) code = referralCode();
      user.referralCode = code;
    }
    user.referralTermsAcceptedAt = now.toISOString();
    return { code: user.referralCode };
  }

  rememberTouch(cookieId: string, code: string, now = new Date()) {
    const referrer = this.db.users.find((user) => user.referralCode === code && user.referralTermsAcceptedAt);
    if (!referrer) return { accepted: false as const };
    const existing = this.db.touches.find((touch) => touch.cookieId === cookieId);
    if (!existing) this.db.touches.push({ cookieId, code, capturedAt: now.toISOString() });
    return { accepted: true as const };
  }

  referralDashboard(actor: Actor, now = new Date()) {
    const user = this.user(actor);
    const credits = this.db.credits.filter((item) => item.referrerUserId === user.userId && item.currency === "INR");
    const signups = this.db.attributions.filter((item) => item.referrerUserId === user.userId).length;
    const purchases = new Set(credits.filter((item) => item.amountMinor > 0).map((item) => item.orderId)).size;
    return {
      code: user.referralCode,
      termsAccepted: Boolean(user.referralTermsAcceptedAt),
      link: user.referralCode ? `/?ref=${user.referralCode}` : null,
      signups,
      purchases,
      balances: balances(credits, now),
      payouts: this.db.payouts.filter((item) => item.userId === user.userId),
    };
  }

  requestPayout(actor: Actor, input: { amountMinor: number; beneficiaryMasked: string }, now = new Date()): PayoutRecord {
    const user = this.user(actor);
    if (input.amountMinor < product.payoutMinimumMinor) {
      throw new AppError(422, "below_minimum", "The minimum payout is INR 500.");
    }
    const credits = this.db.credits.filter((item) => item.referrerUserId === user.userId && item.currency === "INR" && !item.frozen);
    const available = balances(credits, now).available;
    if (available < input.amountMinor) throw new AppError(422, "insufficient_balance", "The available balance is lower than the request.");
    let remaining = input.amountMinor;
    const allocations: { creditId: string; amountMinor: number }[] = [];
    for (const credit of credits) {
      if (remaining <= 0) break;
      const open = credit.amountMinor - credit.reversedMinor - credit.reservedMinor - credit.paidMinor;
      if (new Date(credit.availableAt).getTime() > now.getTime() || open <= 0) continue;
      const take = Math.min(open, remaining);
      credit.reservedMinor += take;
      remaining -= take;
      allocations.push({ creditId: credit.id, amountMinor: take });
    }
    if (remaining !== 0) throw new AppError(409, "reservation_failed", "The balance changed. Try again.");
    const payout: PayoutRecord = {
      id: crypto.randomUUID(),
      userId: user.userId,
      currency: "INR",
      amountMinor: input.amountMinor,
      status: "requested",
      allocations,
      beneficiaryMasked: input.beneficiaryMasked.slice(0, 40),
      evidence: null,
      createdAt: now.toISOString(),
    };
    this.db.payouts.push(payout);
    return payout;
  }

  settlePayout(actor: Actor, input: { payoutId: string; status: PayoutRecord["status"]; evidence?: { reference: string; amountMinor: number; settledAt: string } }, now = new Date()) {
    this.requireRole(actor, ["admin", "finance"]);
    const payout = this.db.payouts.find((item) => item.id === input.payoutId);
    if (!payout) throw new AppError(404, "not_found", "Payout not found.");
    if (payout.status === input.status) return payout;
    if (input.status === "paid") {
      if (!input.evidence?.reference || input.evidence.amountMinor !== payout.amountMinor) {
        throw new AppError(422, "evidence_required", "Record the settled amount, date, and bank reference before marking a payout paid.");
      }
      payout.evidence = input.evidence;
      for (const allocation of payout.allocations) {
        const credit = this.db.credits.find((item) => item.id === allocation.creditId);
        if (!credit) continue;
        credit.reservedMinor -= allocation.amountMinor;
        credit.paidMinor += allocation.amountMinor;
      }
    }
    if (input.status === "failed" || input.status === "rejected") {
      if (payout.status === "paid") throw new AppError(409, "already_paid", "A paid payout cannot be failed. Record a reversal.");
      this.releaseReservation(payout);
    }
    if (input.status === "reversed") {
      if (payout.status !== "paid" || payout.evidence == null) throw new AppError(409, "not_paid", "Only a settled payout can be reversed.");
      for (const allocation of payout.allocations) {
        const credit = this.db.credits.find((item) => item.id === allocation.creditId);
        if (!credit) continue;
        credit.paidMinor -= allocation.amountMinor;
      }
    }
    payout.status = input.status;
    audit(this.db, this.actorId(actor), "payout_status", payout.id, input.status, now.toISOString());
    return payout;
  }

  protected releaseReservation(payout: PayoutRecord) {
    if (payout.status === "failed" || payout.status === "rejected" || payout.status === "reversed") return;
    for (const allocation of payout.allocations) {
      const credit = this.db.credits.find((item) => item.id === allocation.creditId);
      if (!credit) continue;
      credit.reservedMinor = Math.max(0, credit.reservedMinor - allocation.amountMinor);
    }
  }
  };
}
