/**
 * Shared types for the in-memory domain store.
 * Import these instead of reaching into MemoryStore internals.
 */

export type JobInput = {
  jobId?: string;
  expectedVersion?: number;
  title: string;
  companyName: string;
  summary: string;
  opportunityKind: string;
  sector: string;
  workMode: string;
  roleFamilySlug?: string | null;
  locationLabel?: string;
  locationUnknown?: boolean;
  countryCode?: string | null;
  eligibleCountries?: string[];
  skills?: string[];
  requirements?: string[];
  eligibility?: string[];
  responsibilities?: string[];
  batchLabel?: string | null;
  durationLabel?: string | null;
  originalSourceLabel?: string | null;
  payDisplayLabel?: string | null;
  applyNote?: string | null;
  compensationType: string;
  payMinMinor?: number | null;
  payMaxMinor?: number | null;
  payCurrency?: string | null;
  payPeriod?: string | null;
  payBasis?: string | null;
  applicationMethod: "url" | "email" | "both";
  applicationUrl?: string | null;
  hrEmail?: string | null;
  emailSubject?: string | null;
  hrEmailApproved?: boolean;
  sourceId: string;
  sourceUrl: string;
  externalJobId?: string | null;
  sourcePublishedAt?: string | null;
  deadlineAt?: string | null;
  accessTier: "free" | "pro";
  verification?: string;
  government?: Record<string, string> | null;
  evidenceExcerpt?: string;
};

export type JobCard = {
  id: string;
  title: string;
  companyName: string;
  companyInitials: string;
  locationLabel: string;
  workMode: string;
  payLabel: string;
  opportunityKind: string;
  sector: string;
  skills: string[];
  requirements: string[];
  eligibility: string[];
  responsibilities: string[];
  batchLabel: string | null;
  durationLabel: string | null;
  originalSourceLabel: string | null;
  applyNote: string | null;
  summary: string;
  effectiveJobAt: string;
  publishedAt: string | null;
  firstSeenAt: string;
  datePrecision: "instant" | "date";
  sourcePublishedAt: string | null;
  lastCheckedAt: string | null;
  deadlineAt: string | null;
  accessTier: "free" | "pro";
  reasons: string[];
  applicationKind: "url" | "email" | "both";
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  saved: boolean;
};

export type FeedPage = {
  items: Array<{ type: "job"; job: JobCard }>;
  nextCursor: string | null;
  asOf: string;
  total: number;
};

export type FeedCursor = {
  sort: "latest" | "for_you";
  asOf: string;
  at: string;
  id: string;
  score?: number;
};

