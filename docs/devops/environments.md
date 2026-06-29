# Environments — Quiz Creator v2 (Questify)

## Overview

| Environment | Purpose | Database | Frontend URL | API URL | Deployed by |
|---|---|---|---|---|---|
| **local** | Developer machine | Local D1 (wrangler dev miniflare) | `http://localhost:5173` | `http://localhost:8787` | Developer (manual) |
| **preview** | PR preview + QA | D1 preview (Cloudflare) | Auto-generated Pages URL | Workers preview | CI/CD on PR push |
| **production** | Live app | D1 production | `https://questify.app` | `https://api.questify.app` | CI/CD on merge to `main` |

---

## Environment Variables

### Frontend — `apps/web` (Vite)

> Variables prefixed `VITE_` are embedded in the built bundle. Never put secrets here.

```bash
# ─── API ───────────────────────────────────────────
VITE_API_URL=http://localhost:8787
# preview:    https://quiz-api-preview.workers.dev (or custom domain)
# production: https://api.questify.app

VITE_APP_URL=http://localhost:5173
# preview:    https://<branch>.questify.pages.dev
# production: https://questify.app
```

### Backend — `apps/api` (Cloudflare Workers)

Workers environment variables come from two sources:
1. **`wrangler.toml`** — non-secret config (CORS origins, feature flags)
2. **`wrangler secret put`** — secrets (never committed to repo)

```bash
# ─── Auth (set via: wrangler secret put BETTER_AUTH_SECRET) ────────────
BETTER_AUTH_SECRET=<32+ char random string>
# Generate: openssl rand -base64 32

# ─── CORS (wrangler.toml [vars]) ───────────────────────────────────────
CORS_ORIGIN=http://localhost:5173
# production: https://questify.app

# ─── Cloudflare bindings (wrangler.toml [d1_databases] + [kv_namespaces]) ───
# These are not env vars — they're Wrangler resource bindings
# QUIZ_DB    → D1 database binding
# QUIZ_KV    → KV namespace binding
```

### CI-only (GitHub Actions variables)

```bash
CLOUDFLARE_ACCOUNT_ID=<your account ID>       # GitHub Variable (not secret)
CLOUDFLARE_API_TOKEN=<deploy token>            # GitHub Secret
VITE_API_URL=https://api.questify.app          # GitHub Variable
VITE_APP_URL=https://questify.app              # GitHub Variable
```

---

## Local Setup (First Time)

```bash
# 1. Clone the repository
git clone git@github.com:billcastle_bose/quiz-creatorv2.git
cd quiz-creatorv2

# 2. Install Node.js ≥ 22 (use nvm or fnm)
node --version   # must be ≥ 22

# 3. Install Wrangler CLI globally
npm install -g wrangler
wrangler --version

# 4. Install dependencies
npm install

# 5. Copy env template
cp .env.template .env.local
# Edit .env.local — add any missing values

# 6. Authenticate with Cloudflare (one time)
wrangler login

# 7. Create local D1 database and run migrations
npm run db:migrate:local

# 8. Seed development data
npm run db:seed

# 9. Start both frontend and backend
npm run dev
# → Frontend: http://localhost:5173
# → API:      http://localhost:8787
```

---

## `.env.template` (committed to repo)

```bash
# ─── Frontend (VITE_ prefix = public, bundled into JS) ─────────────────
VITE_API_URL=http://localhost:8787
VITE_APP_URL=http://localhost:5173

# ─── Backend — local dev only (NOT used in Cloudflare Workers prod) ────
# In production, use: wrangler secret put BETTER_AUTH_SECRET
BETTER_AUTH_SECRET=replace-with-32-char-random-string-openssl-rand-base64-32

# ─── Cloudflare (needed for wrangler commands + CI) ────────────────────
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
# Where to find: https://dash.cloudflare.com → right sidebar on any page

CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
# Create at: https://dash.cloudflare.com/profile/api-tokens
# Template: "Edit Cloudflare Workers" includes Workers, Pages, and D1 access

# ─── Optional ──────────────────────────────────────────────────────────
# CORS_ORIGIN=http://localhost:5173   # default, override for staging/prod
```

---

## Cloudflare Resources to Create

Before deploying for the first time, create these Cloudflare resources:

```bash
# 1. D1 Database
wrangler d1 create quiz-db
# Copy the database_id from output → paste into apps/api/wrangler.toml

# 2. KV Namespace (for caching)
wrangler kv namespace create QUIZ_KV
# Copy the id → paste into apps/api/wrangler.toml

# 3. KV Namespace for preview (separate namespace for non-production)
wrangler kv namespace create QUIZ_KV --preview
# Copy the preview_id → paste into apps/api/wrangler.toml

# 4. Set Worker secrets
wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.toml
# (paste secret when prompted)

wrangler secret put CORS_ORIGIN --config apps/api/wrangler.toml
# enter: https://questify.app
```

---

## `wrangler.toml` Structure (`apps/api/wrangler.toml`)

```toml
name = "quiz-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
CORS_ORIGIN = "http://localhost:5173"   # overridden in prod via wrangler secret put

[[d1_databases]]
binding = "QUIZ_DB"
database_name = "quiz-db"
database_id = "REPLACE_WITH_YOUR_D1_ID"   # from: wrangler d1 create quiz-db

[[kv_namespaces]]
binding = "QUIZ_KV"
id = "REPLACE_WITH_YOUR_KV_ID"            # from: wrangler kv namespace create QUIZ_KV
preview_id = "REPLACE_WITH_PREVIEW_KV_ID"

[env.production]
vars = { CORS_ORIGIN = "https://questify.app" }
```

---

## Cloudflare Pages Configuration

In Cloudflare Dashboard → Pages → questify project → Settings → Build:

| Setting | Value |
|---|---|
| Build command | `npm run build -w @quiz/web` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` (monorepo root) |
| Node.js version | `22` |

**Environment variables** (set in Pages dashboard → Settings → Environment variables):

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://api.questify.app` |
| `VITE_APP_URL` | `https://questify.app` |

---

## Working with D1

```bash
# Apply migrations to local D1
npm run db:migrate:local
# (runs: wrangler d1 migrations apply quiz-db --local)

# Apply migrations to production D1 (use db-migrate.yml GitHub Action instead)
wrangler d1 migrations apply quiz-db --config apps/api/wrangler.toml

# Run a SQL query against local D1
wrangler d1 execute quiz-db --local --command "SELECT COUNT(*) FROM questionnaires"

# Run a SQL query against production D1 (read-only — use with caution)
wrangler d1 execute quiz-db --command "SELECT COUNT(*) FROM questionnaires"

# Open Drizzle Studio (local)
npm run db:studio

# Export D1 backup
wrangler d1 export quiz-db --output ./backup-$(date +%Y%m%d).sql
```

---

## Database Backup

Cloudflare D1 runs automated backups. For additional safety:

```bash
# Manual D1 export (run from CI or locally before major migrations)
wrangler d1 export quiz-db \
  --config apps/api/wrangler.toml \
  --output ./backups/quiz-db-$(date +%Y%m%d-%H%M%S).sql

# Schedule via GitHub Actions cron (add to .github/workflows/db-backup.yml):
# on:
#   schedule:
#     - cron: '0 2 * * *'   # 2 AM UTC daily
```

---

## Cloudflare KV — Cache Management

```bash
# List KV namespaces
wrangler kv namespace list

# View keys in a namespace (local)
wrangler kv key list --namespace-id=<id> --local

# Delete a cached key (to force cache refresh)
wrangler kv key delete "feed:all:popular:1" --namespace-id=<id>

# Bulk delete keys matching a prefix (use wrangler CLI carefully in production)
wrangler kv bulk delete --namespace-id=<id> keys.json
```
