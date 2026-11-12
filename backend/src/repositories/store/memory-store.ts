/**
 * MemoryStore — composed domain store used by the API.
 *
 * Layout:
 *   store-core  → shared db + lookups
 *   users       → accounts / preferences
 *   feed        → member feed + saved/activity
 *   jobs        → save / publish / archive
 *   admin       → admin ops + sources
 *   agents      → credentials + intake batches
 */
import { createDatabase } from "@/repositories/db";
import { WithAdmin } from "@/repositories/store/admin";
import { WithAgents } from "@/repositories/store/agents";
import { WithFeed } from "@/repositories/store/feed";
import { WithJobs } from "@/repositories/store/jobs";
import { StoreCore, type StoreOptions } from "@/repositories/store/store-core";
import { WithUsers } from "@/repositories/store/users";

const ComposedStore = WithAgents(WithAdmin(WithJobs(WithFeed(WithUsers(StoreCore)))));

export class MemoryStore extends ComposedStore {
  constructor(db = createDatabase(), options: StoreOptions = {}) {
    super(db, options);
  }
}

export { createDatabase };
export type { StoreOptions };
