import type { JobInput } from "@/repositories/memory";

export type ImportJobDraft = Omit<JobInput, "sourceId"> & {
  importKey: string;
  skipped?: boolean;
  skipReason?: string;
};

export type ImportParseResult = {
  format: "catalog" | "tracker" | "unknown";
  category: string | null;
  generatedDate: string | null;
  drafts: ImportJobDraft[];
  skipped: Array<{ key: string; reason: string }>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanAlertNoise(value: string): string {
  return value
    .replace(/🚨\s*Opportunity Alert\s*🚨/gi, "")
    .replace(/Opportunity Alert/gi, "")
    .replace(/🚨/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function mapWorkMode(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes("remote")) return "remote";
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("field")) return "field";
  if (value.includes("on-site") || value.includes("onsite") || value.includes("in-office") || value.includes("office")) {
    return "on_site";
  }
  return "not_stated";
}

function mapOpportunityKind(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes("intern")) return "internship";
  if (value.includes("apprentice")) return "apprenticeship";
  if (value.includes("freelance") || value.includes("contract")) return "freelance";
  if (value.includes("fellow")) return "fellowship";
  return "job";
}

function mapCompensationType(raw: string, opportunityKind: string): string {
  const value = raw.toLowerCase();
  if (value.includes("stipend")) return "stipend";
  if (value.includes("salary") || value.includes("ctc") || value.includes("lpa")) return "salary";
  if (opportunityKind === "internship") return "stipend";
  return "not_disclosed";
}

function mapRoleFamily(raw: string): string | null {
  const value = raw.toLowerCase();
  if (!value) return null;
  if (value.includes("ml") || value.includes("ai") || value.includes("data")) return "data-ai";
  if (value.includes("product")) return "product";
  if (value.includes("design")) return "design";
  if (value.includes("frontend") || value.includes("backend") || value.includes("full") || value.includes("swe") || value.includes("sde")) {
    return "software-it";
  }
  return "software-it";
}

function extractMailto(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("mailto:")) return null;
  const email = trimmed.slice("mailto:".length).split("?")[0]?.trim();
  return email || null;
}

function parseApplyLink(applyLink: string): {
  applicationMethod: "url" | "email" | "both";
  applicationUrl: string | null;
  hrEmail: string | null;
  hrEmailApproved: boolean;
  sourceUrl: string;
} {
  const email = extractMailto(applyLink);
  if (email) {
    return {
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail: email,
      hrEmailApproved: true,
      sourceUrl: "https://pikajobs.com",
    };
  }
  if (/^https?:\/\//i.test(applyLink)) {
    return {
      applicationMethod: "url",
      applicationUrl: applyLink,
      hrEmail: null,
      hrEmailApproved: false,
      sourceUrl: applyLink,
    };
  }
  return {
    applicationMethod: "url",
    applicationUrl: null,
    hrEmail: null,
    hrEmailApproved: false,
    sourceUrl: "https://pikajobs.com",
  };
}

function durationFromJobType(jobType: string): string | null {
  const match = jobType.match(/(\d+\s*months?)/i);
  return match ? match[1] : null;
}

function draftFromCatalogJob(raw: Record<string, unknown>, index: number): ImportJobDraft | { skipped: true; key: string; reason: string } {
  const title = cleanAlertNoise(asString(raw.job_title) || asString(raw.role) || asString(raw.title));
  const company = cleanAlertNoise(asString(raw.company) || asString(raw.company_name));
  const applyLink =
    asString(raw.direct_application_url) ||
    asString(raw.apply_link) ||
    asString(raw.application_url) ||
    asString(raw.url);
  const key = asString(raw.id) || `${company}-${title}-${index}`;

  if (!title || !company) {
    return { skipped: true, key, reason: "Missing job title or company." };
  }
  if (!applyLink) {
    return { skipped: true, key, reason: "Missing application link." };
  }

  const opportunityKind = mapOpportunityKind(asString(raw.job_type) || asString(raw.role_type) || title);
  const location = asString(raw.location);
  const batches = asStringArray(raw.eligible_batches);
  const skills = asStringArray(raw.key_skills).length
    ? asStringArray(raw.key_skills)
    : asStringArray(raw.skills);
  const apply = parseApplyLink(applyLink);
  const compensation = asString(raw.compensation) || asString(raw.stipend);
  const experience = asString(raw.experience_level);
  const institutions = asString(raw.target_institutions);
  const postedRaw = asString(raw.posted_date) || asString(raw.posted_or_seen_time);
  let sourcePublishedAt: string | null = null;
  if (postedRaw) {
    const parsed = new Date(postedRaw.replace(" IST", "").replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) sourcePublishedAt = parsed.toISOString();
  }
  const summaryParts = [
    experience ? `Level: ${experience}.` : "",
    institutions ? `Target: ${institutions}.` : "",
    compensation ? `Pay: ${compensation}.` : "",
    location ? `Location: ${location}.` : "",
  ].filter(Boolean);

  return {
    importKey: key,
    title,
    companyName: company,
    summary: cleanAlertNoise(summaryParts.join(" ") || `${title} at ${company}`).slice(0, 400),
    opportunityKind,
    sector: "private",
    workMode: mapWorkMode(asString(raw.work_arrangement) || location),
    roleFamilySlug: mapRoleFamily(asString(raw.role_type) || title),
    locationLabel: location || "India",
    locationUnknown: !location,
    skills: skills.slice(0, 8),
    eligibility: [
      ...(batches.length ? [`Eligible batches: ${batches.join("/")}`] : []),
      ...(institutions ? [institutions] : []),
      ...(experience ? [experience] : []),
    ].slice(0, 6),
    requirements: skills.slice(0, 8).map((skill) => `Skill: ${skill}`),
    responsibilities: [],
    batchLabel: batches.length ? batches.join("/") : null,
    durationLabel: durationFromJobType(asString(raw.job_type)),
    originalSourceLabel: asString(raw.source) || asString(raw.category) || "JSON import",
    payDisplayLabel: compensation || null,
    compensationType: mapCompensationType(asString(raw.compensation_type) || compensation, opportunityKind),
    payCurrency: "INR",
    payPeriod: /lpa|year|ctc/i.test(compensation) ? "yearly" : "monthly",
    applicationMethod: apply.applicationMethod,
    applicationUrl: apply.applicationUrl,
    hrEmail: apply.hrEmail,
    hrEmailApproved: apply.hrEmailApproved,
    emailSubject: `${title} application`,
    sourceUrl: apply.sourceUrl,
    externalJobId: key.slice(0, 120),
    sourcePublishedAt,
    accessTier: "free",
    evidenceExcerpt: `${title} at ${company}. Imported from admin JSON upload.`,
  };
}

function collectTrackerJobs(payload: Record<string, unknown>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const key of ["jobs", "telegram_jobs", "scraped_jobs", "listings"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") rows.push(item as Record<string, unknown>);
      }
    }
  }
  return rows;
}

export function parseJobImportJson(payload: unknown): ImportParseResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("JSON root must be an object with a jobs array.");
  }
  const root = payload as Record<string, unknown>;
  const rows = collectTrackerJobs(root);
  if (!rows.length) {
    throw new Error("No jobs found. Expected keys like jobs, telegram_jobs, or scraped_jobs.");
  }

  const hasCatalogFields = rows.some((row) => "job_title" in row || "direct_application_url" in row);
  const hasTrackerFields = rows.some((row) => "role" in row || "apply_link" in row);
  const format = hasCatalogFields ? "catalog" : hasTrackerFields ? "tracker" : "unknown";

  const drafts: ImportJobDraft[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];

  rows.forEach((row, index) => {
    const mapped = draftFromCatalogJob(
      {
        ...row,
        job_title: row.job_title ?? row.role ?? row.title,
        direct_application_url: row.direct_application_url ?? row.apply_link,
        compensation: row.compensation ?? row.stipend,
        work_arrangement: row.work_arrangement ?? row.location,
        job_type: row.job_type ?? row.role_type,
      },
      index,
    );

    if ("skipped" in mapped && mapped.skipped) {
      skipped.push({ key: mapped.key, reason: mapped.reason });
      return;
    }
    drafts.push(mapped as ImportJobDraft);
  });

  return {
    format,
    category: asString(root.category) || null,
    generatedDate: asString(root.generated_date) || asString(root.date) || null,
    drafts,
    skipped,
  };
}
