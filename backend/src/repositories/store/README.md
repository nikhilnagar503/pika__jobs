# Domain store (`repositories/store`)

In-memory / file domain layer for the **live** product: users, jobs, feed, admin, agents.

## Where to look

| File | What it owns |
|---|---|
| `memory-store.ts` | Composes mixins into `MemoryStore` |
| `store-core.ts` | DB handle, auth helpers, job lookups |
| `users.ts` | Sign-up, preferences, account |
| `feed.ts` | Member feed, saved jobs, activity |
| `jobs.ts` | Create / publish / archive / delete |
| `admin.ts` | Overview, sources, flags |
| `agents.ts` | Agent credentials + batch intake |
| `types.ts` | Shared types (`JobInput`, `JobCard`, `FeedPage`) |
| `helpers.ts` | Card mapping, feed cursors |
| `index.ts` | Public exports |

## Not in this store (removed for now)

Payments, Pro entitlements, referrals, payouts, and ads — add back later when needed.

## Imports

```ts
import { MemoryStore, type JobInput } from "@/repositories/store";
```
