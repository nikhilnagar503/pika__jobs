import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, type Database } from "@/server/repositories/db";
import { MemoryStore } from "@/server/repositories/memory";

const dataFile = path.join(process.cwd(), ".data", "store.json");
let queue: Promise<unknown> = Promise.resolve();

function readDatabase(): Database {
  if (!existsSync(dataFile)) return createDatabase();
  const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as Partial<Database>;
  const fresh = createDatabase();
  return {
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
}

function writeDatabase(db: Database) {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(db));
  renameSync(temporary, dataFile);
}

export function paymentsEnabled(): boolean {
  return process.env.PIKAJOBS_PAYMENTS_ENABLED === "true" && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function withStore<T>(fn: (store: MemoryStore) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const store = new MemoryStore(readDatabase(), { paymentsEnabled: paymentsEnabled() });
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
