export const product = {
  name: "Pikajobs",
  market: "India",
  currency: "INR",
  language: "en",
  minimumAge: 18,
  visibilityWindowMs: 14 * 24 * 60 * 60 * 1000,
  pageSize: 50,
  adminEmail: "nagarn603@gmail.com",
  rankingVersion: 1,
} as const;

export const opportunityKinds = [
  { slug: "job", label: "Job" },
  { slug: "internship", label: "Internship" },
  { slug: "apprenticeship", label: "Apprenticeship" },
  { slug: "freelance", label: "Freelance or contract" },
  { slug: "fellowship", label: "Fellowship" },
] as const;

export const sectors = [
  { slug: "private", label: "Private" },
  { slug: "government", label: "Government" },
  { slug: "psu", label: "Public sector undertaking" },
  { slug: "nonprofit", label: "Nonprofit" },
  { slug: "academic", label: "Academic or research" },
  { slug: "not_stated", label: "Not stated" },
] as const;

export const workModes = [
  { slug: "remote", label: "Remote" },
  { slug: "hybrid", label: "Hybrid" },
  { slug: "on_site", label: "On site" },
  { slug: "field", label: "Field based" },
  { slug: "not_stated", label: "Not stated" },
] as const;

export const roleFamilies = [
  { slug: "software-it", label: "Software and IT" },
  { slug: "data-ai", label: "Data, AI and analytics" },
  { slug: "cyber-infra", label: "Cybersecurity and infrastructure" },
  { slug: "core-engineering", label: "Core engineering" },
  { slug: "product", label: "Product and project management" },
  { slug: "design", label: "Design and creative" },
  { slug: "marketing", label: "Marketing and communications" },
  { slug: "sales", label: "Sales and business development" },
  { slug: "finance", label: "Finance and accounting" },
  { slug: "hr", label: "HR and recruiting" },
  { slug: "operations", label: "Operations and administration" },
  { slug: "support", label: "Customer support and success" },
  { slug: "healthcare", label: "Healthcare and allied services" },
  { slug: "education", label: "Education and research" },
  { slug: "legal", label: "Legal and compliance" },
  { slug: "retail", label: "Retail and hospitality" },
  { slug: "logistics", label: "Logistics and transportation" },
  { slug: "manufacturing", label: "Manufacturing and skilled trades" },
  { slug: "agriculture", label: "Agriculture and environment" },
  { slug: "public-service", label: "Public service and government administration" },
  { slug: "other", label: "Other" },
] as const;

export const experienceBands = [
  { slug: "0", label: "0 years" },
  { slug: "1-2", label: "1 to 2 years" },
  { slug: "3-5", label: "3 to 5 years" },
  { slug: "6-10", label: "6 to 10 years" },
  { slug: "10+", label: "10 plus years" },
] as const;

export const stages = [
  "Student",
  "Recent graduate or fresher",
  "Working professional",
  "Career switcher",
  "Returning to work",
  "Other",
] as const;

export function labelOf(
  list: readonly { slug: string; label: string }[],
  slug: string | null | undefined,
): string {
  return list.find((item) => item.slug === slug)?.label ?? "Not stated";
}

export function formatInr(minor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
