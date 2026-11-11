const MINOR_DIGITS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KRW: 0,
};

export type PayInput = {
  compensationType: string;
  payMinMinor: number | null;
  payMaxMinor: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  payBasis: string | null;
  opportunityKind?: string;
};

const PERIOD_LABEL: Record<string, string> = {
  hourly: "hour",
  daily: "day",
  weekly: "week",
  monthly: "month",
  annual: "year",
  project: "project",
};

const BASIS_LABEL: Record<string, string> = {
  gross: "gross",
  ctc: "CTC",
  take_home: "take home",
  stipend: "stipend",
  project_fee: "project fee",
  not_stated: "",
};

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

export function formatMinor(amount: number, currency: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
}

export function formatPay(input: PayInput): string {
  if (input.compensationType === "unpaid") {
    return input.opportunityKind === "internship" || !input.opportunityKind
      ? "Unpaid internship"
      : "Unpaid";
  }
  if (input.compensationType === "commission_only" && input.payMinMinor == null) {
    return "Commission only";
  }
  const unknown =
    input.compensationType === "not_disclosed" ||
    input.payMinMinor == null ||
    !input.payCurrency;
  if (unknown) return "Pay not disclosed";

  const currency = input.payCurrency ?? "INR";
  const min = formatMinor(input.payMinMinor ?? 0, currency);
  const max =
    input.payMaxMinor != null && input.payMaxMinor !== input.payMinMinor
      ? formatMinor(input.payMaxMinor, currency)
      : null;
  const amount = max ? `${min} to ${max}` : min;
  const period = input.payPeriod ? PERIOD_LABEL[input.payPeriod] : null;
  const basis = input.payBasis ? BASIS_LABEL[input.payBasis] : "";
  const tail = [basis, period ? `per ${period}` : ""].filter(Boolean).join(" ");
  const commission = input.compensationType === "commission_only" ? " Commission only." : "";
  return tail ? `${amount} ${tail}${commission}` : `${amount}${commission}`;
}

export function payIsComparable(input: PayInput, filter: {
  currency?: string;
  period?: string;
  basis?: string;
}): boolean {
  if (input.compensationType === "unpaid" || input.compensationType === "not_disclosed") return false;
  if (input.payMinMinor == null || !input.payCurrency || !input.payPeriod) return false;
  if (filter.currency && input.payCurrency !== filter.currency) return false;
  if (filter.period && input.payPeriod !== filter.period) return false;
  if (filter.basis && input.payBasis !== filter.basis) return false;
  return true;
}

export function validatePay(input: PayInput): string | null {
  if (input.compensationType === "unpaid") {
    if (input.payMinMinor !== 0 || (input.payMaxMinor != null && input.payMaxMinor !== 0)) {
      return "Unpaid listings use zero amounts.";
    }
    return null;
  }
  if (input.compensationType === "not_disclosed" || input.payMinMinor == null) {
    if (input.payMinMinor != null || input.payMaxMinor != null) {
      return "Unknown pay must not store an amount.";
    }
    return null;
  }
  if (input.payMinMinor < 0 || (input.payMaxMinor != null && input.payMaxMinor < 0)) {
    return "Pay amounts cannot be negative.";
  }
  if (input.payMaxMinor != null && input.payMinMinor > input.payMaxMinor) {
    return "The minimum pay cannot exceed the maximum.";
  }
  if (!input.payCurrency || !input.payPeriod) {
    return "A disclosed amount needs a currency and period.";
  }
  return null;
}
