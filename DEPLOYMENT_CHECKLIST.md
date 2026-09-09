# FinPilot AI — Production Deployment Checklist

Check items off in order. Any unchecked "Required" item blocks the release.

## Before deployment

- [ ] Secrets generated and rotated: `JWT_SECRET`, `JWT_REFRESH_SECRET`,
      `AI_SERVICE_KEY`, storage credentials (`openssl rand -hex 64` for JWT).
- [ ] Production environment variables prepared (see README env matrix).
- [ ] MongoDB Atlas cluster created, DB user restricted to `readWrite` on the
      app database, network access configured.
- [ ] Redis configured (`REDIS_URL`) — optional but recommended for
      distributed rate limits.
- [ ] AI service image built and deployed; `GET /api/health` returns 200 and
      reports `llm.configured: true` with the hosted provider.
- [ ] Frontend production build passes: `cd client && npm run build`.
- [ ] Backend tests pass: `cd server && npm test` (81 tests).
- [ ] AI service tests pass:
      `cd ai-service && .venv/Scripts/python -m pytest tests/ -q` (50 tests).
- [ ] AI service runtime deps verified: `python scripts/check_runtime.py`.
- [ ] `npm audit` clean (0 known vulnerabilities).
- [ ] No `localhost`/`127.0.0.1` remains in production config
      (`AI_SERVICE_URL`, `LLM_BASE_URL`, `RECEIPT_STORAGE_*`).
- [ ] `AI_PROVIDER` set to a hosted provider (`openai`) with `LLM_API_KEY` +
      `LLM_MODEL` in the AI service environment; Ollama vars are absent (they
      are LOCAL DEVELOPMENT ONLY).

## Vercel frontend (project #1)

- [ ] Root directory = `client`.
- [ ] Framework preset = Vite.
- [ ] Build command = `npm run build`; output directory = `dist`.
- [ ] Environment variable `VITE_API_URL` set to the backend project URL.
- [ ] SPA routes refresh correctly (`/dashboard`, `/goals`, `/scanner`, ...):
      verify a hard refresh on a route does not 404.
- [ ] No `vercel.json` at repository root (would conflict with SPA/API split).

## Vercel backend (project #2)

- [ ] Root directory = `server`.
- [ ] Entry point `api/index.js`; no `app.listen()` path used on Vercel.
- [ ] Environment variables set: `MONGODB_URI`, `JWT_SECRET`,
      `JWT_REFRESH_SECRET`, `CLIENT_URL` (frontend origin),
      `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, `AI_SERVICE_URL`,
      `AI_SERVICE_KEY`, `RECEIPT_STORAGE_PROVIDER=s3` +
      `RECEIPT_STORAGE_BUCKET/REGION/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY`,
      `REDIS_URL`.
- [ ] `GET /api/health` responds 200 on the deployed backend URL.
- [ ] CORS: only your frontend origin(s) get `access-control-allow-origin`.
- [ ] Cookies: `HttpOnly`, `SameSite=None`, `Secure`, `Path=/api` set on login.
- [ ] CSRF: a POST with cookies but no `X-Requested-With` returns 403
      `CSRF_REQUIRED`.

## Post-deployment smoke test

- [ ] `GET https://<api>.vercel.app/api/health` → 200.
- [ ] Register a new user → 201 + auth cookies set (HttpOnly, Secure).
- [ ] Login → 200 + cookies set.
- [ ] Refresh token flow → new token issued (rotated), old token rejected.
- [ ] Logout → 200 + cookies cleared.
- [ ] Dashboard loads real data (no fake balances; error state if DB empty).
- [ ] Goals: create, list, contribute, delete (204).
- [ ] Transactions: create, list, update, delete.
- [ ] Scanner: upload image/PDF → OCR extraction or honest empty state.
- [ ] Receipts: `GET /api/transactions/:id/receipt` returns a signed URL;
      another user's transaction returns 404.
- [ ] Notifications: list / mark-read; another user's notification → 404.
- [ ] AI/chat: authenticated request through the hosted LLM provider; verify a
      clearly-labelled fallback when the provider is unavailable.
- [ ] AI service `GET /api/health` reports `llm.provider=openai`,
      `llm.configured=true`, and never an expired/missing `LLM_API_KEY`.
- [ ] Authorization: verified cross-user isolation on goals, transactions,
      notifications, receipts.
- [ ] Browser profile (incognito) test of login → refresh → logout on a fresh
      domain.
- [ ] Mobile-width test of dashboard/scanner/chat.