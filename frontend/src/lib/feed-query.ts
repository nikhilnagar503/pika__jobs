export const LOCATION_CHIPS = [
  "Remote",
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi",
  "Chennai",
] as const;

export const WORK_MODE_CHIPS = [
  { slug: "remote", label: "Remote" },
  { slug: "hybrid", label: "Hybrid" },
  { slug: "on_site", label: "On site" },
] as const;

export const STIPEND_OPTIONS = [
  { label: "Any", value: "" },
  { label: "₹5,000+", value: "500000" },
  { label: "₹10,000+", value: "1000000" },
  { label: "₹15,000+", value: "1500000" },
  { label: "₹25,000+", value: "2500000" },
] as const;

export const CTC_OPTIONS = [
  { label: "Any", value: "" },
  { label: "₹3 LPA+", value: "30000000" },
  { label: "₹6 LPA+", value: "60000000" },
  { label: "₹10 LPA+", value: "100000000" },
  { label: "₹15 LPA+", value: "150000000" },
] as const;

export const DURATION_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1–3 months", value: "1-3" },
  { label: "3–6 months", value: "3-6" },
  { label: "6+ months", value: "6-plus" },
] as const;

export type FeedQuery = {
  q: string;
  kind: string;
  location: string;
  mode: string[];
  payMin: string;
  payPeriod: string;
  duration: string;
};

export function readFeedQuery(params: URLSearchParams): FeedQuery {
  const mode = (params.get("mode") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    q: params.get("q") || "",
    kind: params.get("kind") || "",
    location: params.get("location") || "",
    mode,
    payMin: params.get("payMin") || "",
    payPeriod: params.get("payPeriod") || "",
    duration: params.get("duration") || "",
  };
}

export function feedQueryKey(query: FeedQuery): string {
  return [
    query.q,
    query.kind,
    query.location,
    query.mode.slice().sort().join(","),
    query.payMin,
    query.payPeriod,
    query.duration,
  ].join("|");
}

export function activeFilterCount(query: FeedQuery): number {
  return [
    query.kind,
    query.location,
    query.mode.length ? "mode" : "",
    query.payMin,
    query.duration,
  ].filter(Boolean).length;
}

export function toFeedSearchParams(query: FeedQuery): URLSearchParams {
  const next = new URLSearchParams();
  if (query.q) next.set("q", query.q);
  if (query.kind) next.set("kind", query.kind);
  if (query.location) next.set("location", query.location);
  if (query.mode.length) next.set("mode", query.mode.join(","));
  if (query.payMin) {
    next.set("payMin", query.payMin);
    if (query.payPeriod) next.set("payPeriod", query.payPeriod);
    next.set("unknown", "0");
  }
  if (query.duration) next.set("duration", query.duration);
  return next;
}

export function toFeedApiQuery(query: FeedQuery): URLSearchParams {
  const next = toFeedSearchParams(query);
  next.set("sort", "latest");
  return next;
}
