import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, type Database } from "@/server/repositories/db";
import { seedDemoListings } from "@/server/repositories/demo-seed";
import { MemoryStore } from "@/server/repositories/memory";

function dataDir(): string {
  return process.env.VERCEL ? path.join("/tmp", "pikajobs-data") : path.join(process.cwd(), ".data");
}

function dataFilePath(): string {
  return path.join(dataDir(), "store.json");
}

let queue: Promise<unknown> = Promise.resolve();
let memoryDb: Database | null = null;

function readDatabase(): Database {
  if (memoryDb) return memoryDb;
  const dataFile = dataFilePath();
  try {
    if (!existsSync(dataFile)) {
      memoryDb = createDatabase();
      return memoryDb;
    }
    const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as Partial<Database>;
    const fresh = createDatabase();
    memoryDb = {
      ...fresh,
      ...parsed,
      flags: { ...fresh.flags, ...(parsed.flags ?? {}) },
      users: parsed.users ?? [],
      preferences: parsed.preferences ?? [],
      companies: parsed.companies ?? [],
      sources: parsed.sources ?? [],
      drafts: parsed.drafts ?? [],
      jobsCurrent: parsed.jobsCurrent ?? [],
      jobsArchive: parsed.jobsArchive ?? [],
      versions: parsed.versions ?? [],
      credentials: parsed.credentials ?? [],
      batches: parsed.batches ?? [],
      saved: parsed.saved ?? [],
      applications: parsed.applications ?? [],
      reports: parsed.reports ?? [],
      orders: parsed.orders ?? [],
      entitlements: parsed.entitlements ?? [],
      credits: parsed.credits ?? [],
      payouts: parsed.payouts ?? [],
      campaigns: parsed.campaigns ?? [],
      events: parsed.events ?? [],
      refundIds: parsed.refundIds ?? [],
      attributions: parsed.attributions ?? [],
      touches: parsed.touches ?? [],
      audit: parsed.audit ?? [],
      bootstrapConsumed: parsed.bootstrapConsumed ?? false,
    };
    return memoryDb;
  } catch {
    memoryDb = createDatabase();
    return memoryDb;
  }
}

function writeDatabase(db: Database) {
  memoryDb = db;
  const dataFile = dataFilePath();
  try {
    mkdirSync(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(db));
    renameSync(temporary, dataFile);
  } catch {
    // Keep the in-memory copy when the filesystem is not writable.
  }
}

export function paymentsEnabled(): boolean {
  return process.env.PIKAJOBS_PAYMENTS_ENABLED === "true" && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function withStore<T>(fn: (store: MemoryStore) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const store = new MemoryStore(readDatabase(), { paymentsEnabled: paymentsEnabled() });
    seedDemoListings(store);
    const result = await fn(store);
    writeDatabase(store.db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
