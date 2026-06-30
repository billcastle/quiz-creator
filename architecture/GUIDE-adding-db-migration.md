---
title: "GUIDE: Adding a Database Migration"
status: "Current"
audience: "Developers"
---

# GUIDE: Adding a Database Migration

How to add a Drizzle schema change and apply it to the local D1 database. Follow the same steps for remote (production) with the `--remote` flag.

---

## When to use this guide

Any time you need to:
- Add, rename, or remove a table or column in `packages/db/src/schema.ts`
- Run migrations on a fresh local environment after cloning the repo

---

## Steps

### 1. Edit the schema

Open `packages/db/src/schema.ts` and make your changes using the Drizzle SQLite DSL.

```ts
// example: add a column to the user table
export const user = sqliteTable('user', {
  // ... existing columns ...
  displayName: text('display_name'),
})
```

### 2. Generate the migration SQL

Run drizzle-kit from the `packages/db` directory. It diffs the schema against the last applied migration and outputs a new `.sql` file.

```bash
cd packages/db
npx drizzle-kit generate --config=drizzle.config.ts
```

The generated file lands in `packages/db/migrations/`. Review it before proceeding — drizzle-kit will never destructively drop columns unless you explicitly call `drizzle-kit drop`.

### 3. Apply to local D1

From the repo root:

```bash
npm run db:migrate:local
```

This runs `wrangler d1 migrations apply quiz-db --local --config apps/api/wrangler.toml`. Wrangler reads `migrations_dir = "../../packages/db/migrations"` from `wrangler.toml` and applies any unapplied migrations to the local `.wrangler/state` D1 file.

### 4. Apply to remote D1 (production)

```bash
cd apps/api
npx wrangler d1 migrations apply quiz-db --remote
```

Wrangler tracks which migrations have been applied in a `d1_migrations` table on each database, so re-running is idempotent.

---

## Drizzle config location

The config lives at `packages/db/drizzle.config.ts`:

```ts
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
})
```

Running `drizzle-kit generate` without a path assumes it finds `drizzle.config.ts` in the current directory, so always run it from `packages/db`.

---

## Exporting new tables

After adding a table to `schema.ts`, re-export it from `packages/db/src/index.ts` if any API route needs to reference it directly (rather than through the Drizzle adapter that Better Auth uses).

---

## References

- [ADR-003](ADR-003-drizzle-d1-database.md) — why Drizzle + D1
- [ADR-004](ADR-004-cloudflare-kv-sessions.md) — why KV for sessions (not SQL)
- `packages/db/migrations/` — all generated SQL files
