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

# 3. Start all apps in parallel
npm run dev
# Web: http://localhost:5173
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

# Create KV namespace — copy the id from the output
wrangler kv namespace create QUIZ_KV
wrangler kv namespace create QUIZ_KV --preview

# Open apps/api/wrangler.toml and replace:
#   database_id  = "REPLACE_WITH_YOUR_D1_ID"
#   id           = "REPLACE_WITH_YOUR_KV_ID"
#   preview_id   = "REPLACE_WITH_PREVIEW_KV_ID"

# Set the auth secret (needed before auth is enabled in Phase 01)
wrangler secret put BETTER_AUTH_SECRET
```

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
