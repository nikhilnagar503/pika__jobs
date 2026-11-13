import { product } from "@/shared/product";

export function computeVisibleUntil(effectiveJobAt: Date, deadlineAt: Date | null): Date {
  const windowEnd = new Date(effectiveJobAt.getTime() + product.visibilityWindowMs);
  if (!deadlineAt) return windowEnd;
  return deadlineAt.getTime() < windowEnd.getTime() ? deadlineAt : windowEnd;
}

export function listingVisibleUntil(job: {
  effectiveJobAt: string;
  deadlineAt?: string | null;
}): Date {
  return computeVisibleUntil(
    new Date(job.effectiveJobAt),
    job.deadlineAt ? new Date(job.deadlineAt) : null,
  );
}

export function isVisibleAt(visibleUntil: Date, now: Date): boolean {
  return now.getTime() < visibleUntil.getTime();
}

export function endOfDayKolkata(dateOnly: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    throw new Error("Date-only values must use YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
}

export function resolveEffectiveJobAt(input: {
  sourcePublishedAt: Date | null;
  firstSeenAt: Date;
  existingEffectiveJobAt?: Date | null;
  now: Date;
}): { effectiveJobAt: Date; reviewReason: string | null } {
  if (input.existingEffectiveJobAt) {
    return { effectiveJobAt: input.existingEffectiveJobAt, reviewReason: null };
  }
  if (!input.sourcePublishedAt) {
    return { effectiveJobAt: input.firstSeenAt, reviewReason: null };
  }
  if (input.sourcePublishedAt.getTime() > input.now.getTime() + 60_000) {
    return {
      effectiveJobAt: input.firstSeenAt,
      reviewReason: "The source date is in the future and needs review.",
    };
  }
  return { effectiveJobAt: input.sourcePublishedAt, reviewReason: null };
}

export function publicationBlockReason(effectiveJobAt: Date, visibleUntil: Date, now: Date): string | null {
  if (!isVisibleAt(visibleUntil, now)) {
    return "This listing is already outside the 7 day visibility window and cannot be published as a fresh job.";
  }
  if (effectiveJobAt.getTime() > now.getTime() + 60_000) {
    return "The effective date is in the future and needs review.";
  }
  return null;
}
