# Implementation status

Checked against the 2 November 2026 blueprint. This is a working local application, not a launched service.

## Done

- Next.js 16 and TypeScript app with the public pages, signup gate, onboarding, feed, job detail, saves, activity, referrals, account, checkout shell, and admin workspace.
- Domain rules covered by `npm test`: 30 day visibility cutoff, unknown pay versus unpaid, filter logic, 10,000-row cursor pages, anonymous and free/Pro access, email drafts, intake idempotency, token scope, commission, entitlement replay, refunds, payout reservation, and ad placement.
- Local file store at `.data/store.json`, with the same rules the tests exercise.
- SQL migration for one Postgres database, current and archive tables, RLS, and a one-time admin bootstrap function.
- Razorpay order, callback verification, and raw-body webhook routes. They refuse to run until keys and `PIKAJOBS_PAYMENTS_ENABLED=true` are set.
- Scoped agent intake at `POST /api/v1/ingestion/jobs` and a no-write dry run.

## Not done until the owner supplies accounts

- Supabase project `pikajobs` (`rwjmkuzthumntgqoaywd`, Mumbai) exists under org Pikajobs. Schema migrations `0001` and `0002` are applied.
- Supabase Auth is the only account path: magic-link email, `/auth/callback`, profile sync, and one-time `bootstrap_admin` for `nagarn603@gmail.com`. Local cookie sign-in was removed. Google sign-in is not enabled.
- The running app still uses the file store for jobs and money. Set `PIKAJOBS_DATA_MODE=supabase` only after the Postgres adapter is finished and `DATABASE_URL` / service role are set.
- No live Razorpay order has been created. No payout has been sent.
- No employer source has been fetched. `PIKAJOBS_SOURCE_FETCH` stays false. There is no LinkedIn collector.
- Legal pages are drafts. Do not collect money until they are replaced with approved business details.
- Ads stay off until an admin saves a real campaign and enables the flag.

## Commands run

- `npm install`
- `npm test` — 18 tests passed
- `npx tsc --noEmit`
- `npx next build` — production build completed

Browser checks on the local server: homepage, adult signup, onboarding skip, empty feed, admin overview for the bootstrap account, and the closed pricing button. The narrow header wraps instead of covering the wordmark, and public pages show Feed after sign-in.
