# Domain store (`repositories/store`)

In-memory domain layer for jobs, users, feed, admin, billing, and agents.
Routes call `MemoryStore`; that class is a thin composition of the modules below.

## Where to look

| File | What it owns |
|---|---|
| `memory-store.ts` | Composes mixins into `MemoryStore` (API entry) |
| `store-core.ts` | DB handle, auth helpers, shared job lookups |
| `users.ts` | Sign-up, preferences, account |
| `feed.ts` | Member feed, saved jobs, activity |
| `jobs.ts` | Create / publish / archive / delete listings |
| `admin.ts` | Admin overview, sources, campaigns, flags |
| `agents.ts` | Agent credentials + batch intake |
| `billing.ts` | Orders, referrals, payouts |
| `types.ts` | Shared types (`JobInput`, `JobCard`, `FeedPage`, …) |
| `helpers.ts` | Card mapping, feed cursors, small utilities |
| `index.ts` | Public exports for the folder |

## How composition works

```
StoreCore
  → WithUsers
  → WithFeed
  → WithJobs
  → WithAdmin
  → WithAgents
  → WithBilling
  → MemoryStore
```

Each `WithX` file adds methods for one concern. Behavior is unchanged from the old monolithic `memory.ts`.

## Common edits

| Change | Open |
|---|---|
| Feed ranking / pagination | `feed.ts`, `helpers.ts` |
| JSON / admin posting rules | `jobs.ts` |
| Duplicate / archive / 14-day visibility | `jobs.ts`, `store-core.ts` |
| Agent / scraper intake | `agents.ts` |
| Payments / referrals | `billing.ts` |

## Imports

```ts
import { MemoryStore, type JobInput } from "@/repositories/store";
// Legacy path still works:
import { MemoryStore } from "@/repositories/memory";
```
