---
title: "ADR-008: Database & ORM — Drizzle ORM + Cloudflare D1"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-008: Database & ORM — Drizzle ORM + Cloudflare D1

## Context

Questify needs persistent storage for users, questionnaires, questions, options, responses, answers, and sessions. The storage layer must run on Cloudflare infrastructure (ADR-012) to colocate with the Workers API — cross-network database queries would add latency. The chosen ORM must be compatible with the Cloudflare Workers runtime (no Node.js native binaries) and must support schema migrations via code-first schema definitions.

## Decision

Use Drizzle ORM as the query builder/ORM and Cloudflare D1 as the SQLite-compatible database.

Cloudflare D1 is SQLite-compatible and runs on Cloudflare's infrastructure — it is accessed from a Worker via a D1Database binding with no TCP connection. Queries from a Worker to D1 have sub-millisecond latency because they execute in the same Cloudflare data centre. Drizzle ORM is lightweight (no native binary sidecar, unlike Prisma), generates fully typed query results from the schema definition, and its `drizzle-kit` CLI generates SQL migrations automatically from schema diffs. The Drizzle D1 adapter is the official integration path, actively maintained by the Drizzle team.

D1/SQLite-specific type decisions: JSONB-like structures (questionnaire settings, question-specific validation rules) are stored as `TEXT` (SQLite has no native JSON type; D1 supports `JSON_EXTRACT` queries on text columns). Timestamps are stored as `INTEGER` (Unix epoch) for reliable sorting and arithmetic. IDs use `nanoid()` or `cuid2()` (no `SERIAL` — D1 does not support auto-increment in the way PostgreSQL does; text IDs are more portable).

## Consequences

### Positive

- **POS-001**: The entire data layer (Workers + D1) lives within one Cloudflare account — no cross-vendor networking, no connection pool management, no VPC configuration
- **POS-002**: Drizzle's schema-as-code means the TypeScript types for database rows are automatically derived from the schema — no separate type definitions to maintain
- **POS-003**: D1's SQLite-compatible dialect means local development uses the exact same SQL dialect as production (`wrangler d1 execute --local`)

### Negative

- **NEG-001**: D1 is SQLite-based — it does not support `RETURNING` on all DML operations in all D1 API versions, JSON aggregation functions, or window functions available in PostgreSQL; complex analytics queries may need workarounds
- **NEG-002**: D1 has a row size limit and database size limit (currently 10GB free, 500MB per object) — suitable for MVP but must be monitored at scale
- **NEG-003**: Drizzle's `drizzle-kit` migration toolchain adds a dev dependency and an extra step before deployment — migrations must be run with `wrangler d1 migrations apply` before deploying new Workers code

## Alternatives Considered

### Prisma

- **ALT-001**: **Description**: The most popular TypeScript ORM, with a rich schema DSL and generated client
- **ALT-001**: **Rejection reason**: Prisma's query engine is a native binary sidecar process that cannot run inside a Cloudflare Worker. Prisma's edge driver (`@prisma/adapter-d1`) exists but lags behind the main client in features and has known limitations with D1.

### Kysely

- **ALT-002**: **Description**: A type-safe SQL query builder with no opinions on schema definition
- **ALT-002**: **Rejection reason**: Kysely has no migration tooling — migrations must be written as raw SQL by hand. Drizzle's `drizzle-kit generate` provides automated migration diffs, which is essential for keeping the schema and TypeScript types in sync.

### Raw SQL (`d1.prepare(...).run()`)

- **ALT-003**: **Description**: D1 exposes a raw SQL interface that can be used directly without an ORM
- **ALT-003**: **Rejection reason**: Type safety for query inputs and outputs would require manual TypeScript declarations, increasing risk of SQL injection and type mismatches. Drizzle generates typed queries from the schema.

### Turso (libSQL)

- **ALT-004**: **Description**: A distributed SQLite service from the Turso team, compatible with Drizzle
- **ALT-004**: **Rejection reason**: Introduces an additional vendor outside the Cloudflare ecosystem, adding cost and credential management complexity. D1 is already available within the same Cloudflare account.

## Implementation Notes

- **IMP-001**: The Drizzle schema lives in `packages/db/src/schema.ts`; the `createDb(d1: D1Database)` factory function in `packages/db/src/index.ts` returns a typed Drizzle client bound to the D1 instance from `c.env.DB`
- **IMP-002**: Migrations are generated with `npm run db:generate` (drizzle-kit), applied locally with `npm run db:migrate:local`, and applied to production with `npm run db:migrate:prod`; the wrangler binding name is `QUIZ_DB`
- **IMP-003**: Success criterion — `npm run db:migrate:local` runs without errors; `npm run db:studio` opens Drizzle Studio connected to the local D1 database; a seed script populates the dev database with test data

## References

- **REF-001**: `ADR-006-backend-framework.md` — D1 is accessed via `c.env.DB` in Hono context
- **REF-002**: `ADR-007-authentication.md` — Better-auth's Drizzle adapter shares the same D1 database
- **REF-003**: `ADR-013-monorepo-structure.md` — the Drizzle schema lives in `packages/db/`
- **REF-004**: https://orm.drizzle.team/docs/connect-cloudflare-d1
