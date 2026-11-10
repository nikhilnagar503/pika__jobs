# Decisions

- The executable business rules live in TypeScript and are covered by Vitest. Postgres migrations mirror the same tables for the Supabase project. The local app uses a file store so it can run before that project exists.
- `cacheComponents` from the Next.js 16 starter is left off. Job visibility and pay entitlements must be checked on each request, and a cached payload must not keep a listing visible after its cutoff.
- The draft Pro price is INR 199 for 30 days, taken from the blueprint. Checkout stays disabled until payments are explicitly configured.
- The first verified local or Supabase account for nagarn603@gmail.com receives admin and finance once. The email is not checked again as a password.
- Homepage samples use fictional employers and a visible Sample listing label. They are not inserted into `jobs_current`.
- A missing salary is stored as null and rendered as "Pay not disclosed". An unpaid internship is a separate type with zero amounts.
