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

## Where data lives

```text
Browser
  → Express API on Hostinger VPS   (hosting + business logic)
  → Supabase Postgres              (product database)
  → Supabase Auth                  (login)
```

| Store | What it holds |
|---|---|
| **Supabase Auth** | Login (`auth.users`) + `profiles`, `user_roles` |
| **Supabase Postgres** | Jobs, members, saves, sources (`jobs`, `members`, `saved_jobs`, …) |
| **VPS** | Node process only. `store.json` is a one-time import leftover, not the live DB |

Set `PIKAJOBS_DATA_MODE=supabase` and `SUPABASE_SERVICE_ROLE_KEY` on the VPS. On first boot, if Postgres is empty, the API copies `store.json` into Postgres once.

## Local

- Frontend proxies `/api` → `http://localhost:4000` when `VITE_API_URL` is empty  
- Backend CORS allows `FRONTEND_ORIGINS`  

## Production

- `www` / apex → Vercel  
- `api.domain` → VPS :4000 via Nginx  
- Persist backend data with `PIKAJOBS_DATA_DIR` on the VPS disk  
