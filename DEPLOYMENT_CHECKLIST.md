# FinPilot AI — Production Deployment Checklist

Last updated: 2026-09-13 (update 3: live E2E 11/11 PASS — PRODUCTION VERIFIED)

## Live URLs

| Service    | URL                                                    | Status       |
|------------|--------------------------------------------------------|--------------|
| Frontend   | https://balamukunden-finpilot-ai-baymax5.vercel.app    | Live (200, all SPA routes) |
| Backend    | https://finpilot-ai-one.vercel.app                     | **PRODUCTION VERIFIED** — 11/11 E2E PASS, DB connected |
| AI Service | Not deployed (container host needed)                   | Not started |

## Vercel access (2026-09-13)

- [x] `vercel` CLI 59.16.0 installed.
- [x] Authenticated as `balamukunden` (team `baymax5`).
- [x] Both projects verified by CLI; production deployments Ready on `main`.

## Vercel backend (project: `finpilot-ai`)

- [x] Root directory = `server`.
- [x] Entry point `api/index.js`; no `app.listen()` path on Vercel.
- [x] `NODE_ENV=production`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`,
      `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, `AI_SERVICE_KEY` set.
- [x] **`MONGODB_URI`** — set to Production env (Hidden/Secret) via CLI; DB connected.
- [x] **Atlas Network Access** — `0.0.0.0/0` (Allow access from anywhere); Vercel→Atlas connection confirmed.
- [ ] `REDIS_URL` — optional (falls back to per-instance in-memory limiting).
- [ ] `AI_SERVICE_URL` — needed when AI service is deployed.
- [ ] `RECEIPT_STORAGE_*` — needed for receipt upload (S3/R2).

## Live E2E results (2026-09-13)

All run against `https://finpilot-ai-one.vercel.app/api` with cookie-based session:

| # | Check | Result | Code |
|---|---|---|---|
| 1 | `GET /api/health?detail=true` — DB connected | PASS | 200 |
| 2 | `POST /api/auth/register` | PASS | 201 |
| 3 | `POST /api/auth/login` — HttpOnly cookie set | PASS | 200 |
| 4 | `GET /api/users/me` — authenticated, DB-backed | PASS | 200 |
| 5 | `GET /api/dashboard` — DB aggregation | PASS | 200 |
| 6 | `POST /api/transactions` — DB write | PASS | 201 |
| 7 | `GET /api/transactions?page=1&limit=1` — DB read | PASS | 200 |
| 8 | `POST /api/goals` — DB write | PASS | 201 |
| 9 | `POST /api/auth/logout` — session cleared | PASS | 200 |
| 10 | `GET /api/users/me` after logout — session invalidated | PASS | 401 |
| 11 | CORS — foreign origin blocked | PASS | blocked |

## Remaining (non-blocking for core activation)

- [ ] Redis configured or documented as pending — pending (in-memory fallback active).
- [ ] R2 / receipt storage configured or documented as pending — pending.
- [ ] AI service configured or documented as pending — pending (needs container host).
