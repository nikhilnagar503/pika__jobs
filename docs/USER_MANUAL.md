# Pikajobs user manual

## What it is

Pikajobs is a curated job/internship feed for adults in India (18+). Members browse alert-style listings and apply on the employer site or by email. Pikajobs does not submit applications for users.

## Stack

| Layer | Location | Host |
| --- | --- | --- |
| Frontend SPA | `frontend/` | Vercel |
| Express API | `backend/` | Hostinger VPS |
| Auth | Supabase | Supabase cloud |

## Who can access admin

Only **`nagarn603@gmail.com`** with an admin role. Defined in product config / `PIKAJOBS_ADMIN_EMAIL`.

## How jobs get in

1. **Manual:** Admin UI `/admin/jobs/new` → `POST /api/v1/admin/jobs`  
2. **Agent batch:** `POST /api/v1/ingestion/jobs` with bearer agent token  
3. **Member feed:** `GET /api/v1/jobs` (requires sign-in JWT)

## Local run

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev:backend
npm run dev:frontend
```

## Scope note

Payments, Pro paywall, referrals, payouts, and ads are **not in the live product** right now. The app is free member feed + admin job management. Those features can be added back later.
