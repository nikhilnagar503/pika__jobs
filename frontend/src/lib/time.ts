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
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;

  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
