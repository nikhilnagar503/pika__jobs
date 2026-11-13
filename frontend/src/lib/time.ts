const FEED_TZ = "Asia/Kolkata";

export function listingPostedAt(job: {
  publishedAt?: string | null;
  firstSeenAt?: string;
  effectiveJobAt?: string;
}): string | null {
  return job.publishedAt || job.firstSeenAt || job.effectiveJobAt || null;
}

export function calendarDayKey(iso: string | null | undefined, now = new Date()): string {
  const date = iso ? new Date(iso) : now;
  const value = Number.isNaN(date.getTime()) ? now : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FEED_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function feedDayLabel(iso: string | null | undefined, now = new Date()): string {
  const key = calendarDayKey(iso, now);
  const today = calendarDayKey(now.toISOString(), now);
  if (key === today) return "Today";
  if (key === shiftDayKey(today, -1)) return "Yesterday";
  const date = iso ? new Date(iso) : now;
  const value = Number.isNaN(date.getTime()) ? now : date;
  return value.toLocaleDateString("en-IN", {
    timeZone: FEED_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function groupByFeedDay<T>(
  items: T[],
  getIso: (item: T) => string | null | undefined,
  now = new Date(),
): Array<{ key: string; label: string; items: T[] }> {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of items) {
    const iso = getIso(item);
    const key = calendarDayKey(iso, now);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: feedDayLabel(iso, now), items: [item] });
    }
  }
  return groups;
}

export function formatRelativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Just posted";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Just posted";
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "Just posted";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return then.toLocaleDateString("en-IN", {
    timeZone: FEED_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
