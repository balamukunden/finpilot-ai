# FinPilot AI — Production Deployment Checklist

Last updated: 2026-09-13 (update 2: Vercel CLI authenticated, deployments verified Ready)

## Live URLs

| Service    | URL                                                    | Status       |
|------------|--------------------------------------------------------|--------------|
| Frontend   | https://balamukunden-finpilot-ai-baymax5.vercel.app    | ✅ Live (200, all SPA routes) |
| Backend    | https://finpilot-ai-one.vercel.app                     | ✅ Deployed / health 200 |
| AI Service | Not deployed (container host needed)                   | ❌ Not started |

Backend health returns `200 { configuration_required }`. All other endpoints
return `503 SERVICE_UNAVAILABLE` until MongoDB is configured on Vercel.

## Vercel access (2026-09-13)

- [x] `vercel` CLI 59.16.0 installed.
- [x] Authenticated as `balamukunden` (team `baymax5`).
- [x] Both projects verified by CLI; production deployments **Ready** on main
      `5794dbb`:
      - Backend `finpilot-ai` → `dpl_5PqN3BrnxsquwPP85fr9CeRfrG4q` → aliased
        `https://finpilot-ai-one.vercel.app`
      - Frontend `balamukunden-finpilot-ai` → `dpl_FLTfEmX4UCE9cBmkhUFDoH9ytw96`
        → aliased `https://balamukunden-finpilot-ai-baymax5.vercel.app`

## Vercel frontend (project: `balamukunden-finpilot-ai`)

- [x] Root directory = `client`.
- [x] Framework preset = Vite.
- [x] Build command = `npm run build`; output directory = `dist`.
- [x] `client/vercel.json` SPA rewrite present (no root `vercel.json`).
- [x] Environment variable `VITE_API_URL=https://finpilot-ai-one.vercel.app` (set in Vercel).
- [x] SPA routes return 200: `/`, `/login`, `/register`, `/dashboard`,
      `/expenses`, `/scanner`, `/goals`, `/chat`.

## Vercel backend (project: `finpilot-ai`)

- [x] Root directory = `server`.
- [x] Entry point `api/index.js`; no `app.listen()` path on Vercel.
- [x] `NODE_ENV=production`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`,
      `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, `AI_SERVICE_KEY` set.
- [x] `GET /api/health` responds 200 (degraded `configuration_required` when
      env is incomplete).
- [ ] `MONGODB_URI` — **BLOCKER**: not set. Required for all live DB operations.
- [ ] `REDIS_URL` — optional (falls back to per-instance in-memory limiting).
- [ ] `AI_SERVICE_URL` — needed when AI service is deployed.
- [ ] `RECEIPT_STORAGE_*` — needed for receipt upload (S3/R2).

## Live verification status (actual, 2026-09-13)

- [x] Frontend build: PASS.
- [x] Server test suite: 81/81 PASS.
- [x] npm audit: 0 vulnerabilities (server + client).
- [x] SPA routes: PASS (all 8 routes → 200).
- [x] Backend health: 200 (configuration_required).
- [ ] DB-backed request succeeds — **BLOCKED** (no MONGODB_URI).
- [ ] Registration works live — **BLOCKED** (503).
- [ ] Login / cookies / refresh / logout live — **BLOCKED** (DB required).
- [ ] Dashboard / transactions / goals live — **BLOCKED** (DB required).
- [ ] CORS / CSRF / IDOR live on backend — **BLOCKED** (DB required; covered
      by automated suite, which passes).
- [ ] Redis configured or documented as pending — pending.
- [ ] R2 configured or documented as pending — pending.
- [ ] AI configured or documented as pending — pending.

## Remaining steps to reach PRODUCTION VERIFIED — CORE APP

1. Create MongoDB Atlas M0+ cluster; create least-privilege `readWrite`
   (database-only) user; configure Network Access for Vercel serverless.
   (See `CLOUD_DEPLOYMENT.md`.)
2. Set `MONGODB_URI` in the Vercel backend project Production env.
3. Redeploy backend (dashboard Deploy button, or CLI after `vercel login`).
4. Run the post-deployment smoke test (below).

## Post-deployment smoke test (after MongoDB configured)

- [ ] `GET /api/health` → 200 with no `configuration_required`.
- [ ] Register a new user → 201 + auth cookies (HttpOnly, Secure).
- [ ] Login → 200 + cookies.
- [ ] Refresh token flow → rotated token; old token rejected.
- [ ] Logout → cookies cleared; protected request rejected.
- [ ] Dashboard loads real data.
- [ ] Transactions: create / update / delete / cross-user 404.
- [ ] Goals: create / contribute / delete / cross-user 404.
- [ ] Notifications: list / mark-read / cross-user 404.
- [ ] CORS: allowed origin works, disallowed origin blocked, no wildcard.
- [ ] CSRF: valid header passes; missing/invalid rejected.
- [ ] IDOR: User B cannot touch User A's resources.
- [ ] Browser incognito: login → refresh → logout.