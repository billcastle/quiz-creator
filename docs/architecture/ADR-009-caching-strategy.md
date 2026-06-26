---
title: "ADR-009: Caching Strategy — Cloudflare KV (Primary)"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-009: Caching Strategy — Cloudflare KV (Primary)

## Context

Certain API responses in Questify are read-heavy and infrequently mutated: the homepage quiz feed (list of public questionnaires), individual questionnaire metadata for the share page (`/q/:shareToken`), and category/tag listings. Fetching these from D1 on every request adds unnecessary latency and D1 read cost. A cache layer is needed to serve these responses at edge speed.

## Decision

Use Cloudflare KV as the primary distributed cache layer for read-heavy, infrequently mutated data.

Cloudflare KV is globally replicated to 200+ Cloudflare edge locations. KV reads from a Worker return in sub-millisecond time from the nearest edge node — cache hits are essentially free. KV's eventual consistency model (writes propagate globally within ~60 seconds) is acceptable for the Questify use cases — slight staleness in a quiz feed or category listing is not a correctness problem. KV uses a simple key-value model with configurable TTL, which maps cleanly to the Questify caching use cases (cache by questionnaire ID, by share token, by category slug).

Upstash Redis is documented as the upgrade path for use cases that require sorted sets (leaderboard ranking), atomic counters (live quiz concurrent users), or pub/sub (future live quiz rooms). Upstash is HTTP-based and Workers-compatible. This is not an initial dependency — it is noted here so the team understands the path when D1 + KV is insufficient.

## Consequences

### Positive

- **POS-001**: KV cache hits return in sub-millisecond time from the nearest Cloudflare edge — the quiz feed loads as fast as a static asset for cached responses
- **POS-002**: Reducing D1 reads for the quiz feed significantly lowers D1 compute costs and reduces contention on the D1 database under load
- **POS-003**: KV's TTL-based expiry eliminates the need for explicit cache invalidation on time-based staleness — quiz feed TTL of 60s means stale data is never more than 1 minute old

### Negative

- **NEG-001**: KV is eventually consistent — a newly published quiz may not appear in the cached feed for up to 60 seconds after publication; the publisher sees the quiz immediately (direct D1 read) but other users may not
- **NEG-002**: KV cache invalidation on mutation must be explicit — when a quiz is updated or deleted, the cache key must be explicitly purged via `KV.delete(key)`; forgetting to purge causes stale reads
- **NEG-003**: KV keys must follow a documented naming convention to avoid namespace collisions and enable targeted invalidation; undisciplined key naming creates unmaintainable cache state

## Alternatives Considered

### Worker-local in-memory cache

- **ALT-001**: **Description**: A module-scope `Map` or object inside the Worker module used as a request-scoped or process-scoped cache
- **ALT-001**: **Rejection reason**: Workers are stateless and may run on many edge nodes simultaneously. A Worker-local cache is not shared across instances and resets on every deployment — not suitable for application-level caching.

### External Redis (self-hosted)

- **ALT-002**: **Description**: A Redis instance hosted outside Cloudflare (e.g., on Fly.io or a VPS)
- **ALT-002**: **Rejection reason**: A Worker making a round-trip to a remote data centre adds 20–100ms of latency, defeating the purpose of edge computing. KV reads from within the same Cloudflare network are sub-millisecond.

### Cloudflare Cache API

- **ALT-003**: **Description**: Cloudflare's `caches` API, which caches full HTTP responses at the edge
- **ALT-003**: **Rejection reason**: Operates on full HTTP Request/Response objects — not suitable for caching arbitrary data structures or API response fragments. More appropriate for caching full page renders.

### Cloudflare Durable Objects

- **ALT-004**: **Description**: Stateful Cloudflare primitives that can serve as a strongly consistent cache or coordination layer
- **ALT-004**: **Rejection reason**: Much more powerful than KV but adds significant architectural complexity (Durable Object classes, hibernation, WebSocket support). KV is sufficient for the simple key-value caching use cases in Phase 1.

## Implementation Notes

- **IMP-001**: The KV namespace is bound in `wrangler.toml` as `QUIZ_CACHE: KVNamespace`; it is accessed in Hono handlers via `c.env.QUIZ_CACHE`
- **IMP-002**: Cache key convention: `feed:public:page:{n}`, `questionnaire:{id}`, `category:{slug}` — all keys are prefixed by resource type for targeted invalidation
- **IMP-003**: Success criterion — a cold GET to `/api/questionnaires/feed` takes <200ms (D1 read + KV write); subsequent requests within the TTL window take <20ms (KV read); after a questionnaire is published, `KV.delete('feed:public:page:1')` is called to invalidate the first page

## References

- **REF-001**: `ADR-006-backend-framework.md` — KV is accessed via `c.env.QUIZ_CACHE` in Hono context
- **REF-002**: `ADR-008-database-orm.md` — D1 is the source of truth; KV is the cache layer
- **REF-003**: `ADR-012-deployment-platform.md` — KV namespace created and bound via Cloudflare dashboard and `wrangler.toml`
- **REF-004**: https://developers.cloudflare.com/kv/
