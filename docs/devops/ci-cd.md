# CI/CD Pipeline — Quiz Creator v2 (Questify)

## Pipeline Overview

```
PR opened / pushed
  │
  ▼
┌──────────────────────────────────────────┐
│  CI: ci.yml                               │
│  1. Biome check (lint + format)          │
│  2. Type check (tsc --noEmit)            │
│  3. Build (web + api)                    │
│  4. E2E tests (Playwright, preview env)  │
└──────────────────┬───────────────────────┘
                   │ all pass
                   ▼
             PR review required
                   │ approved
                   ▼
             Merge to main
                   │
          ┌────────┴────────┐
          ▼                 ▼
┌──────────────────┐ ┌──────────────────────┐
│ deploy-web.yml   │ │ deploy-api.yml        │
│ Cloudflare Pages │ │ Cloudflare Workers    │
│ (automatic)      │ │ (automatic)           │
└──────────────────┘ └──────────────────────┘
                   │
                   ▼ (manual trigger, with approval gate)
┌──────────────────────────────────────────┐
│  db-migrate.yml                           │
│  wrangler d1 migrations apply quiz-db    │
│  Requires: release tag + QA sign-off     │
└──────────────────────────────────────────┘
```

---

## GitHub Actions: CI

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Biome check (lint + format)
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Build (web + api)
        run: npm run build
        env:
          VITE_API_URL: http://localhost:8787
          VITE_APP_URL: http://localhost:5173

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start API (wrangler dev) + run E2E
        run: |
          npm run dev:api &
          npx wait-on http://localhost:8787
          npm run test:e2e
        env:
          BETTER_AUTH_SECRET: ci-test-secret-do-not-use-in-production
```

---

## GitHub Actions: Deploy Frontend

**File:** `.github/workflows/deploy-web.yml`

```yaml
name: Deploy Frontend (Cloudflare Pages)

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build -w @quiz/web
        env:
          VITE_API_URL: ${{ vars.VITE_API_URL }}
          VITE_APP_URL: ${{ vars.VITE_APP_URL }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/web/dist --project-name=questify
```

---

## GitHub Actions: Deploy Backend

**File:** `.github/workflows/deploy-api.yml`

```yaml
name: Deploy Backend (Cloudflare Workers)

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --config apps/api/wrangler.toml
```

---

## GitHub Actions: Database Migrations

**File:** `.github/workflows/db-migrate.yml`

```yaml
name: D1 Database Migration

on:
  workflow_dispatch:    # manual trigger — run only after QA sign-off on schema changes
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [production, preview]

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}   # requires GitHub environment approval
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run D1 migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 migrations apply quiz-db ${{ inputs.environment == 'production' && '' || '--local' }}
```

---

## Branch Protection Rules

Configure on GitHub → Settings → Branches → `main`:

- [x] Require a pull request before merging
- [x] Require at least 1 approval
- [x] Require status checks to pass: `ci / ci` (biome, typecheck, build, e2e)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

---

## GitHub Secrets & Variables

**Secrets** (GitHub → Settings → Secrets → Actions):

| Secret | Used in | How to get |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | All deploy workflows | Cloudflare dashboard → API Tokens → Create Token (Workers & Pages deploy template) |
| `CLOUDFLARE_ACCOUNT_ID` | All deploy workflows | Cloudflare dashboard → right sidebar |
| `BETTER_AUTH_SECRET` | Workers env (via wrangler secret) | `openssl rand -base64 32` |

**Variables** (GitHub → Settings → Variables → Actions):

| Variable | Example value |
|---|---|
| `VITE_API_URL` | `https://api.questify.app` |
| `VITE_APP_URL` | `https://questify.app` |

> Note: Worker secrets (`BETTER_AUTH_SECRET`, `CORS_ORIGIN`) are set directly in Workers via `wrangler secret put`, not through GitHub Actions.

---

## npm Scripts (Root `package.json`)

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:web\" \"npm:dev:api\"",
    "dev:web": "npm run dev -w @quiz/web",
    "dev:api": "wrangler dev --config apps/api/wrangler.toml",
    "build": "npm run build -w @quiz/web && npm run build -w @quiz/api",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test:e2e": "playwright test",
    "db:generate": "npm run db:generate -w @quiz/db",
    "db:migrate:local": "npm run db:migrate:local -w @quiz/db",
    "db:studio": "npm run db:studio -w @quiz/db",
    "db:seed": "npm run db:seed -w @quiz/db"
  }
}
```

---

## Commit Convention

Format: `QZ-NNNN | type(scope): description`

```
QZ-NNNN | feat(scope):     new feature
QZ-NNNN | fix(scope):      bug fix (add "Closes QZ-NNNN" at end)
QZ-NNNN | chore:           tooling, deps, config
QZ-NNNN | docs:            documentation only
QZ-NNNN | test:            test changes only
QZ-NNNN | refactor(scope): refactor with no behavior change
QZ-NNNN | style:           formatting only
```

Examples:
```
QZ-0003 | chore(monorepo): init npm workspaces with apps/web and apps/api
QZ-0012 | feat(auth): add better-auth sign-in with email and username
QZ-0042 | fix(builder): correct checkbox state on question reorder (Closes QZ-0042)
```
