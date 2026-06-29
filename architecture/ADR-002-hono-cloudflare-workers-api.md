---
title: "ADR-002: Hono on Cloudflare Workers API"
status: "Accepted"
date: "2026-06-29"
authors: "Questify Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-002: Hono on Cloudflare Workers API

## Context

The Questify API (`apps/api`) must be globally distributed with zero cold start, low latency for quiz delivery, and no infrastructure management overhead. The deployment target is Cloudflare Workers, which runs JavaScript on V8 isolates — not a Node.js process. This runtime constraint eliminates frameworks that depend on TCP sockets, Node.js built-in modules (`net`, `tls`, `fs`), or binary native addons.

The API requires:

- Route matching across multiple resource paths (quiz CRUD, question management, session auth)
- Middleware for CORS, authentication, and request logging
- TypeScript generics to type Cloudflare bindings (`D1Database`, `KVNamespace`) as first-class `c.env` properties rather than global ambient types
- CORS configuration for consumption by the `apps/web` React SPA hosted on Cloudflare Pages

## Decision

Use Hono as the HTTP framework for `apps/api`, deployed on Cloudflare Workers via `wrangler`.

Hono is purpose-built for edge runtimes: it has zero Node.js dependencies, ships its own router and middleware pipeline, and provides TypeScript generics for typing the Cloudflare `Env` binding object through `new Hono<{ Bindings: Bindings }>()`. The `@hono/hono` package is Workers-native with no polyfills required.

The framework is instantiated with full binding types so `c.env.QUIZ_DB` (D1) and `c.env.QUIZ_KV` (KV) are fully typed throughout all route handlers without casting. Built-in middleware (`hono/cors`, `hono/logger`) eliminates the need to hand-roll these concerns.

## Consequences

### Positive

- **POS-001**: Runs natively on V8 isolates — zero cold start, no container spin-up, global distribution via Cloudflare's network edge without configuration.
- **POS-002**: TypeScript generics for `Bindings` and `Variables` propagate Cloudflare binding types through the entire middleware and route chain, preventing runtime errors from misconfigured binding names.
- **POS-003**: Minimal dependency footprint — Hono adds no transitive dependencies that could conflict with Workers bundling or inflate the worker bundle size past the 1 MB compressed limit.
- **POS-004**: `wrangler dev` provides a local development server with live D1 and KV binding proxies, enabling a fully local dev loop without deploying to Cloudflare.

### Negative

- **NEG-001**: Hono is a niche framework compared to Express or Fastify; new developers unfamiliar with the Workers runtime must learn both the framework and the edge execution model simultaneously.
- **NEG-002**: The Workers runtime does not support streaming responses backed by Node.js streams — any streaming must use Web Streams API, which is a different programming model than `res.write()`.
- **NEG-003**: Worker bundle size limit (1 MB compressed) constrains how many dependencies can be added to `apps/api`; heavy server-side libraries (PDF generation, image processing) cannot be used.

## Alternatives Considered

### Express / Fastify on Node.js

- **ALT-001**: **Description**: Run the API on a traditional Node.js server (Express or Fastify) deployed to a VPS, container (Fly.io, Railway), or managed service (Cloud Run).
- **ALT-001**: **Rejection reason**: Requires TCP and Node.js APIs that are unavailable on the Workers runtime. Adopting this path would mean abandoning Cloudflare Workers as the compute layer, adding infrastructure cost, reintroducing cold start latency, and managing a separate deployment pipeline. The edge distribution model is a core architectural goal.

### itty-router

- **ALT-002**: **Description**: A minimal (~450 bytes) router for Cloudflare Workers with no middleware abstractions.
- **ALT-002**: **Rejection reason**: No built-in TypeScript generics for `Env` bindings, no middleware pipeline, and no first-class CORS or logging support. Middleware and binding types would be hand-rolled for every route, producing more boilerplate than Hono with no architectural benefit. Hono covers itty-router's use case and extends it materially.

### Workers Native `fetch` Handler (no framework)

- **ALT-003**: **Description**: Implement the API as a single `export default { fetch(req, env, ctx) {} }` handler with manual URL parsing and routing.
- **ALT-003**: **Rejection reason**: Viable for a single-endpoint Worker but becomes unmanageable with multiple resource types, shared middleware, and auth checks. The boilerplate for routing, CORS, and error handling would replicate what Hono provides in a well-tested, typed package.

## Implementation Notes

- **IMP-001**: `apps/api/src/index.ts` exports `new Hono<{ Bindings: Bindings }>()` as the default export consumed by `wrangler`. The `Bindings` interface is declared in `apps/api/src/types.ts` and references `D1Database` and `KVNamespace` from `@cloudflare/workers-types`.
- **IMP-002**: `wrangler.toml` declares `[[d1_databases]]` for `QUIZ_DB` and `[[kv_namespaces]]` for `QUIZ_KV`. These binding names must match the `Bindings` interface exactly — a mismatch produces a runtime `undefined` error on `c.env`.
- **IMP-003**: Verify by running `wrangler dev` and confirming that `GET /health` returns 200 and that a route exercising `c.env.QUIZ_DB.prepare(...)` executes without binding errors against the local D1 proxy.

## References

- **REF-001**: [ADR-001-npm-workspaces-monorepo.md](ADR-001-npm-workspaces-monorepo.md) — workspace structure for `apps/api`
- **REF-002**: [ADR-003-drizzle-d1-database.md](ADR-003-drizzle-d1-database.md) — D1 binding consumed via `c.env.QUIZ_DB`
- **REF-003**: [ADR-004-cloudflare-kv-sessions.md](ADR-004-cloudflare-kv-sessions.md) — KV binding consumed via `c.env.QUIZ_KV`
- **REF-004**: [Hono documentation — Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
