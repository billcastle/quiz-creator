---
phase: 16
title: "Cloudflare Deployment"
status: pending
depends_on: ["PHASE-01", "PHASE-02", "PHASE-03", "PHASE-04"]
estimated_tickets: 6
---

# PHASE-16 — Cloudflare Deployment

## Overview

This phase establishes the full production deployment pipeline on Cloudflare infrastructure. The frontend deploys to Cloudflare Pages (CDN-backed static hosting with edge-rendered preview deploys), the backend deploys to Cloudflare Workers (serverless edge compute), and the database runs on Cloudflare D1 (SQLite-compatible globally distributed database). CI/CD is handled by GitHub Actions with separate workflows for checking, building, deploying frontend, deploying backend, and running database migrations.

This phase is intentionally positioned early in the phase sequence (before feature phases complete) because the deployment pipeline must exist for every subsequent phase to deliver working software to staging. Each feature phase should be deployable incrementally. The goal is "deploy early, deploy often" — having a production deployment from the start forces the team to discover configuration issues before they accumulate.

The phase covers all infrastructure setup, environment variable management, secrets handling, and the GitHub Actions workflows. It does not cover custom domain DNS configuration (too environment-specific), but documents what must be configured. It also establishes the `preview` environment (Cloudflare Pages preview deploys for PRs) separate from the `production` environment.

## Goals

- [ ] Configure `wrangler.toml` for the API Worker with D1 and KV bindings
- [ ] Configure Cloudflare Pages project for the frontend (linked to repository)
- [ ] Create D1 database instance and apply initial migrations via wrangler CLI
- [ ] Create KV namespace for caching and rate limiting
- [ ] Create GitHub Actions `ci.yml`: biome lint, TypeScript typecheck, build on every PR
- [ ] Create GitHub Actions `deploy-web.yml`: deploy frontend to Cloudflare Pages on push to main
- [ ] Create GitHub Actions `deploy-api.yml`: deploy backend to Cloudflare Workers on push to main
- [ ] Create GitHub Actions `db-migrate.yml`: run D1 migrations on push to main (manual trigger option)
- [ ] Document all environment variables in `.env.template`
- [ ] Verify preview deploy environment (PR → Pages preview URL + Workers staging)

## Architecture Decisions Required

**ADR-021: Environment strategy (preview vs. production)** — Define the two environments, how they differ (separate D1 databases, separate KV namespaces, separate Worker names), how preview DBs are seeded, and what data isolation is expected.

**ADR-022: Secrets management strategy** — Define how secrets are stored (wrangler secret, GitHub Actions secrets), the distinction between build-time variables (VITE_ prefix, Pages dashboard) and runtime secrets (Worker secrets), and how local development uses `.env` files safely.

**STANDARD-wrangler-config:** Define the canonical `wrangler.toml` structure for this project: required bindings, environment-specific overrides, and compatibility date requirements.

## Technical Architecture

### Wrangler Configuration

`apps/api/wrangler.toml`:

```toml
name = "quiz-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "QUIZ_DB"
database_name = "quiz-db"
database_id = "<production-d1-id>"  # filled after `wrangler d1 create quiz-db`

[[kv_namespaces]]
binding = "QUIZ_KV"
id = "<production-kv-id>"           # filled after `wrangler kv namespace create QUIZ_KV`

[vars]
ENVIRONMENT = "production"

[env.preview]
name = "quiz-api-preview"

[[env.preview.d1_databases]]
binding = "QUIZ_DB"
database_name = "quiz-db-preview"
database_id = "<preview-d1-id>"

[[env.preview.kv_namespaces]]
binding = "QUIZ_KV"
id = "<preview-kv-id>"

[env.preview.vars]
ENVIRONMENT = "preview"
```

**Secrets (never in wrangler.toml, set via `wrangler secret put`):**
- `BETTER_AUTH_SECRET` — random 32+ char string
- `CORS_ORIGIN` — `https://questify.app` (production), `https://preview.questify.pages.dev` (preview)

### Cloudflare Pages Configuration

Cloudflare Pages project settings (configured in dashboard or via Wrangler Pages CLI):

- **Project name:** `quiz-web`
- **Build command:** `npm run build -w @quiz/web`
- **Build output directory:** `apps/web/dist`
- **Root directory:** `/` (monorepo root — Cloudflare Pages handles npm workspaces)
- **Node.js version:** `20.x` (set in Pages dashboard or `.node-version` file)

Environment variables (set in Pages dashboard, not in code):

Production:
- `VITE_API_URL` = `https://quiz-api.{account}.workers.dev` (or custom domain)
- `VITE_APP_URL` = `https://questify.app`

Preview (automatic for each PR):
- `VITE_API_URL` = `https://quiz-api-preview.{account}.workers.dev`
- `VITE_APP_URL` = (Pages auto-generates preview URL)

### D1 Database Setup

Commands to run once (by DevOps/Axel):

```bash
# Create production database
wrangler d1 create quiz-db

# Create preview database
wrangler d1 create quiz-db-preview

# Apply migrations to production
wrangler d1 migrations apply quiz-db

# Apply migrations to preview
wrangler d1 migrations apply quiz-db-preview --env preview
```

Migration files live in `packages/db/migrations/` (established in PHASE-02). Wrangler reads the `migrations_dir` from `wrangler.toml`.

Add to `apps/api/wrangler.toml`:
```toml
[migrations]
migrations_dir = "../../packages/db/migrations"
```

### KV Namespace Setup

```bash
# Create production KV namespace
wrangler kv namespace create QUIZ_KV

# Create preview KV namespace
wrangler kv namespace create QUIZ_KV --env preview
```

### GitHub Actions Workflows

#### `ci.yml` — Runs on every PR

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Biome lint and format check
        run: npx biome ci .
      - name: TypeScript typecheck
        run: npm run typecheck --workspaces
      - name: Build all packages
        run: npm run build --workspaces --if-present
```

#### `deploy-web.yml` — Deploys frontend on push to main

```yaml
name: Deploy Web
on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/ui/**'
      - 'packages/shared/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Build web
        run: npm run build -w @quiz/web
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_APP_URL: ${{ secrets.VITE_APP_URL }}
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: quiz-web
          directory: apps/web/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

#### `deploy-api.yml` — Deploys backend on push to main

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/db/**'
      - 'packages/shared/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy --config apps/api/wrangler.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

#### `db-migrate.yml` — Runs D1 migrations

```yaml
name: DB Migrate
on:
  push:
    branches: [main]
    paths:
      - 'packages/db/migrations/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to migrate (production or preview)'
        required: true
        default: 'production'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run D1 migrations
        run: |
          ENV="${{ github.event.inputs.environment || 'production' }}"
          if [ "$ENV" = "preview" ]; then
            npx wrangler d1 migrations apply quiz-db-preview --env preview --config apps/api/wrangler.toml
          else
            npx wrangler d1 migrations apply quiz-db --config apps/api/wrangler.toml
          fi
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Environment Variable Template

`.env.template` (committed to repo, never `.env`):

```bash
# ============================================================
# Questify Environment Variables
# Copy this file to .env and fill in values for local dev
# NEVER commit .env to git
# ============================================================

# ---- Frontend (apps/web) ----
# VITE_ prefix = exposed to browser bundle
VITE_API_URL=http://localhost:8787
VITE_APP_URL=http://localhost:5173

# ---- Backend (apps/api) local dev only ----
# These are set via `wrangler secret put` in production
BETTER_AUTH_SECRET=changeme-at-least-32-characters-long

# ---- Local database (better-sqlite3 for local dev) ----
DATABASE_URL=./local.db

# ---- Cloudflare (required only for deployment) ----
# Get from Cloudflare dashboard: Account > API Tokens
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

### GitHub Actions Secrets Required

To be configured in repository Settings > Secrets and Variables > Actions:

| Secret Name | Description | Who Sets It |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | DevOps/Axel |
| `CLOUDFLARE_API_TOKEN` | API token with Workers/Pages/D1 permissions | DevOps/Axel |
| `VITE_API_URL` | Production API URL for frontend build | DevOps/Axel |
| `VITE_APP_URL` | Production app URL for frontend build | DevOps/Axel |

Wrangler secrets (set per-environment via wrangler CLI, not GitHub):

| Secret | Command |
|---|---|
| `BETTER_AUTH_SECRET` | `wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.toml` |
| `CORS_ORIGIN` | `wrangler secret put CORS_ORIGIN --config apps/api/wrangler.toml` |

### Local Development

Local dev uses `wrangler dev` for the API (with D1 local SQLite emulation) and `vite dev` for the frontend.

`apps/api/package.json` scripts:
```json
{
  "dev": "wrangler dev --config wrangler.toml",
  "deploy": "wrangler deploy --config wrangler.toml"
}
```

`apps/web/package.json` scripts:
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```

Root `package.json` scripts:
```json
{
  "dev:api": "npm run dev -w @quiz/api",
  "dev:web": "npm run dev -w @quiz/web",
  "build": "npm run build --workspaces --if-present",
  "typecheck": "npm run typecheck --workspaces --if-present"
}
```

### D1 Backup Strategy

D1 export via wrangler CLI:
```bash
wrangler d1 export quiz-db --output backup-$(date +%Y%m%d).sql
```

This is run manually or on a schedule. For v1, weekly manual backup is acceptable. A GitHub Actions `workflow_dispatch` workflow to trigger backup is out of scope for v1 but documented as a follow-up.

### Deployment Checklist

Before first production deploy, Axel must complete:
- [ ] Create Cloudflare account (or confirm access to existing)
- [ ] Create D1 database: `wrangler d1 create quiz-db`
- [ ] Record D1 database ID → update `apps/api/wrangler.toml`
- [ ] Create KV namespace: `wrangler kv namespace create QUIZ_KV`
- [ ] Record KV namespace ID → update `apps/api/wrangler.toml`
- [ ] Set wrangler secrets: `BETTER_AUTH_SECRET`, `CORS_ORIGIN`
- [ ] Run initial D1 migrations: `wrangler d1 migrations apply quiz-db`
- [ ] Create Cloudflare Pages project and link to GitHub repository
- [ ] Configure Pages build settings and environment variables in dashboard
- [ ] Add all GitHub Actions secrets
- [ ] Trigger first deploy manually and verify health check endpoints respond

## Monorepo Touch Points

**Root:**
- New: `.env.template`
- New: `.gitignore` entry for `.env`
- New: `.github/workflows/ci.yml`
- New: `.github/workflows/deploy-web.yml`
- New: `.github/workflows/deploy-api.yml`
- New: `.github/workflows/db-migrate.yml`
- Modified: root `package.json` scripts

**apps/api:**
- New/Modified: `wrangler.toml` (D1 + KV bindings, environments)
- Modified: `package.json` (dev/deploy scripts)

**apps/web:**
- Modified: `package.json` (build scripts)
- Modified: `vite.config.ts` (ensure output dir is `dist`)

**packages/db:**
- Verify: migrations directory path matches `wrangler.toml` migrations_dir

## Directory Structure

```
.github/
  workflows/
    ci.yml
    deploy-web.yml
    deploy-api.yml
    db-migrate.yml

apps/api/
  wrangler.toml          ← D1 + KV bindings, environments

.env.template            ← committed, documents all vars
.gitignore               ← ensure .env is ignored
```

## Implementation Steps

1. **Add .env.template and update .gitignore**
   - Create `.env.template` with all documented variables
   - Ensure `.env` is in `.gitignore` at monorepo root

2. **Configure wrangler.toml for production and preview environments**
   - Create/update `apps/api/wrangler.toml` with D1, KV, and env-specific configurations
   - Set `migrations_dir` to point to `packages/db/migrations`
   - Use placeholder IDs that Axel will fill in after resource creation

3. **Create Cloudflare resources (DevOps task)**
   - Run `wrangler d1 create quiz-db` and `wrangler d1 create quiz-db-preview`
   - Update `wrangler.toml` with actual database IDs
   - Run `wrangler kv namespace create QUIZ_KV` for both environments
   - Update `wrangler.toml` with actual KV namespace IDs

4. **Apply initial D1 migrations**
   - Run `wrangler d1 migrations apply quiz-db`
   - Run `wrangler d1 migrations apply quiz-db-preview --env preview`
   - Verify tables exist via `wrangler d1 execute quiz-db --command "SELECT name FROM sqlite_master WHERE type='table'"`

5. **Set production Worker secrets**
   - `wrangler secret put BETTER_AUTH_SECRET`
   - `wrangler secret put CORS_ORIGIN`
   - Repeat for preview environment with `--env preview`

6. **Create CI GitHub Actions workflow**
   - Create `.github/workflows/ci.yml` per spec
   - Verify biome CI check passes locally before pushing

7. **Create frontend deploy GitHub Actions workflow**
   - Create `.github/workflows/deploy-web.yml` per spec
   - Add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_API_URL`, `VITE_APP_URL` to GitHub Actions secrets

8. **Create backend deploy GitHub Actions workflow**
   - Create `.github/workflows/deploy-api.yml` per spec
   - Verify wrangler version in workflow matches local version

9. **Create D1 migration GitHub Actions workflow**
   - Create `.github/workflows/db-migrate.yml` per spec
   - Test `workflow_dispatch` trigger with environment input

10. **Verify preview deploy pipeline**
    - Create a test PR and confirm: CI runs, preview Pages deploy creates, Worker preview env is accessible
    - Check preview Pages URL + API connectivity

11. **Write deployment runbook**
    - Document the deployment checklist in `docs/architecture/STANDARD-deployment-runbook.md`
    - Include how to roll back (redeploy previous Worker version, restore D1 from backup)

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1600 | Configure wrangler.toml for API Worker (D1 + KV bindings, environments) | chore | Axel | P0 |
| QZ-1601 | Create Cloudflare D1 databases and apply initial migrations | chore | Axel | P0 |
| QZ-1602 | Create Cloudflare KV namespaces and configure Worker secrets | chore | Axel | P0 |
| QZ-1603 | Create GitHub Actions CI workflow (biome, typecheck, build) | chore | Axel | P0 |
| QZ-1604 | Create GitHub Actions deploy-web workflow (Cloudflare Pages) | chore | Axel | P0 |
| QZ-1605 | Create GitHub Actions deploy-api workflow (Cloudflare Workers) | chore | Axel | P0 |
| QZ-1606 | Create GitHub Actions db-migrate workflow with manual trigger | chore | Axel | P0 |
| QZ-1607 | Create .env.template and update .gitignore | chore | Sage | P0 |
| QZ-1608 | Verify preview deploy pipeline end-to-end | chore | Axel | P1 |
| QZ-1609 | Write deployment runbook (STANDARD-deployment-runbook) | chore | Axel | P2 |

## Acceptance Criteria

- [ ] `npm run build` succeeds from monorepo root without errors
- [ ] `npx biome ci .` passes on the repository without modifications
- [ ] `wrangler deploy` deploys the API Worker successfully
- [ ] API health check endpoint (`GET /api/health`) responds 200 from the deployed Worker URL
- [ ] Frontend build deploys to Cloudflare Pages and serves the app at the Pages URL
- [ ] Opening a PR triggers the CI workflow and reports pass/fail on the PR
- [ ] Merging to main triggers both `deploy-web.yml` and `deploy-api.yml`
- [ ] New migration file in `packages/db/migrations/` triggers `db-migrate.yml` on merge to main
- [ ] D1 database contains all schema tables after initial migration
- [ ] Worker secrets `BETTER_AUTH_SECRET` and `CORS_ORIGIN` are set and not visible in logs
- [ ] `.env` is absent from git history and `.env.template` is present
- [ ] Preview deploy for a PR creates a unique Pages preview URL

## Out of Scope

- Custom domain DNS configuration — too environment-specific; documented as follow-up
- Cloudflare Access (zero-trust admin access) — not required for v1
- Multi-region D1 read replication — D1 handles this automatically
- Cloudflare R2 for asset storage — not needed until avatar file upload is implemented
- Alerting and incident response — addressed in monitoring discussion in PHASE-18

## Phase Dependencies

- **PHASE-01 (Monorepo Setup) must be complete** because CI depends on npm workspaces and the build scripts established in that phase
- **PHASE-02 (Database Schema) must be complete** because D1 migration files must exist in `packages/db/migrations/` before the migrate workflow can run
- **PHASE-03 (API Foundation) must be complete** because `wrangler.toml` references the Worker entry point established in that phase
- **PHASE-04 (Authentication) must be complete** because `BETTER_AUTH_SECRET` is a required Worker secret

## Agent Assignments

- **Architect:** Write ADR-021 (environment strategy), ADR-022 (secrets management), STANDARD-wrangler-config
- **Dev/Sage (Backend):** QZ-1607 — .env.template
- **Dev/Nova (Frontend):** Verify vite.config.ts output directory matches Pages build config
- **Dev/Milo (Visual/CSS):** No tasks this phase
- **QA/Ivy:** Verify preview deploy pipeline creates isolated test environment, verify CI blocks merge on lint failures
- **DevOps/Axel:** QZ-1600, QZ-1601, QZ-1602, QZ-1603, QZ-1604, QZ-1605, QZ-1606, QZ-1608, QZ-1609
- **Remy (Producer):** Ensure deployment checklist is complete before declaring PHASE-16 done; coordinate with Axel on Cloudflare account access

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloudflare account limits (D1 row limits, KV operation limits) on free tier | Medium | High | Confirm account tier before deploy; document limits in runbook; upgrade to paid tier if needed |
| wrangler.toml migrations_dir path resolution varies in CI vs. local | Medium | Medium | Test migration path in CI with a dry-run step: `wrangler d1 migrations list quiz-db` |
| BETTER_AUTH_SECRET mismatch between environments causing auth failures | Medium | High | Use different secrets per environment (not the same value); document in ADR-022 |
| GitHub Actions deploy triggers on both web and API path changes simultaneously, causing race | Low | Low | Workflows are independent; Cloudflare Pages and Workers are separate systems; no race condition |
| D1 free tier (500MB) exceeded by large response datasets | Low | Medium | Monitor D1 storage via wrangler; document cleanup strategy for old response data |

## Estimated Effort

L
