import { AppError } from "@/http";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata.internal"]);

export function assertPublicHttpUrl(value: string, field = "url"): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(422, "invalid_url", `Enter a valid ${field}.`, [{ field, message: "Invalid URL" }]);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError(422, "invalid_url", "Only http and https links are allowed.", [
      { field, message: "Unsupported protocol" },
    ]);
  }
  if (url.username || url.password) {
    throw new AppError(422, "invalid_url", "Links cannot contain credentials.", [{ field, message: "Credentials in URL" }]);
  }
  return url;
}

export function isBlockedFetchTarget(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return true;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return true;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) return true;
  return isPrivateIp(host);
}

function isPrivateIp(host: string): boolean {
  const mapped = host.startsWith("::ffff:") ? host.slice(7) : host;
  if (mapped === "::1" || mapped === "0.0.0.0") return true;
  const ipv4 = mapped.split(".").map((part) => Number(part));
  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = ipv4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  const lower = mapped.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

export function buildMailto(email: string, subject: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(422, "invalid_email", "The HR email is not usable.");
  }
  const safeSubject = subject.replace(/[\r\n]+/g, " ").slice(0, 180);
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(safeSubject)}`;
}

export function plainText(value: string, max = 4000): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function escapeCsvCell(value: string): string {
  const formula = /^[=+\-@]/.test(value);
  const safe = formula ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}
