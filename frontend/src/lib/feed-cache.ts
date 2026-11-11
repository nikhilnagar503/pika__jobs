const TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = "pikajobs:feed-cache:";

type CacheEntry<T> = {
  data: T;
  savedAt: number;
};

const memory = new Map<string, CacheEntry<unknown>>();

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function getCached<T>(key: string): T | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.savedAt < TTL_MS) return mem.data;

  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt >= TTL_MS) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { data, savedAt: Date.now() };
  memory.set(key, entry);
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function invalidateCached(prefix = "") {
  for (const key of [...memory.keys()]) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key);
  }
  try {
    const remove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      if (!prefix || key.slice(STORAGE_PREFIX.length).startsWith(prefix)) remove.push(key);
    }
    for (const key of remove) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
