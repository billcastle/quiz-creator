---
phase: 08
title: "Backend API Foundation"
status: pending
depends_on: ["PHASE-07"]
estimated_tickets: 5
---

# PHASE-08 — Backend API Foundation

## Overview

This phase establishes the complete Hono API infrastructure in `apps/api` — all middleware, error handling, route structure, Worker environment type bindings, and D1 client integration. Route handlers are scaffolded with correctly typed request/response shapes but contain no business logic: reads always return empty or stub data, writes always return a success stub. This is the skeleton that every subsequent backend phase builds on.

The goal is a running Wrangler dev server that enforces the API contract (auth guards, validation, correct HTTP status codes, standard response shape) before any real data access is implemented. This approach lets frontend development (PHASE-10 and beyond) begin against real API endpoints that behave correctly from an HTTP perspective, even while the business logic is pending.

---

## Goals

- [ ] Create `apps/api/src/index.ts` — Hono app entry with typed `Env` bindings
- [ ] Define Worker environment types in `apps/api/src/types/env.ts`
- [ ] Define Hono context augmentation types in `apps/api/src/types/context.ts`
- [ ] Implement CORS middleware (`apps/api/src/middleware/cors.ts`)
- [ ] Implement global error handler (`apps/api/src/middleware/error.ts`)
- [ ] Implement validation middleware factory (`apps/api/src/middleware/validation.ts`)
- [ ] Implement DB attachment middleware (`apps/api/src/middleware/db.ts`)
- [ ] Implement auth stub middleware (`apps/api/src/middleware/auth.ts`) with `requireAuth` and `requireAdmin`
- [ ] Implement `ok()` and `err()` response helpers (`apps/api/src/lib/response.ts`)
- [ ] Create all route files (feed, questionnaires, questions, responses, users, admin, categories) with scaffolded handlers
- [ ] Register all routes in `apps/api/src/routes/index.ts`
- [ ] Configure `apps/api/wrangler.toml` with D1 and KV bindings
- [ ] `npm run dev:api` starts Wrangler dev server with zero errors
- [ ] TypeScript strict mode: zero errors in `apps/api`
- [ ] `GET /api/feed` returns `200` with `{ data: { questionnaires: [], total: 0, page: 1 } }`
- [ ] `POST /api/questionnaires` without auth returns `401`
- [ ] Unknown routes return `404` with `{ error: 'Not found', code: 'NOT_FOUND' }`
- [ ] D1 client accessible via `c.get('db')` in all route handlers

---

## Architecture Decisions Required

**Single Hono app as Cloudflare Worker** — The entire API is a single Hono application exported as the Worker's fetch handler. There is no Express adapter, no Node.js HTTP server, no Next.js API routes. The `export default app` statement in `index.ts` IS the Cloudflare Worker entrypoint. Wrangler handles routing all HTTP requests to this handler.

**Response shape STANDARD enforced via helpers** — All route handlers must use the `ok()` / `err()` helper functions from `apps/api/src/lib/response.ts`. Direct `c.json()` calls are forbidden in route files. This constraint exists so that the response envelope (the `data` wrapper, error `code` field) is consistent everywhere. Linting rules or code review enforce this.

**Auth middleware as scaffold in PHASE-08** — The real session validation (reading Better-auth session cookies, verifying JWTs) is implemented in PHASE-09. In this phase, `auth.ts` middleware is a passthrough that sets `c.set('user', undefined)`. The `requireAuth` guard still returns `401` when `user` is undefined — meaning all protected endpoints are properly locked behind auth even before PHASE-09. This is intentional: the frontend can test auth flows against real HTTP 401 responses.

**Zod validation in middleware, not in handlers** — Validation is never done inline in route handlers. The `validate(schema)` middleware factory is called in the route definition itself (before the handler), and the handler accesses the already-validated body via `c.get('body')`. This keeps handlers thin and keeps all error-shape logic in one place.

---

## Technical Architecture

### Hono Application Entry (`apps/api/src/index.ts`)

```typescript
import { Hono } from 'hono'
import type { Env } from './types/env'
import { corsMiddleware }  from './middleware/cors'
import { dbMiddleware }    from './middleware/db'
import { errorHandler }    from './middleware/error'
import { registerRoutes }  from './routes/index'

const app = new Hono<{ Bindings: Env }>()

// Global middleware — order matters
app.use('*', corsMiddleware)
app.use('*', dbMiddleware)

// Global error handler
app.onError(errorHandler)

// 404 for unmatched routes
app.notFound((c) =>
  c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
)

// Mount all route groups
registerRoutes(app)

export default app
```

The `new Hono<{ Bindings: Env }>()` generic parameter tells Hono the shape of `c.env`, enabling full TypeScript autocompletion on all Cloudflare binding access (`c.env.QUIZ_DB`, `c.env.AUTH_SECRET`, etc.).

The `app.notFound()` handler fires before `app.onError()` — it is a clean fallthrough, not an exception.

---

### Cloudflare Worker Environment Types (`apps/api/src/types/env.ts`)

```typescript
/**
 * Cloudflare Worker bindings declared in wrangler.toml.
 *
 * This interface is the source of truth for all env vars and bindings.
 * wrangler.toml must declare a matching entry for every field here.
 * Missing bindings will cause a runtime error when Wrangler starts.
 */
export interface Env {
  /** Cloudflare D1 database. Bound as QUIZ_DB in wrangler.toml. */
  QUIZ_DB: D1Database

  /** Cloudflare KV namespace. Bound as QUIZ_KV in wrangler.toml. */
  QUIZ_KV: KVNamespace

  /** Secret used for session signing. Set via wrangler secret. */
  AUTH_SECRET: string

  /** Better-auth internal secret. Must match BETTER_AUTH_SECRET in web app. */
  BETTER_AUTH_SECRET: string

  /** The public URL of the auth server (this worker). */
  BETTER_AUTH_URL: string

  /** Allowed CORS origin (e.g. https://app.questify.dev). Wildcard in dev. */
  CORS_ORIGIN: string

  /** Optional: 'development' | 'production'. Affects error verbosity. */
  NODE_ENV?: string
}
```

This interface is imported by every middleware and route file that needs to access `c.env`. It is NOT a global `declare` — it is a normal exported interface used as the `Bindings` type parameter.

---

### Hono Context Augmentation (`apps/api/src/types/context.ts`)

```typescript
import type { Context } from 'hono'
import type { Env }    from './env'
import type { AppDb }  from '@quiz/db'

/**
 * Variables set on context by middleware (not wrangler.toml bindings).
 *
 * Access via c.get('user'), c.get('db'), c.get('body').
 * Set via c.set('user', ...), c.set('db', ...).
 */
export interface Variables {
  /** Authenticated user, set by auth middleware. Undefined if unauthenticated. */
  user?: {
    id:       string
    username: string
    email:    string
    role:     'user' | 'admin'
  }

  /** Drizzle D1 client, set by db middleware. Always present after db middleware runs. */
  db: AppDb

  /** Validated request body, set by validate() middleware. Present only on routes that use validate(). */
  body: unknown
}

/** Convenience alias for the fully-typed Hono Context used across the app. */
export type HonoContext = Context<{ Bindings: Env; Variables: Variables }>
```

Using `c.get('db')` requires `Variables.db` to be declared here. If this declaration is missing, TypeScript will infer the type as `unknown`.

---

### Middleware Stack (`apps/api/src/middleware/`)

#### `cors.ts`

```typescript
import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = (c, next) =>
  cors({
    origin:      c.env.CORS_ORIGIN || '*',
    allowMethods:['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders:['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,   // required for cookie-based auth sessions
    maxAge:      86400,  // 24h preflight cache
  })(c, next)
```

Using `c.env.CORS_ORIGIN` means the allowed origin is configured per-environment in `wrangler.toml` (or via `wrangler secret`). In local dev, this is `*`. In production, it is the exact frontend origin (no wildcard).

Setting `credentials: true` is required for the `Set-Cookie` header from Better-auth (PHASE-09) to be accepted by the browser.

#### `db.ts`

```typescript
import type { MiddlewareHandler } from 'hono'
import type { Env, Variables }   from '../types'
import { createDb }              from '@quiz/db'

export const dbMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  c.set('db', createDb(c.env.QUIZ_DB))
  await next()
}
```

This middleware runs globally (registered before routes in `index.ts`). After it runs, every route handler can call `c.get('db')` and receive a fully typed `AppDb` client.

`createDb()` is pure — it wraps the D1 binding in a Drizzle client with no side effects. It is safe to call on every request with no connection pooling concerns (D1 connections are managed by the Cloudflare runtime).

#### `auth.ts`

Phase-08 scaffold — passthrough only. Real implementation in PHASE-09.

```typescript
import type { MiddlewareHandler } from 'hono'
import type { Env, Variables }   from '../types'
import { err }                   from '../lib/response'

// Scaffold: always sets user to undefined. PHASE-09 replaces this with real session lookup.
export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  c.set('user', undefined)
  await next()
}

/**
 * Guard: returns 401 if no authenticated user on context.
 * Applied per-route, not globally.
 */
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const user = c.get('user')
  if (!user) return err(c, 'Authentication required', 'UNAUTHORIZED', 401)
  await next()
}

/**
 * Guard: returns 403 if authenticated user is not an admin.
 * Must be used after requireAuth (will 401 if user is undefined).
 */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const user = c.get('user')
  if (!user)               return err(c, 'Authentication required', 'UNAUTHORIZED', 401)
  if (user.role !== 'admin') return err(c, 'Admin access required', 'FORBIDDEN', 403)
  await next()
}
```

#### `validation.ts`

```typescript
import { z } from 'zod'
import type { MiddlewareHandler } from 'hono'
import type { Env, Variables }   from '../types'
import { err }                   from '../lib/response'

/**
 * Middleware factory. Validates the request body against a Zod schema.
 * On success: attaches parsed body to c.set('body', parsed).
 * On failure: returns 422 with Zod flatten error details.
 *
 * @example
 *   router.post('/', validate(createQuestionnaireSchema), handler)
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T
): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    let raw: unknown
    try {
      raw = await c.req.json()
    } catch {
      return err(c, 'Invalid JSON body', 'VALIDATION_ERROR', 422)
    }

    const result = schema.safeParse(raw)
    if (!result.success) {
      return c.json(
        {
          error:   'Validation failed',
          code:    'VALIDATION_ERROR',
          details: result.error.flatten(),
        },
        422
      )
    }

    c.set('body', result.data as z.infer<T>)
    await next()
  }
}
```

Handlers that use `validate()` cast the body: `const body = c.get('body') as z.infer<typeof schema>`. A future improvement is a typed `validate<T>()` that sets a typed variable key — deferred to keep PHASE-08 scope lean.

#### `error.ts`

```typescript
import type { ErrorHandler }  from 'hono'
import type { Env }           from '../types/env'

export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
  const isDev = c.env.NODE_ENV !== 'production'

  console.error('[API Error]', err.message, err.stack)

  return c.json(
    {
      error:   'Internal server error',
      code:    'INTERNAL_ERROR',
      ...(isDev && { message: err.message, stack: err.stack }),
    },
    500
  )
}
```

`console.error()` in a Cloudflare Worker routes to Wrangler's log output in development and to `wrangler tail` in production. Never use `console.log` for errors — use `console.error` so severity is captured correctly.

---

### Standard Response Helpers (`apps/api/src/lib/response.ts`)

These are the ONLY approved way to return responses from route handlers. Using `c.json()` directly in a route handler is a code review violation.

```typescript
import type { HonoContext } from '../types/context'

type OkStatus  = 200 | 201
type ErrStatus = 400 | 401 | 403 | 404 | 422 | 500

/**
 * Successful response. Wraps data in { data: T }.
 *
 * @example
 *   return ok(c, { questionnaires: [], total: 0, page: 1 })
 *   return ok(c, { id: questionnaire.id }, 201)
 */
export function ok<T>(c: HonoContext, data: T, status: OkStatus = 200) {
  return c.json({ data }, status)
}

/**
 * Error response. Returns { error, code } shape.
 *
 * @example
 *   return err(c, 'Questionnaire not found', 'NOT_FOUND', 404)
 *   return err(c, 'Authentication required', 'UNAUTHORIZED', 401)
 */
export function err(
  c: HonoContext,
  error: string,
  code: string,
  status: ErrStatus = 400
) {
  return c.json({ error, code }, status)
}
```

The `{ data: T }` wrapper on `ok()` matches the STANDARD-api-response-shape defined in PHASE-01. All TanStack Query fetchers in `apps/web` are written to unwrap `.data` from the response.

---

### Route Registration (`apps/api/src/routes/index.ts`)

```typescript
import type { Hono }         from 'hono'
import type { Env }          from '../types/env'
import { feedRoutes }         from './feed'
import { questionnaireRoutes } from './questionnaires'
import { questionRoutes }     from './questions'
import { responseRoutes }     from './responses'
import { userRoutes }         from './users'
import { adminRoutes }        from './admin'
import { categoryRoutes }     from './categories'

export function registerRoutes(app: Hono<{ Bindings: Env }>) {
  app.route('/api/auth',           authRoutes)          // Better-auth — PHASE-09
  app.route('/api/feed',           feedRoutes)
  app.route('/api/questionnaires', questionnaireRoutes)
  app.route('/api/questions',      questionRoutes)
  app.route('/api/responses',      responseRoutes)
  app.route('/api/users',          userRoutes)
  app.route('/api/admin',          adminRoutes)
  app.route('/api/categories',     categoryRoutes)
}
```

Each route file creates its own `new Hono()` instance and exports it. The `registerRoutes` function mounts them all on the root app.

---

### Route Files — Scaffolded Handlers

All route handlers in PHASE-08 follow this pattern:
- Correct HTTP method and path
- Auth guards applied (`requireAuth`, `requireAdmin`) where specified
- Validation middleware applied where specified (Zod schema TBD in implementation phase)
- Returns stub data using `ok()` or guards return `err()` via middleware
- No D1 queries yet

#### `routes/feed.ts`

```typescript
// GET /api/feed
// Public. Returns paginated list of published public questionnaires.
// Query params: ?page=1&limit=20&category=&type=
router.get('/', async (c) => {
  const page     = Number(c.req.query('page')  ?? 1)
  const limit    = Number(c.req.query('limit') ?? 20)
  const category = c.req.query('category')
  const type     = c.req.query('type')

  // PHASE-08 stub — real query in PHASE-10
  return ok(c, { questionnaires: [], total: 0, page, limit })
})
```

#### `routes/questionnaires.ts`

```typescript
// GET  /api/questionnaires/:slug          — public if published+public
// POST /api/questionnaires                — requireAuth
// PUT  /api/questionnaires/:id            — requireAuth (owner only)
// DELETE /api/questionnaires/:id          — requireAuth (owner only)
// POST /api/questionnaires/:id/publish    — requireAuth
// GET  /api/questionnaires/take/:shareToken — public, no isCorrect fields
// GET  /api/questionnaires/:id/responses  — requireAuth (owner only)

router.get('/:slug',        async (c) => ok(c, null))
router.post('/',            requireAuth, async (c) => ok(c, null, 201))
router.put('/:id',          requireAuth, async (c) => ok(c, null))
router.delete('/:id',       requireAuth, async (c) => ok(c, null))
router.post('/:id/publish', requireAuth, async (c) => ok(c, null))
router.get('/take/:shareToken',          async (c) => ok(c, null))
router.get('/:id/responses', requireAuth, async (c) => ok(c, { responses: [], total: 0 }))
```

**Note on route order:** `/take/:shareToken` must be registered before `/:id/responses` and `/:id` to avoid `:id` swallowing the static `take` segment. Hono matches in registration order.

#### `routes/questions.ts`

```typescript
// POST /api/questions          — requireAuth
// PUT  /api/questions/:id      — requireAuth
// DELETE /api/questions/:id    — requireAuth
// PUT  /api/questions/reorder  — requireAuth (batch reorder)

router.post('/',          requireAuth, async (c) => ok(c, null, 201))
router.put('/reorder',    requireAuth, async (c) => ok(c, null))
router.put('/:id',        requireAuth, async (c) => ok(c, null))
router.delete('/:id',     requireAuth, async (c) => ok(c, null))
```

`PUT /reorder` must be declared before `PUT /:id` so Hono does not interpret `reorder` as an `:id` value.

#### `routes/responses.ts`

```typescript
// POST /api/responses      — public (anonymous or authenticated)
// GET  /api/responses/:id  — requireAuth or respondent match (owner check in business logic)

router.post('/',    async (c) => ok(c, null, 201))
router.get('/:id',  async (c) => ok(c, null))
```

#### `routes/users.ts`

```typescript
// GET /api/users/:username         — public profile
// GET /api/users/me                — requireAuth
// PUT /api/users/me                — requireAuth
// GET /api/users/me/questionnaires — requireAuth
// GET /api/users/me/analytics      — requireAuth

// Static paths before parameterized paths
router.get('/me',                    requireAuth, async (c) => ok(c, null))
router.put('/me',                    requireAuth, async (c) => ok(c, null))
router.get('/me/questionnaires',     requireAuth, async (c) => ok(c, { questionnaires: [], total: 0 }))
router.get('/me/analytics',          requireAuth, async (c) => ok(c, null))
router.get('/:username',             async (c) => ok(c, null))
```

`/me` routes must be declared before `/:username` to prevent `/me` matching the username parameter.

#### `routes/admin.ts`

```typescript
// GET /api/admin/analytics       — requireAdmin
// GET /api/admin/users           — requireAdmin
// PUT /api/admin/users/:id/role  — requireAdmin

router.get('/analytics',      requireAdmin, async (c) => ok(c, null))
router.get('/users',          requireAdmin, async (c) => ok(c, { users: [], total: 0 }))
router.put('/users/:id/role', requireAdmin, async (c) => ok(c, null))
```

#### `routes/categories.ts`

```typescript
// GET /api/categories    — public
// POST /api/categories   — requireAdmin

router.get('/',  async (c) => ok(c, { categories: [] }))
router.post('/', requireAdmin, async (c) => ok(c, null, 201))
```

---

### HTTP Status Code Conventions

| Code | Meaning                                 | When to Use                                          |
|------|-----------------------------------------|------------------------------------------------------|
| 200  | OK                                      | Successful GET, PUT, DELETE                          |
| 201  | Created                                 | Successful POST that creates a resource              |
| 400  | Bad Request                             | Business logic errors (duplicate slug, etc.)         |
| 401  | Unauthorized                            | No valid session / missing credentials               |
| 403  | Forbidden                               | Authenticated but insufficient permissions           |
| 404  | Not Found                               | Resource does not exist or is not visible to caller  |
| 422  | Unprocessable Entity                    | Zod validation failed (request body malformed)       |
| 500  | Internal Server Error                   | Unhandled exception caught by global error handler   |

The distinction between 401 and 403 is strict: 401 means "I don't know who you are", 403 means "I know who you are but you can't do this". Never return 403 for unauthenticated requests.

---

### Error Code Conventions

The `code` field in every error response is a machine-readable string constant. Clients use `code` (not HTTP status or `error` message text) for programmatic error handling.

| Code               | HTTP Status | Meaning                                              |
|--------------------|-------------|------------------------------------------------------|
| `NOT_FOUND`        | 404         | Resource does not exist                              |
| `UNAUTHORIZED`     | 401         | No valid session                                     |
| `FORBIDDEN`        | 403         | Authenticated, insufficient permission               |
| `VALIDATION_ERROR` | 422         | Zod schema validation failed                         |
| `ALREADY_EXISTS`   | 400         | Attempted to create a resource that already exists   |
| `INTERNAL_ERROR`   | 500         | Unhandled server error                               |

Additional codes may be added in later phases (e.g., `QUOTA_EXCEEDED`, `QUESTIONNAIRE_ARCHIVED`). All new codes must be documented in this table before use.

---

### Wrangler Config (`apps/api/wrangler.toml`)

```toml
name            = "quiz-api"
main            = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_ENV    = "development"
CORS_ORIGIN = "*"
BETTER_AUTH_URL = "http://localhost:8787"

# Secrets (set via `wrangler secret put AUTH_SECRET` — never in this file):
# AUTH_SECRET
# BETTER_AUTH_SECRET

[[d1_databases]]
binding        = "QUIZ_DB"
database_name  = "quiz-db"
database_id    = ""   # filled in after: wrangler d1 create quiz-db
migrations_dir = "../../packages/db/src/migrations"

[[kv_namespaces]]
binding = "QUIZ_KV"
id      = ""   # filled in after: wrangler kv:namespace create QUIZ_KV
```

Local development note: `wrangler dev` automatically creates a local D1 database in `.wrangler/state/v3/d1/` when `database_id` is empty. You do NOT need to create a Cloudflare account or real D1 instance for local development.

The `nodejs_compat` compatibility flag is required for any npm packages that use Node.js built-ins (e.g., `crypto` for nanoid, `buffer` for bcrypt).

---

### Directory Structure

```
apps/api/
  src/
    index.ts               ← Hono app entry, middleware registration, route mounting
    routes/
      index.ts             ← registerRoutes() — mounts all route groups on root app
      auth.ts              ← Better-auth passthrough (PHASE-09)
      feed.ts              ← GET /api/feed
      questionnaires.ts    ← CRUD + publish + take endpoints
      questions.ts         ← question CRUD + reorder
      responses.ts         ← response submission + retrieval
      users.ts             ← public profile + /me endpoints
      admin.ts             ← admin-only analytics + user management
      categories.ts        ← category list + admin create
    middleware/
      cors.ts              ← Hono cors() with env-driven origin
      db.ts                ← createDb() attachment to context
      auth.ts              ← scaffold passthrough + requireAuth + requireAdmin
      validation.ts        ← validate(schema) middleware factory
      error.ts             ← app.onError global handler
    lib/
      response.ts          ← ok() and err() helpers
      db.ts                ← re-exports createDb from @quiz/db (convenience)
    types/
      env.ts               ← Env interface (wrangler.toml bindings)
      context.ts           ← Variables interface + HonoContext alias
      index.ts             ← barrel: re-exports Env, Variables, HonoContext
  wrangler.toml            ← Worker config, D1 binding, KV binding, vars
  package.json             ← dev:api, typecheck, build scripts
  tsconfig.json            ← extends root tsconfig, strict: true
```

---

## Implementation Steps

### Ticket API-01: Hono App Entry + Environment and Context Types

**Assign:** Sage (Backend)

Set up the Hono application entry point and all TypeScript type definitions.

Deliverables:
- `apps/api/src/types/env.ts` — `Env` interface with all wrangler.toml bindings
- `apps/api/src/types/context.ts` — `Variables` interface, `HonoContext` alias
- `apps/api/src/types/index.ts` — barrel re-export
- `apps/api/src/index.ts` — Hono app creation with typed `Env`, empty middleware stubs, `export default app`
- `apps/api/wrangler.toml` — complete config with D1 and KV bindings
- `apps/api/package.json` — `dev:api` (`wrangler dev`), `typecheck` (`tsc --noEmit`), `build` scripts

Acceptance: `npm run dev:api` starts Wrangler dev server without TypeScript errors. `GET /` returns 404 (no routes yet).

---

### Ticket API-02: Middleware Implementation

**Assign:** Sage (Backend)

Implement all five middleware modules.

Deliverables:
- `apps/api/src/middleware/cors.ts` — CORS with env-driven origin
- `apps/api/src/middleware/db.ts` — D1 → Drizzle client attachment
- `apps/api/src/middleware/auth.ts` — passthrough + `requireAuth` + `requireAdmin`
- `apps/api/src/middleware/validation.ts` — `validate(schema)` factory with Zod 422 response
- `apps/api/src/middleware/error.ts` — global `onError` handler with dev/prod verbosity switch

Acceptance: All middleware files compile with zero TypeScript errors. Unit test (if feasible in Workers runtime): `requireAuth` called with no user returns `{ error: 'Authentication required', code: 'UNAUTHORIZED' }` and HTTP 401.

---

### Ticket API-03: Response Helpers + Route Files

**Assign:** Sage (Backend)

Implement the `ok()`/`err()` helpers and create all route files with stub handlers.

Deliverables:
- `apps/api/src/lib/response.ts` — `ok<T>()` and `err()` with correct generics
- `apps/api/src/routes/feed.ts` — `GET /`
- `apps/api/src/routes/questionnaires.ts` — 7 routes with correct methods, paths, guards
- `apps/api/src/routes/questions.ts` — 4 routes
- `apps/api/src/routes/responses.ts` — 2 routes
- `apps/api/src/routes/users.ts` — 5 routes (static `/me` paths before `/:username`)
- `apps/api/src/routes/admin.ts` — 3 routes
- `apps/api/src/routes/categories.ts` — 2 routes
- `apps/api/src/routes/index.ts` — `registerRoutes()` mounting all groups

Acceptance: `npm run dev:api` serves all routes. `GET /api/feed` returns `200 { data: { questionnaires: [], total: 0, page: 1 } }`.

---

### Ticket API-04: Wrangler Dev Integration + D1 Client Verification

**Assign:** Sage (Backend)

Verify the full stack runs end-to-end in local dev: Wrangler + local D1 + Drizzle client on context.

Deliverables:
- Verify `apps/api/wrangler.toml` `migrations_dir` resolves correctly from the api workspace
- Add a `GET /api/health` diagnostic route that calls `c.get('db').run(sql\`SELECT 1\`)` and returns `{ status: 'ok' }`
- Run `npm run db:migrate:local` to apply PHASE-07 migration, then start dev server and confirm `GET /api/health` returns `200`
- Confirm `tsc --noEmit` in `apps/api` exits with zero errors

Acceptance: `GET /api/health` returns `200 { data: { status: 'ok' } }`. Wrangler console shows no binding errors.

---

### Ticket API-05: Integration Smoke Tests

**Assign:** Sage (Backend)

Write a minimal set of integration smoke tests that verify the API contract.

Deliverables:
- `apps/api/test/smoke.test.ts` — using Hono's test client or `fetch` against `wrangler dev --port 8788`
- Tests:
  1. `GET /api/feed` → 200 with `{ data: { questionnaires: [], total: 0 } }`
  2. `POST /api/questionnaires` (no auth) → 401 with `{ code: 'UNAUTHORIZED' }`
  3. `DELETE /api/questionnaires/fake-id` (no auth) → 401
  4. `GET /api/admin/analytics` (no auth) → 401
  5. `GET /does-not-exist` → 404 with `{ code: 'NOT_FOUND' }`
  6. `POST /api/questionnaires` with malformed JSON → 422 with `{ code: 'VALIDATION_ERROR' }`
- `apps/api/package.json` — add `test:smoke` script

Acceptance: All 6 smoke tests pass. `npm run test:smoke` exits 0.

---

## Acceptance Criteria

- `npm run dev:api` starts Wrangler dev server with no errors
- `GET /api/feed` returns `200` with `{ data: { questionnaires: [], total: 0, page: 1 } }`
- `POST /api/questionnaires` without auth returns `401` with `{ error: 'Authentication required', code: 'UNAUTHORIZED' }`
- `GET /api/admin/analytics` without auth returns `401`
- Unknown routes return `404` with `{ error: 'Not found', code: 'NOT_FOUND' }`
- All middleware registered and functional (CORS headers present, DB on context, auth guards work)
- TypeScript strict mode: zero errors in `apps/api` (`tsc --noEmit` exits 0)
- D1 client accessible via `c.get('db')` in any route handler
- All route files exist with correct HTTP methods, paths, and auth guard assignments
- `GET /api/health` returns `200` confirming D1 binding works in local dev
- All smoke tests pass

---

## Out of Scope

- Business logic implementation (actual D1 queries, data transformation) — PHASE-10 and beyond
- Authentication implementation (Better-auth session validation, login/register handlers) — PHASE-09
- Zod schema definitions for request body validation — per-feature phase
- KV caching integration — per-feature phase
- Rate limiting
- Request logging middleware

---

## Estimated Effort

**M** — The infrastructure is boilerplate-heavy but well-defined. The main complexity is wiring up Hono's type generics correctly so TypeScript catches binding mismatches at compile time, and ensuring Wrangler's local D1 emulation works correctly with the shared migrations directory path.
