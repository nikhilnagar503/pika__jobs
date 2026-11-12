# Pikajobs architecture

## Folders

```text
Pika_Jobs/
  frontend/          Vite + React SPA (Vercel)
  backend/           Express API (Hostinger VPS)
    src/auth/        Supabase JWT → actor
    src/domain/      Business rules
    src/repositories/  Job store + demo seed
    src/routes/      /api/v1/*
  docs/
  supabase/migrations/
  tests/             Vitest against backend domain
  workers/           archive-due task
```

## Request flow

1. Browser loads SPA from Vercel  
2. User signs in with Supabase Auth (frontend)  
3. SPA calls `API_URL/api/v1/...` with `Authorization: Bearer <access_token>`  
4. Express verifies JWT, loads actor, serves feed/admin/save  

## Live domain data

Product data (jobs, users, saves) lives in the file/memory store (`repositories/store`, `db.ts`).  
Not included for now: payments, referrals, payouts, ads.

## Local

- Frontend proxies `/api` → `http://localhost:4000` when `VITE_API_URL` is empty  
- Backend CORS allows `FRONTEND_ORIGINS`  

## Production

- `www` / apex → Vercel  
- `api.domain` → VPS :4000 via Nginx  
- Persist backend data with `PIKAJOBS_DATA_DIR` on the VPS disk  
