import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, type Database } from "@/repositories/db";
import { seedDemoListings } from "@/repositories/demo-seed";
import { MemoryStore } from "@/repositories/memory";
import {
  loadPostgresDatabase,
  postgresConfigured,
  postgresLooksEmpty,
  savePostgresDatabase,
} from "@/repositories/postgres-store";

function dataDir(): string {
  if (process.env.PIKAJOBS_DATA_DIR) return process.env.PIKAJOBS_DATA_DIR;
  if (process.env.VERCEL) return path.join("/tmp", "pikajobs-data");
  return path.join(process.cwd(), ".data");
}

function dataFilePath(): string {
  return path.join(dataDir(), "store.json");
}

let queue: Promise<unknown> = Promise.resolve();
let memoryDb: Database | null = null;

function readJsonDatabase(): Database {
  const dataFile = dataFilePath();
  try {
    if (!existsSync(dataFile)) return createDatabase();
    const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as Partial<Database>;
    const fresh = createDatabase();
    return {
      ...fresh,
      flags: { ...fresh.flags, ...(parsed.flags ?? {}) },
      demoSeedVersion: typeof parsed.demoSeedVersion === "string" ? parsed.demoSeedVersion : "",
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
      audit: parsed.audit ?? [],
      bootstrapConsumed: parsed.bootstrapConsumed ?? false,
    };
  } catch {
    return createDatabase();
  }
}

function writeJsonDatabase(db: Database) {
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

async function readDatabase(): Promise<Database> {
  if (memoryDb) return memoryDb;
  if (!postgresConfigured()) {
    memoryDb = readJsonDatabase();
    return memoryDb;
  }
  let db = await loadPostgresDatabase();
  if (postgresLooksEmpty(db)) {
    const fromFile = readJsonDatabase();
    if (!postgresLooksEmpty(fromFile)) {
      await savePostgresDatabase(fromFile);
      db = fromFile;
    }
  }
  memoryDb = db;
  return memoryDb;
}

async function writeDatabase(db: Database) {
  memoryDb = db;
  if (postgresConfigured()) {
    await savePostgresDatabase(db);
    return;
  }
  writeJsonDatabase(db);
}

export async function withStore<T>(
  fn: (store: MemoryStore) => Promise<T> | T,
  options: { persist?: boolean } = {},
): Promise<T> {
  const persist = options.persist !== false;
  const run = queue.then(async () => {
    const store = new MemoryStore(await readDatabase());
    const publishedBefore = store.db.jobsCurrent.some((job) => job.lifecycle === "published");
    const seedVersionBefore = store.db.demoSeedVersion;
    const usersBefore = store.db.users.length;
    seedDemoListings(store);
    const result = await fn(store);
    const seeded = !publishedBefore && store.db.jobsCurrent.some((job) => job.lifecycle === "published");
    const seedChanged = store.db.demoSeedVersion !== seedVersionBefore;
    const usersChanged = store.db.users.length !== usersBefore;
    if (persist || seeded || seedChanged || usersChanged) await writeDatabase(store.db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Prefer this for admin/read pages so we do not rewrite the database on every view. */
export async function withStoreRead<T>(fn: (store: MemoryStore) => Promise<T> | T): Promise<T> {
  return withStore(fn, { persist: false });
}
