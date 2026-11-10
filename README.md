# Pikajobs

Pikajobs is a curated job discovery site for adults in India. People sign up, optionally set preferences, and browse a feed. Applications happen on the employer site or in an email the user sends. Pro is a one-time 30 day pass. It does not renew automatically.

This repository is the application described in the 2 November 2026 build blueprint. It is not a live business: Supabase, Razorpay, and a legal entity are still owner setup.

## Run it locally

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000. Create an account and confirm you are 18 or older. The first account using `nagarn603@gmail.com` becomes the initial admin. That binding happens once.

Jobs are stored in `.data/store.json`. That file is local development persistence, not production, and it is gitignored. The amber banner stays visible until Supabase Auth is configured.

```bash
npm run worker -- archive
```

The worker moves listings whose visibility window has ended. Feed queries hide those listings even if the worker has not run.

## What is intentionally off

- Payments stay disabled until `PIKAJOBS_PAYMENTS_ENABLED=true` and both Razorpay keys are set. There is no simulated successful charge.
- The homepage samples are labeled fictional listings. They never enter the feed.
- Agent tokens are shown once. Only a hash is stored.
- Publishing from an agent is not a granted scope.

## Production setup

Copy `.env.example` to `.env.local` and fill names from the host's secret store. Apply `supabase/migrations/0001_init.sql` to one Supabase project. Configure Google and email auth, redirect URLs, SMTP, and MFA for the admin account. Do not put the service role key in a browser bundle.

See `docs/implementation-status.md` for what is tested and what still needs the owner's accounts.
