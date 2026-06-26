---
title: "ADR-006: Backend Framework — Hono + Cloudflare Workers"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-006: Backend Framework — Hono + Cloudflare Workers

## Context

Questify requires a REST API to serve quiz data, handle authentication, process quiz submissions, and serve paginated feeds. The API must run on Cloudflare Workers (ADR-012) — the Workers runtime is not Node.js; it implements the Web Standards APIs (Fetch, Request, Response, Headers, ReadableStream). Any framework chosen must be compatible with the Workers runtime without a shim layer.

## Decision

Use Hono as the HTTP framework, deployed as Cloudflare Workers.

Hono is designed from the ground up to run in any Web Standards-compatible runtime, including Cloudflare Workers, Deno, Bun, and plain Service Workers. Its bundle size is under 14KB, which is critical for Workers where bundle size affects startup performance. Hono's middleware system is composable and typed — authentication, CORS, rate limiting, and request logging are added as middleware layers using the same `app.use()` API. The `c.var` typed context system (`c.set('user', user)` + `c.get('user')`) allows middleware to inject typed values that downstream handlers consume without type assertions. Hono's `@hono/zod-validator` middleware integrates Zod validation directly into route handlers, enforcing STANDARD-zod-validation.md at the framework level.

## Consequences

### Positive

- **POS-001**: Native Web Standards support means the Hono app can be tested locally without a Cloudflare emulator (using `wrangler dev`) or even in a plain Node.js environment for unit testing
- **POS-002**: The bundle size is tiny (<14KB) — Workers bundle size directly affects cold start performance; Hono imposes no overhead
- **POS-003**: Typed middleware context (`c.var`) means the authenticated user object is safely typed through every middleware layer without `as User` casts

### Negative

- **NEG-001**: No Node.js-native libraries can be used in the Worker (no `fs`, no `path`, no native `crypto` module) — any npm package that depends on Node.js builtins will fail at runtime
- **NEG-002**: Hono's RPC client feature (`hono/client`) is an option for type-safe frontend API calls, but adopting it would couple the frontend tightly to the backend route structure — this coupling is deferred to a future ADR
- **NEG-003**: The Workers runtime has a 10ms CPU time limit per request (soft) and 50MB memory limit — heavy computational work (e.g., scoring 1000-question exams) must be offloaded or optimized

## Alternatives Considered

### Express.js

- **ALT-001**: **Description**: The most widely used Node.js HTTP framework
- **ALT-001**: **Rejection reason**: Express cannot run inside a Cloudflare Worker without a Node.js compatibility layer (`nodejs_compat` flag). Even with that flag, Express carries Node.js assumptions (file system access, native modules, `http` module internals) that conflict with the Workers security model.

### Fastify

- **ALT-002**: **Description**: A high-performance Node.js framework
- **ALT-002**: **Rejection reason**: Fastify is Node.js-native and not Workers-compatible, for the same reasons as Express.

### Plain `fetch` handler

- **ALT-003**: **Description**: Workers can be written as a single `export default { fetch(request) { ... } }` without any framework
- **ALT-003**: **Rejection reason**: This provides no middleware composition, no validation layer, and no structured error handling — all of which would need to be re-implemented from scratch.

### itty-router

- **ALT-004**: **Description**: A lightweight Workers-compatible router
- **ALT-004**: **Rejection reason**: itty-router has no typed middleware context, no built-in Zod integration, and a smaller middleware ecosystem than Hono.

## Implementation Notes

- **IMP-001**: The Hono app is instantiated at `apps/api/src/index.ts`; route groups are registered from `apps/api/src/routes/` and mounted with `app.route('/api', routeGroup)`
- **IMP-002**: Cloudflare Worker environment bindings (`DB: D1Database`, `KV: KVNamespace`, `BETTER_AUTH_SECRET: string`) are typed via the `Env` interface in `apps/api/src/types/worker-env.ts` and passed as the Hono generic: `new Hono<{ Bindings: Env }>()`
- **IMP-003**: Success criterion — `wrangler dev` starts without errors; all routes respond with the correct `{ data: T }` envelope; health check `GET /api/health` returns `200`

## References

- **REF-001**: `ADR-007-authentication.md` — Better-auth runs inside the Hono app
- **REF-002**: `ADR-008-database-orm.md` — D1 is accessed via `c.env.DB` in Hono context
- **REF-003**: `ADR-012-deployment-platform.md` — Hono Workers are deployed via `wrangler deploy`
- **REF-004**: `STANDARD-api-response-shape.md` — all Hono handlers must return the `{ data: T }` or `{ error, code }` envelope
