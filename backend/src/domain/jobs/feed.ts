import { labelOf, roleFamilies, workModes } from "@/shared/product";
import type { JobRecord, Preferences } from "@/domain/types";

export type FeedFilters = {
  q?: string;
  kinds: string[];
  roleFamilies: string[];
  sectors: string[];
  workModes: string[];
  countries: string[];
  payCurrency?: string;
  payPeriod?: string;
  payBasis?: string;
  minPayMinor?: number;
  includeUnknownPay: boolean;
  postedWithinDays?: number;
  tier?: "free" | "pro";
};

export function emptyFilters(): FeedFilters {
  return {
    kinds: [],
    roleFamilies: [],
    sectors: [],
    workModes: [],
    countries: [],
    includeUnknownPay: true,
  };
}

export function matchesFilters(job: JobRecord, filters: FeedFilters, asOf: Date): boolean {
  if (filters.q) {
    const haystack = [job.title, job.companyName, job.summary, job.locationLabel, ...job.skills]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }
  if (filters.kinds.length && !filters.kinds.includes(job.opportunityKind)) return false;
  if (filters.roleFamilies.length && !filters.roleFamilies.includes(job.roleFamilySlug ?? "")) return false;
  if (filters.sectors.length && !filters.sectors.includes(job.sector)) return false;
  if (filters.workModes.length && !filters.workModes.includes(job.workMode)) return false;
  if (filters.countries.length) {
    const wanted = filters.countries.map((item) => item.toLowerCase());
    const fields = [
      job.countryCode ?? "",
      job.locationLabel,
      ...job.eligibleCountries,
    ].map((item) => item.toLowerCase());
    const hit = wanted.some((country) => fields.some((field) => field === country || field.includes(country)));
    if (!hit) return false;
  }
  if (filters.tier && job.accessTier !== filters.tier) return false;
  if (filters.postedWithinDays != null) {
    const age = asOf.getTime() - new Date(job.effectiveJobAt).getTime();
    if (age > filters.postedWithinDays * 24 * 60 * 60 * 1000) return false;
  }

  const wantsPay =
    filters.minPayMinor != null || Boolean(filters.payCurrency || filters.payPeriod || filters.payBasis);
  const unknown = job.payMinMinor == null || job.compensationType === "not_disclosed";
  if (wantsPay) {
    const comparable =
      !unknown &&
      job.compensationType !== "unpaid" &&
      (!filters.payCurrency || job.payCurrency === filters.payCurrency) &&
      (!filters.payPeriod || job.payPeriod === filters.payPeriod) &&
      (!filters.payBasis || job.payBasis === filters.payBasis);
    if (!comparable) {
      if (!(filters.includeUnknownPay && unknown)) return false;
    } else if (filters.minPayMinor != null && (job.payMinMinor ?? 0) < filters.minPayMinor) {
      return false;
    }
  } else if (!filters.includeUnknownPay && unknown) {
    return false;
  }
  return true;
}

export function scoreJob(
  job: JobRecord,
  preferences: Preferences | null,
  asOf: Date,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const personalized = Boolean(
    preferences &&
      (preferences.roleFamilySlugs.length ||
        preferences.opportunityKinds.length ||
        preferences.workModes.length ||
        preferences.skillSlugs.length ||
        preferences.locationLabel),
  );
  if (personalized && preferences) {
    if (job.roleFamilySlug && preferences.roleFamilySlugs.includes(job.roleFamilySlug)) {
      score += 40;
      reasons.push(`Matches ${labelOf(roleFamilies, job.roleFamilySlug)}`);
    }
    if (preferences.opportunityKinds.includes(job.opportunityKind)) {
      score += 20;
      reasons.push(`Matches ${job.opportunityKind.replaceAll("_", " ")}`);
    }
    const workHit =
      (job.workMode !== "not_stated" && preferences.workModes.includes(job.workMode)) ||
      Boolean(preferences.locationLabel && job.locationLabel.toLowerCase().includes(preferences.locationLabel.toLowerCase()));
    if (workHit) {
      score += 15;
      reasons.push(
        preferences.workModes.includes(job.workMode)
          ? `Matches ${labelOf(workModes, job.workMode)}`
          : "Matches your location",
      );
    }
    const skills = new Set(preferences.skillSlugs.map((item) => item.toLowerCase()));
    const overlap = job.skills.find((skill) => skills.has(skill.toLowerCase()));
    if (overlap) {
      score += 15;
      reasons.push(`Matches ${overlap}`);
    }
  }
  score += freshnessPoints(job.effectiveJobAt, asOf);
  return { score, reasons };
}

export function freshnessPoints(effectiveJobAt: string, asOf: Date): number {
  const age = asOf.getTime() - new Date(effectiveJobAt).getTime();
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  if (age <= 0) return 10;
  if (age >= windowMs) return 0;
  return Math.round((10 * (windowMs - age)) / windowMs);
}

export function compareLatest(a: JobRecord, b: JobRecord): number {
  const time = new Date(b.effectiveJobAt).getTime() - new Date(a.effectiveJobAt).getTime();
  if (time !== 0) return time;
  return b.jobId < a.jobId ? -1 : b.jobId > a.jobId ? 1 : 0;
}
