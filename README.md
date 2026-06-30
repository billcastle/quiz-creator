# Questify (Quiz Creator v3)

A monorepo for building and hosting quizzes. Frontend on Cloudflare Pages, API on Cloudflare Workers.

## Prerequisites

- Node.js >= 22
- npm >= 10 (bundled with Node 22)
- Wrangler CLI — `npm install -g wrangler`
- A Cloudflare account (free tier works for local development)

## Getting started

```bash
# 1. Install all workspace dependencies from the repo root
npm install

# 2. Copy the environment template
cp .env.template .env.local
# Edit .env.local and fill in your values

# 3. Apply database migrations to the local D1 instance
npm run db:migrate:local

# 4. Start all apps in parallel
npm run dev
# Web: http://localhost:5173  (Vite proxies /api → :8787 automatically)
# API: http://localhost:8787
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start web + API in parallel |
| `npm run dev:web` | Web app only (Vite, port 5173) |
| `npm run dev:api` | API only (Wrangler, port 8787) |
| `npm run build` | Production build for web and API |
| `npm run lint` | Biome lint check across all workspaces |
| `npm run format` | Biome auto-format all files |
| `npm run typecheck` | TypeScript strict check across all workspaces |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:migrate:local` | Apply D1 migrations to local database |
| `npm run db:studio` | Open Drizzle Studio for local database |

## Cloudflare first-time setup

Before running `npm run dev:api` for the first time, create the Cloudflare resources and update `apps/api/wrangler.toml` with the real IDs.

```bash
# Log in to Cloudflare
wrangler login

# Create D1 database — copy the database_id from the output
wrangler d1 create quiz-db

# Create KV namespace for session storage — copy the ids from the output
wrangler kv namespace create QUIZ_KV
wrangler kv namespace create QUIZ_KV --preview

# Open apps/api/wrangler.toml and replace the placeholder IDs:
#   database_id  = "REPLACE_WITH_YOUR_D1_ID"
#   id           = "REPLACE_WITH_YOUR_KV_ID"
#   preview_id   = "REPLACE_WITH_PREVIEW_KV_ID"

# Apply the initial DB migrations to your remote D1 database
cd apps/api && npx wrangler d1 migrations apply quiz-db --remote && cd ../..

# Set the auth secret — generate any long random string, e.g. openssl rand -hex 32
wrangler secret put BETTER_AUTH_SECRET
```

## Better Auth setup

Questify uses [Better Auth](https://better-auth.com) for email+password authentication. Sessions are stored in Cloudflare KV; user records live in D1.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Cloudflare secret (`wrangler secret put`) | Signs session tokens. Must be set before any auth request. |
| `VITE_API_URL` | `apps/web/.env.local` | API base URL for the auth client. Leave empty in dev (Vite proxies `/api` to port 8787). Set to your deployed API URL in production. |

### Dev workflow

```bash
# In one terminal: start the API (wrangler dev on port 8787)
npm run dev:api

# In another terminal: start the web app (Vite on port 5173)
npm run dev:web

# Or start both in parallel:
npm run dev
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:8787`. This means auth cookies are set on the same origin (`localhost:5173`) — no cross-origin cookie configuration is needed in development.

### Database migrations

Better Auth requires four tables (`user`, `session`, `account`, `verification`). These are defined in `packages/db/src/schema.ts` and created by the migration in `packages/db/migrations/`.

```bash
# Apply migrations to local D1 (run after cloning or after schema changes)
npm run db:migrate:local

# Apply to remote D1 (production)
cd apps/api && npx wrangler d1 migrations apply quiz-db --remote
```

To add a new migration after changing the schema, see [GUIDE-adding-db-migration](architecture/GUIDE-adding-db-migration.md).

### How it works

1. Browser hits `/api/auth/sign-in/email` → Vite proxy forwards to `wrangler dev`
2. Hono calls `createAuth(c.env)` to build a per-request Better Auth instance with the D1 adapter and KV secondary storage
3. Better Auth writes the session token to KV (`QUIZ_KV`) with a TTL
4. Better Auth sets a `better-auth.session_token` cookie on the response
5. On subsequent requests, `authClient.getSession()` in the TanStack Router `beforeLoad` guard reads the session cookie and validates it against KV

## Monorepo structure

```
quiz-creatorv3/
  apps/
    web/          @quiz/web     Vite + React 19 frontend (Cloudflare Pages)
    api/          @quiz/api     Hono API (Cloudflare Workers)
  packages/
    ui/           @quiz/ui      Design system (shadcn/Maia + Tailwind v4)
    db/           @quiz/db      Drizzle ORM schema + D1 client factory
    shared/       @quiz/shared  Zod schemas + TypeScript types for web and API
  docs/                         Architecture and ticket documentation
```

To target a single workspace:

```bash
npm run dev -w @quiz/web
npm install <package> -w @quiz/web
```
