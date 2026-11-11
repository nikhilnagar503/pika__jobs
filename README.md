# Pikajobs

Curated jobs and internships for adults in India.

## Structure

```text
frontend/     React + Vite + TypeScript   → Vercel
backend/      Express + TypeScript        → Hostinger VPS
docs/         Architecture + user manual
supabase/     Auth/DB migrations
tests/        Domain tests (backend)
workers/      Archive worker
```

## Local development

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill Supabase keys

npm run dev:backend     # http://localhost:4000
npm run dev:frontend    # http://localhost:5173
```

```bash
npm test
npm run worker -- archive
```

## Deploy

| App | Host |
| --- | --- |
| `frontend/` | Vercel (`VITE_API_URL` → your API) |
| `backend/` | Hostinger VPS (Node 20 + Nginx on `api.`) |

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md)
