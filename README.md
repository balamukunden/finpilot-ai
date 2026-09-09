# FinPilot AI

AI-powered personal finance copilot. Scan receipts with OCR (image or PDF),
track expenses and savings goals, get honest financial guidance, and keep your
data isolated per user.

> **Canonical backend: `server/`**
> The legacy `server-new/` backend has been removed from the working tree.
> The frontend and all deployment targets use `server/`.
>
> - Production backend target: **Vercel** (`server/`)
> - Backend entry point: `server/api/index.js` (Vercel serverless handshake)
> - Local backend entry point: `server/src/server.js`

## Architecture

```
              ┌──────────────────────┐
              │   Browser (React)    │
              │       client/        │
              └───────────┬──────────┘
                          │ HTTPS + httpOnly cookies
                          ▼
              ┌─────────────────────────┐
              │    FinPilot API (Node)   │   MongoDB Atlas (data)
              │    server/  (Vercel)     │   Redis (distributed limits)
              │  Auth · Transactions ·   │   Object storage (receipts)
              │  Goals · Dashboard ·     │
              │  Scanner (receipt ingest)│
              └───────────┬─────────────┘
                          │ X-Ai-Service-Key (shared secret)
                          ▼
              ┌─────────────────────────┐
              │  AI Service (FastAPI)   │  ai-service/ (Docker)
              │  OCR + PDF + chat       │
              └───────────┬─────────────┘
                          │ LLM_API_KEY (AI service only)
                          ▼
              ┌─────────────────────────┐
              │   Hosted LLM Provider   │  external model API
              │   (OpenAI-compatible)   │
              └─────────────────────────┘

The FinPilot backend does not package or run an LLM model. Model inference is
delegated to the AI service, which can use a hosted LLM provider. Ollama is
optional for local development and is not required for Vercel backend deployment.
```

## Repository layout

```
finpilot-ai
├── client/             # React + Vite SPA (Vercel project #1)
├── server/             # Node/Express API (Vercel project #2) — CANONICAL
├── ai-service/         # FastAPI — OCR, PDF rendering, hosted-LLM chat (Docker)
│   └── app/services/   #   LLM provider abstraction (openai / ollama-dev)
├── docker-compose.yml  # Local MongoDB + Redis (development only)
└── DEPLOYMENT_CHECKLIST.md
```

## Local development

Prerequisites: Node 20+, Docker (for Mongo/Redis), Python 3.11+.

```bash
# 1. Local infrastructure
docker compose up -d

# 2. Backend API  (http://localhost:5000)
cd server
cp .env.example .env
npm install
npm start

# 3. Frontend  (http://localhost:5173, proxies /api + /uploads to :5000)
cd client
cp .env.example .env.local
npm install
npm run dev

# 4. AI service (http://localhost:8000)
cd ai-service
py -m venv .venv
.venv\Scripts\activate           # Windows — Linux/macOS: source .venv/bin/activate
pip install -r requirements-test.txt   # light set (fast tests, no torch)
# for full OCR capability:  pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The AI service boots with no LLM configured (chat falls back to honest
deterministic replies). To enable real chat locally you can either:

- Set `AI_PROVIDER=openai`, `LLM_API_KEY=...`, `LLM_MODEL=...` (hosted), or
- Set `AI_PROVIDER=ollama` and run a local Ollama server (**optional,
  LOCAL DEVELOPMENT ONLY**).

Health checks: `http://localhost:5000/api/health`, `http://localhost:8000/api/health`.

## Environment variables

| Variable | Service | Required (prod) | Purpose | Secret |
|---|---|---|---|---|
| `NODE_ENV` | server | yes (`production`) | app mode | no |
| `PORT` | server | no | listen port (5000) | no |
| `MONGODB_URI` | server | yes | MongoDB Atlas connection string | yes |
| `JWT_SECRET` | server | yes | access-token signing (rejects weak values in prod) | yes |
| `JWT_EXPIRES_IN` | server | no | access token TTL (`15m`) | no |
| `JWT_REFRESH_SECRET` | server | yes | refresh-token signing (rejects weak values in prod) | yes |
| `JWT_REFRESH_EXPIRES_IN` | server | no | refresh token TTL (`7d`) | no |
| `CLIENT_URL` | server | yes | comma-separated CORS allowlist = your frontend origins | no |
| `COOKIE_SAME_SITE` | server | yes* | `none` for cross-site frontend/API | no |
| `COOKIE_SECURE` | server | yes* | `true` under HTTPS (auto in prod) | no |
| `REDIS_URL` | server | rec. | shared rate limits / login cooldown (Upstash/Redis Cloud) | yes |
| `MAX_FILE_SIZE` | server | no | upload size cap (bytes) | no |
| `UPLOAD_DIR` | server | no | local dev upload dir (`uploads`) | no |
| `AI_SERVICE_URL` | server | yes | e.g. `https://ai.yourapp.com` (never localhost in prod) | no |
| `AI_SERVICE_KEY` | server | yes | shared secret sent as `X-Ai-Service-Key` | yes |
| `RECEIPT_STORAGE_PROVIDER` | server | yes | must be `s3` in production (local is refused) | no |
| `RECEIPT_STORAGE_BUCKET` | server | yes | object-storage bucket | no |
| `RECEIPT_STORAGE_REGION` | server | no | region / `auto` for R2 | no |
| `RECEIPT_STORAGE_ENDPOINT` | server | no | custom endpoint (R2/MinIO) | no |
| `RECEIPT_STORAGE_ACCESS_KEY_ID` | server | yes | storage access key | yes |
| `RECEIPT_STORAGE_SECRET_ACCESS_KEY` | server | yes | storage secret | yes |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | server | no | general limiter | no |
| `AUTH_RATE_LIMIT_*`, `CHAT_RATE_LIMIT_*` | server | no | auth/chat limiters | no |
| `AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_INITIAL/MAX_LOCKOUT_SECONDS` | server | no | login cooldown | no |
| `LOG_LEVEL` | server | no | pino verbosity (`info` prod, `debug` dev) | no |
| `TEST_MONGODB_URI` | server | no | isolated test DB | no |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | server | no | `npm run seed:admin` only | yes |
| `VITE_API_URL` | client | yes | backend URL, e.g. `https://api-finpilot.vercel.app` | no |
| `APP_ENV` | ai-service | yes | `production` | no |
| `AI_SERVICE_KEY` | ai-service | yes | must match server `AI_SERVICE_KEY` | yes |
| `AI_PROVIDER` | ai-service | yes | `openai` (hosted, default) or `ollama` (**LOCAL DEV ONLY**) | no |
| `LLM_API_KEY` | ai-service | yes* | hosted LLM provider secret — exists ONLY in the AI service env | **yes** |
| `LLM_MODEL` | ai-service | yes* | model name supplied by deployment config (never hard-coded) | no |
| `LLM_BASE_URL` | ai-service | no | OpenAI-compatible base URL (default `https://api.openai.com/v1`) | no |
| `LLM_TIMEOUT` / `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` | ai-service | no | hosted LLM tuning | no |
| `OLLAMA_URL` / `OLLAMA_BASE_URL` | ai-service | no | *LOCAL DEVELOPMENT ONLY* (`AI_PROVIDER=ollama`), never in prod | no |
| `OLLAMA_MODEL` | ai-service | no | *LOCAL DEV ONLY* dev model id | no |
| `OLLAMA_TIMEOUT` / `OLLAMA_TEMPERATURE` / `OLLAMA_MAX_TOKENS` | ai-service | no | *LOCAL DEV ONLY* tuning | no |
| `OCR_LANG` / `OCR_GPU` | ai-service | no | OCR tuning | no |
| `CORS_ORIGINS` | ai-service | no | AI service CORS allowlist | no |
| `MAX_UPLOAD_SIZE` | ai-service | no | upload cap (bytes) | no |

\* `LLM_API_KEY`/`LLM_MODEL` are required in production when `AI_PROVIDER` is
hosted (the default). The AI service refuses to start in production without
them. `COOKIE_SAME_SITE`/`COOKIE_SECURE` are auto-set for production defaults;
only override if you run a non-standard topology. **Never** allow `*` for CORS
or `localhost` for `AI_SERVICE_URL`/`LLM_BASE_URL` in production.

## Authentication & security model

- **Access + refresh tokens are httpOnly cookies** scoped to `Path=/api`. They
  are never stored in `localStorage`/`sessionStorage`. The frontend writes
  nothing secret to the browser store.
- **Refresh rotation with reuse detection** — every refresh mints a new token
  (`jti`); presenting an already-rotated token revokes **all** sessions.
- **`POST /api/auth/change-password`** clears every active refresh session.
- **CSRF** — all cookie-authenticated mutating requests must send
  `X-Requested-With: XMLHttpRequest` (or `X-CSRF-Token`). The frontend axios
  instance sends it globally. Combined with the CORS allowlist this defeats
  cross-site forgery. Bearer-token requests are exempt.
- **CORS** — allowlist only (`CLIENT_URL`, comma-separated). No wildcard.
- **Helmet** enabled; CSP is on in production, off in dev (Vite HMR).

### Cross-domain cookie alignment (frontend ≠ backend domain)

For `https://finpilot.yourapp.com` → `https://api-finpilot.yourapp.com`:

- `CLIENT_URL=https://finpilot.yourapp.com`
- `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true` (SameSite=None requires Secure)
- Do **not** set a `Domain` cookie attribute (leave it host-only).
- `VITE_API_URL=https://api-finpilot.yourapp.com`
- If both sides live under the **same** domain (`finpilot.yourapp.com` frontend,
  `api.finpilot.yourapp.com` API), `COOKIE_SAME_SITE=lax` works.

## Production deployment

### Frontend → Vercel (project #1)

| Setting | Value |
|---|---|
| Root directory | `client` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Env vars | `VITE_API_URL=https://<backend-project>.vercel.app` |

`client/vercel.json` rewrites all non-API routes to `index.html` (SPA). API
paths are never hit by the rewrite because the API lives on the separate
backend project. There is no root `vercel.json` — do not add one.

### Backend API → Vercel (project #2)

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build / Install | `npm ci` (Vercel default) |
| Entry point | `api/index.js` (serverless). **No `app.listen()` in this path** |
| Env vars | `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `RECEIPT_STORAGE_*`, `REDIS_URL` |

`server/vercel.json` rewrites `/(.*)` → `/api/index.js`. The entry initializes a
cached Mongo connection once per warm instance and delegates to Express. If
required variables are missing or weak, the lambda refuses to start (fails on
first request with a controlled 503/401 — misconfiguration is loud, not silent).

### MongoDB Atlas

1. Create an Atlas M0+ cluster (choose a region close to your Vercel region).
2. **Database access**: create a user with a strong password, role
   `readWrite` on the `finpilot` database only (not cluster-wide admin).
3. **Network access**: add the Vercel/SaaS egress IP(s), or if you must open
   broadly use `0.0.0.0/0` (accepts all IPs — for testing only) **and** rely on
   the strong URI credentials; prefer restricting to known IPs.
4. Copy the SRV URI, set your db name, and set `MONGODB_URI` in Vercel.
5. Indexes are created automatically from Mongoose schema definitions
   (unique email, user-scoped index pairs).

### Redis (production)

Optional but **recommended**. Without it, rate limits and the login cooldown
are per-instance (each Vercel lambda has its own counter). With `REDIS_URL`
they become distributed.

- Provision Upstash Redis (or Redis Cloud) and set
  `REDIS_URL=rediss://...` (TLS is supported automatically by `ioredis`).
- If Redis is unreachable, requests **pass through** (limits degrade, the API
  does not 500) and a startup warning is logged.
- `express-rate-limit` + the login cooldown backend to Redis when configured.

### AI service → Docker/container

The AI service is a FastAPI app that is **not** serverless-friendly (PyMuPDF +
EasyOCR/torch weights). Deploy it on a small VM/container host (Fly.io,
Render, Cloud Run, EC2, or a VPS). It does **not** run or bundle an LLM model —
it calls a **hosted LLM provider** outbound:

```bash
cd ai-service
docker build -t finpilot-ai-service .
docker run -d -p 8000:8000 \
  -e APP_ENV=production \
  -e AI_SERVICE_KEY=<same value as server AI_SERVICE_KEY> \
  -e AI_PROVIDER=openai \
  -e LLM_API_KEY=<hosted-provider-secret> \
  -e LLM_MODEL=<chosen-production-model> \
  -e CORS_ORIGINS=https://api-finpilot.vercel.app \
  --restart unless-stopped \
  finpilot-ai-service
```

`LLM_BASE_URL` is optional (defaults to OpenAI's API) and can point at any
OpenAI-compatible host. The **Node backend never holds `LLM_API_KEY`** — it
only needs `AI_SERVICE_URL` + `AI_SERVICE_KEY`. The key is never in a
`VITE_*` variable and never in the frontend.

- Health: `GET /api/health`. Docker `HEALTHCHECK` is baked in. Health reports
  application health and provider **config state** without ever invoking the
  provider, so it cannot fail just because the model is busy.
- The container refuses to start in production with a missing `AI_SERVICE_KEY`,
  a missing `LLM_API_KEY`/`LLM_MODEL` for a hosted provider, or an
  `AI_PROVIDER=ollama`/localhost configuration.
- The container runs as a **non-root user** and packages **no model weights**
  (no `.gguf`/`.safetensors`/`.bin` — nothing is downloaded at build or boot).
- Runtime deps and provider config are verified inside the image with
  `python scripts/check_runtime.py` (included in the image).
- The AI service is **not** exposed to the browser; only the backend holds the
  shared key.

### Hosted LLM provider

Production uses a hosted, OpenAI-compatible LLM API (OpenAI, OpenRouter,
Together, Groq, or any provider exposing `/chat/completions`):

- `AI_PROVIDER=openai` (default) — the AI service calls `{LLM_BASE_URL}/chat/completions`.
- `LLM_MODEL` is deployment configuration — no model is committed, downloaded,
  or bundled. The repo and the Vercel backend contain **no model files**.
- The browser → Node API → FastAPI → hosted LLM API chain means the browser
  never calls the model provider directly and never sees `LLM_API_KEY`.

#### Ollama — optional local development provider

`AI_PROVIDER=ollama` (+ `OLLAMA_URL`/`OLLAMA_MODEL`) is supported **only** for
local development. It is never required and never allowed in production with a
localhost/plain-HTTP endpoint — the container refuses to start in that state.
Ollama stays private on your machine; it is not part of the deployed stack.

### Cost / scalability note

- The **Vercel backend stays lightweight** — no Python, no model runtime, no
  large weights are installed or deployed to it.
- LLM **inference costs are controlled by the external provider** (usage-based);
  the project does not run inference on your infrastructure.
- The **AI service can scale independently** of the API, and its image is sized
  by OCR/PDF dependencies, not by model weights.
- Large model weights are **not included** in this repository or in any
  deployment defined here.

## Receipt / file storage (honest classification)

| Provider | Where | Status |
|---|---|---|
| `s3` (`RECEIPT_STORAGE_PROVIDER=s3`) | S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) | **Production path.** Receipts stored under generated keys using the caller's credentials |
| `local` | server filesystem via `server/uploads` | **Development only.** In production, requests that would write receipts fail with a controlled 503 — the ephemeral Vercel filesystem is never used for durable storage |

Receipt URLs are never public: `GET /api/transactions/:id/receipt` verifies
ownership then returns a short-lived signed URL. The dev-only static mount
`/uploads` is disabled in production.

## AI behavior (honest)

- **OCR**: EasyOCR on rasterized pages. PDFs are rendered to images with
  PyMuPDF, then OCR'd. If OCR returns no text, the app returns an **empty
  extraction with `confidence: 0`** and asks the user to enter the data —
  values are never fabricated. OCR never requires an LLM.
- **Chat**: `/api/chat` → FastAPI → configured LLM provider (hosted API by
  default; a local Ollama instance is optional in development only). If the
  provider is unavailable, the service returns a **local, deterministic,
  clearly-labelled illustrative** reply (never a fake AI response). Projections
  are labeled "illustration, not a guarantee".
- **Provider decoupling**: provider-specific code lives only in
  `ai-service/app/services/llm_service.py`. Outbound calls time out, retry only
  transient failures (429/502/503/504/network), and never leak provider secrets
  or internals to the frontend.
- **Auth between services**: backend → AI service via `X-Ai-Service-Key`
  (constant-time compare). The LLM provider key exists **only** in the AI
  service environment. There is no browser → AI service path.

## Testing

```bash
cd server && npm test              # backend suite (81 tests)
cd server && npm run test:smoke    # boots the real server against in-memory Mongo
cd ai-service && .venv\Scripts\python -m pytest tests/ -q   # AI suite (50 tests)
cd client && npm run build         # frontend production build
ai-service: python scripts/check_runtime.py   # runtime deps self-check (in image)
```

## Known limitations

- **Process-local fallbacks**: without `REDIS_URL`, rate limits and login
  cooldown are per-instance on serverless. Set `REDIS_URL` for distributed
  behavior. With Redis down, limits degrade (pass-through, logged).
- **OCR accuracy** is untested here against real paper receipts (the local
  test env omits torch/easyocr). The Docker image performs honest runtime
  checks and reports `ocr: unavailable` if deps are missing.
- **Hosted LLM calls are mocked in tests** — no paid provider API was invoked
  during CI. Outbound timeouts, retries, status handling, and error mapping are
  exercised against fake responses only; real provider behavior must be
  validated with a live key during deployment.
- **In-memory rate limiting stores** reset across instances — see Redis above.
- **Live Vercel/Atlas/Redis deploys** were not executed during development
  (no credentials/Docker in the dev environment); configuration is
  documented and validated by tests, not by a live deployment.
- Helmet CSP is enabled in production; images fetched cross-origin (signed
  receipt URLs) are permitted via `crossOriginResourcePolicy: cross-origin`.
- Investment guidance is educational and clearly labeled, never certification.