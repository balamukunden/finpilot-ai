# FinPilot AI — Verification Report

Date: 2026-09-13 (update)
Repo state: `main` @ `335555f` (pushed to origin/main)

## Summary

| Check | Result |
|---|---|
| Server test suite | **81/81 PASS** |
| Client production build | **PASS** (Vite, 2685 modules) |
| Backend `npm audit` | 0 vulnerabilities |
| Client `npm audit` | 0 vulnerabilities |
| Secret-safety scan (tracked files) | **PASS** — no real secrets tracked |
| Live frontend (`/`, `/login`, `/register`, `/dashboard`, `/expenses`, `/scanner`, `/goals`, `/chat`) | **PASS** — HTTP 200 on all SPA routes |
| Live backend `/api/health` | HTTP 200, but `status: configuration_required` |
| Live DB-backed operation (register) | **BLOCKED** — HTTP 503, `MONGODB_URI` not configured on Vercel |

## Errors fixed in this pass

1. **Stale `server/.env`** — removed obsolete keys (`REDIS_HOST`,
   `REDIS_PORT`, `REDIS_PASSWORD`, `DEFAULT_CURRENCY`, `ADMIN_RESET_PASSWORD`),
   aligned all keys with `server/.env.example`; `REDIS_URL` left empty so local
   tests use the fast in-memory fallback (an unreachable local Redis was
   stalling every request via connect-timeout/retry backoff).
2. **Non-deterministic deployment test** (`server/tests/deployment.test.js`) —
   the child process now runs from an isolated temp cwd (no `.env`) and loads
   `env.js` by absolute path, stripping inherited JWT secrets before applying
   overrides. Production validation logic untouched. **Result: 81/81.**
3. **Stale dependencies** — server `node_modules` was missing `supertest`;
   fixed with `npm ci` (server + client).
4. **Vercel CLI** — installed (`vercel` 59.16.0 via `npm i -g vercel`).
5. **Git** — pushed deploy fix to `origin/main` (`289a218..335555f`).

## Current blockers (require external credentials/access)

1. **`MONGODB_URI` not configured on Vercel** — live DB ops return 503.
   Requires a MongoDB Atlas cluster + a least-privilege `readWrite` user, then
   setting `MONGODB_URI` in the Vercel backend's Production environment.
2. **Vercel CLI not authenticated** — `vercel whoami` reports "Logged out."
   Interactive login (`vercel login`) or an access token is required to inspect
   env vars, force redeploys, and read deployment logs. Until then, deployments
   rely on the existing Git integration (push to `main` triggers rebuilds).

## Pending (feature stages — not deployment blockers)

- `REDIS_URL` — NOT CONFIGURED (in-memory fallback active by design).
- `RECEIPT_STORAGE_*` (S3/R2) — NOT CONFIGURED (local dev provider only).
- AI service (FastAPI container) — NOT DEPLOYED (needs container host).
- Hosted LLM — NOT CONFIGURED.
- OCR live verification — NOT VERIFIED (heavy Python deps not installed locally).

## Local verification commands (reproducible)

```bash
cd server && npm ci && npm test        # 81/81 PASS, 0 vulnerabilities
cd client && npm ci && npm run build   # PASS, 0 vulnerabilities
```

## Not verified / environment notes

- ai-service Python tests: NOT RUN (no local `.venv`; would pull torch/EasyOCR).
- Vercel deployment logs: not inspectable without CLI auth.
- Live CORS/CSRF/IDOR against the backend require a configured DB and are
  covered by the automated suite (auth.test.js, security.test.js,
  transactions.test.js, goals.test.js) which passes 100%.