---
title: "ADR-004: Cloudflare KV for Session Storage"
status: "Accepted"
date: "2026-06-29"
authors: "Questify Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-004: Cloudflare KV for Session Storage

## Context

The Questify API uses better-auth for authentication. better-auth manages session tokens that must be persisted, looked up on every authenticated request, and expired automatically after their TTL. A storage backend is required that satisfies these constraints within the Cloudflare Workers runtime:

- **No TCP**: Workers cannot open TCP connections, ruling out Redis (standard protocol), PostgreSQL sessions tables accessed via a TCP Postgres client, and Memcached.
- **TTL-based expiry**: Sessions must expire automatically without a background cleanup job — the storage layer must support per-key TTL at write time.
- **Low read latency**: Session lookups occur on every authenticated API request; the storage layer must be fast relative to the Worker's execution time budget.
- **No additional vendor**: The project is already committed to the Cloudflare platform for compute (Workers), database (D1), and frontend hosting (Pages). Adding a new vendor solely for session storage increases operational complexity.

Cloudflare KV is a globally distributed key-value store available as a Workers binding. It supports per-key TTL (`expirationTtl`), eventual consistency for global reads, and is included in the Cloudflare Workers platform with no separate account or billing tier required.

## Decision

Use Cloudflare KV (`QUIZ_KV` namespace binding) for session storage, accessed through better-auth's KV adapter.

Session tokens are written to KV with the key pattern `session:{token}` and an `expirationTtl` matching the session lifetime configured in better-auth. On each authenticated request, better-auth's session middleware reads the token from the request cookie, looks up `session:{token}` in `QUIZ_KV`, and either returns the session data or rejects the request as unauthenticated.

The KV binding is declared in `wrangler.toml` as `QUIZ_KV` and injected into better-auth via `c.env.QUIZ_KV` when initializing the auth instance inside Hono route handlers or middleware.

## Consequences

### Positive

- **POS-001**: No additional vendor, service account, or billing relationship — KV is included in the Cloudflare Workers platform already adopted for compute and database.
- **POS-002**: Native TTL support via `expirationTtl` on KV writes eliminates the need for a background job to clean up expired sessions; Cloudflare handles expiry automatically.
- **POS-003**: KV reads are served from Cloudflare's global edge cache, meaning session lookups are colocated with the Worker execution and do not incur cross-region HTTP round trips.
- **POS-004**: better-auth provides a first-class KV adapter; session storage integration does not require custom adapter code.

### Negative

- **NEG-001**: KV is eventually consistent for global reads — a session written in one region may not be immediately visible to a Worker in a different region. For the initial use case (single-user sessions on a standard network), this is acceptable; applications requiring strong session consistency (e.g., multi-device revocation with immediate global effect) would need a consistent store.
- **NEG-002**: KV has a per-key write cost and a minimum one-second TTL granularity. Session refresh operations (extending TTL on active sessions) incur a KV write per refresh, which must be considered in high-traffic scenarios.
- **NEG-003**: KV is not queryable — listing or revoking all sessions for a user requires storing an additional index key (e.g., `user-sessions:{userId}`) mapping user IDs to session tokens, adding write complexity if bulk revocation is needed.

## Alternatives Considered

### Redis (self-hosted or Upstash TCP)

- **ALT-001**: **Description**: Redis is the standard session store for web applications, providing sub-millisecond key-value reads with TTL support. Upstash offers a managed Redis service.
- **ALT-001**: **Rejection reason**: Standard Redis uses the RESP TCP protocol, which is unavailable on the Workers runtime. Upstash provides a REST HTTP API that is Workers-compatible, but it adds an external vendor dependency and an HTTP round trip to a separate service on every session lookup. Cloudflare KV is colocated with the Worker and requires no external vendor.

### Cloudflare Durable Objects

- **ALT-002**: **Description**: Durable Objects provide strongly consistent, single-instance storage with a JavaScript object API. Each Durable Object instance is a single-threaded actor with a persistent key-value storage layer.
- **ALT-002**: **Rejection reason**: Durable Objects are designed for stateful coordination — presence, collaborative editing, game lobbies. Using them as a session store would place every session read/write through a single-threaded actor, adding latency and complexity. The strong consistency they provide is not required for session lookups, and the per-request routing overhead is unjustified.

### D1 for Sessions

- **ALT-003**: **Description**: Store session tokens in a D1 table (`sessions`) with a `expires_at` timestamp column. Background cleanup or query-time filtering handles expiry.
- **ALT-003**: **Rejection reason**: SQL query overhead per session lookup adds latency to every authenticated request. TTL-based expiry requires either a scheduled Worker for cleanup or a `WHERE expires_at > now()` predicate on every read, which is more expensive than a native KV TTL. KV is the correct abstraction for key-value lookup with automatic expiry.

### Cloudflare R2

- **ALT-004**: **Description**: Cloudflare's S3-compatible object storage service.
- **ALT-004**: **Rejection reason**: R2 is designed for large binary objects (images, videos, static assets). It provides no TTL support and no key-value semantics suitable for session tokens. Wrong abstraction entirely.

## Implementation Notes

- **IMP-001**: `wrangler.toml` declares `[[kv_namespaces]]` with `binding = "QUIZ_KV"` and separate `id` values for production and preview environments. The binding name `QUIZ_KV` must match the `Bindings` interface in `apps/api/src/types.ts`.
- **IMP-002**: better-auth is initialized inside a Hono middleware or helper that receives `c.env` as a parameter, passing `c.env.QUIZ_KV` to the KV adapter. The auth instance must not be created at module load time (where `env` is unavailable) — it is constructed per-request or via a factory that accepts the env binding.
- **IMP-003**: Verify by authenticating a test user, inspecting the resulting session cookie, and confirming via `wrangler kv key get --binding QUIZ_KV "session:{token}"` that the session record exists with a non-zero TTL.

## References

- **REF-001**: [ADR-002-hono-cloudflare-workers-api.md](ADR-002-hono-cloudflare-workers-api.md) — `c.env.QUIZ_KV` binding injected through Hono context
- **REF-002**: [Cloudflare KV documentation](https://developers.cloudflare.com/kv/)
- **REF-003**: [better-auth Cloudflare Workers guide](https://www.better-auth.com/docs/integrations/cloudflare)
