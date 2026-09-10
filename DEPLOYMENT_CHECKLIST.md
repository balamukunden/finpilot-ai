# FinPilot AI — Production Deployment Checklist

Last verified: 2026-09-10

## Live URLs

| Service    | URL                                                    | Status       |
|------------|--------------------------------------------------------|--------------|
| Frontend   | https://balamukunden-finpilot-ai-baymax5.vercel.app    | ✅ Deployed  |
| Backend    | https://finpilot-ai-one.vercel.app                     | ⚠️ Partial   |
| AI Service | Not deployed (container host needed)                   | ❌ Not started|

Backend status: health endpoint returns `200 { configuration_required }`.
All other endpoints return `503 SERVICE_UNAVAILABLE` until MongoDB is configured.

---

## Vercel frontend (project: `balamukunden-finpilot-ai`)

- [x] Root directory = `client`.
- [x] Framework preset = Vite.
- [x] Build command = `npm run build`; output directory = `dist`.
- [x] Environment variable `VITE_API_URL=https://finpilot-ai-one.vercel.app`.
- [x] SPA routes refresh correctly (tested `/`, SPA rewrite to `/index.html`).
- [x] No `vercel.json` at repository root.
- [x] SSO deployment protection disabled.

## Vercel backend (project: `finpilot-ai`)

- [x] Root directory = `server`.
- [x] Entry point `api/index.js`; no `app.listen()` path on Vercel.
- [x] `NODE_ENV=production` set.
- [x] `JWT_SECRET` set.
- [x] `JWT_REFRESH_SECRET` set.
- [x] `AI_SERVICE_KEY` set.
- [x] `CLIENT_URL=https://balamukunden-finpilot-ai-baymax5.vercel.app`.
- [x] `COOKIE_SAME_SITE=none` set.
- [x] `COOKIE_SECURE=true` set.
- [x] `GET /api/health` responds 200 with `configuration_required`.
- [ ] `MONGODB_URI` — **BLOCKER**: not set, needed for all non-health endpoints.
- [ ] `REDIS_URL` — optional (falls back to in-memory rate limiting).
- [ ] `AI_SERVICE_URL` — needed when AI service is deployed.
- [ ] `RECEIPT_STORAGE_*` — needed for receipt upload (S3/R2).
- [x] SSO deployment protection disabled.

## Before next deploy (cloud credentials)

- [ ] MongoDB Atlas: create cluster, DB user, network whitelist → set `MONGODB_URI`.
- [ ] Redis (Upstash recommended): create instance → set `REDIS_URL`.
- [ ] S3/R2 bucket: create for receipt storage → set `RECEIPT_STORAGE_*` vars.
- [ ] Hosted LLM: get API key from OpenAI/Anthropic → set `LLM_API_KEY` in AI service.
- [ ] AI service: deploy container → set `AI_SERVICE_URL` in backend.
- [ ] Secrets generated with `openssl rand -hex 64` for JWT (already done in Vercel).

## Local test results (verified 2026-09-10)

- [x] Backend tests: 81/81 pass (`cd server && npm test`).
- [x] AI service tests: 50/50 pass (`cd ai-service && .venv/Scripts/python -m pytest tests/ -q`).
- [x] Frontend build: PASS (`cd client && npm run build`).
- [x] `npm audit`: 0 vulnerabilities (server), 0 vulnerabilities (client).
- [x] No secrets in frontend source code.
- [x] No `localhost`/`127.0.0.1` in production config files.
- [x] `server-new/` directory deleted (was a stale duplicate).
- [x] Root `vercel.json` deleted (Vercel auto-discovers sub-projects).

## Post-deployment smoke test (after MongoDB configured)

- [ ] `GET /api/health` → 200 with `environment: "production"`.
- [ ] Register a new user → 201 + auth cookies set (HttpOnly, Secure).
- [ ] Login → 200 + cookies set.
- [ ] Refresh token flow → new token issued (rotated), old token rejected.
- [ ] Logout → 200 + cookies cleared.
- [ ] Dashboard loads real data.
- [ ] Goals: create, list, contribute, delete.
- [ ] Transactions: create, list, update, delete.
- [ ] Scanner: upload image/PDF → OCR extraction or honest empty state.
- [ ] Receipts: signed URL returned; cross-user returns 404.
- [ ] Notifications: list / mark-read; cross-user → 404.
- [ ] AI/chat: request through hosted LLM; fallback when unavailable.
- [ ] Authorization: cross-user isolation verified.
- [ ] Browser incognito test: login → refresh → logout.
- [ ] Mobile-width test of dashboard/scanner/chat.