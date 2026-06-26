---
title: "ADR-012: Deployment Platform — Cloudflare Pages + Workers + D1"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-012: Deployment Platform — Cloudflare Pages + Workers + D1

## Context

Questify requires deployment targets for: the Vite SPA frontend (static files with client-side routing), the Hono REST API (stateless request handlers), the D1 SQLite database, and the KV cache. The deployment platform must support: zero-cold-start API responses, global CDN distribution for the frontend, environment variable and secret management, preview deployments for PRs, and a free tier suitable for a public beta.

The platform choice has long-term architectural implications because Cloudflare-native APIs (D1 bindings, KV bindings, Workers-specific globals) are not portable. The team must consciously accept the trade-off between operational simplicity and vendor lock-in.

## Decision

Cloudflare Pages for the frontend SPA, Cloudflare Workers for the API backend, Cloudflare D1 for the database, Cloudflare KV for the cache — all within a single Cloudflare account.

Cloudflare's unified platform means the frontend, backend, database, and cache all run within Cloudflare's network with no cross-provider latency. Workers have no cold start problem (unlike AWS Lambda or Vercel serverless functions) — every request is handled in under 5ms initialization time regardless of traffic patterns. The free tier for Pages, Workers, and D1 is generous enough to support a public beta. Using a single vendor reduces the blast radius of billing surprises and simplifies secret management (everything is in the Cloudflare dashboard and `wrangler.toml`).

## Consequences

### Positive

- **POS-001**: Workers have no cold starts — every quiz submission API call has consistent sub-10ms initialization time regardless of traffic patterns
- **POS-002**: Cloudflare Pages automatically creates preview deployments for every PR — the team can review UI changes on a live URL before merging
- **POS-003**: All services (Pages, Workers, D1, KV) are in one Cloudflare account — secret rotation, access control, and billing are centralized

### Negative

- **NEG-001**: Vendor lock-in — D1 bindings, KV bindings, and Workers-specific APIs make migrating away from Cloudflare non-trivial; the team accepts this trade-off given the operational simplicity
- **NEG-002**: D1 has regional consistency constraints (writes go through a primary region before replicating globally) — write-heavy operations have slightly higher latency than reads for geographically distant users
- **NEG-003**: Workers have a 1MB compressed bundle size limit — if the Hono app grows with many dependencies, bundle splitting or tree-shaking must be carefully managed

## Alternatives Considered

### Vercel (frontend) + PlanetScale (database)

- **ALT-001**: **Description**: Vercel for the React SPA and serverless functions, PlanetScale as the MySQL-compatible serverless database
- **ALT-001**: **Rejection reason**: Splits the platform across two vendors with separate pricing, billing, and credential management. Vercel's serverless function execution time limit is 10 seconds on the free tier — insufficient for heavy quiz scoring jobs.

### AWS (S3 + CloudFront + Lambda + RDS)

- **ALT-002**: **Description**: AWS-native stack: S3 + CloudFront for the SPA, Lambda for the API, RDS for the database
- **ALT-002**: **Rejection reason**: Maximum flexibility but extreme operational overhead. Provisioning IAM policies, VPC configurations, and RDS instances is not justified for a small team at this stage.

### Fly.io + Turso

- **ALT-003**: **Description**: Fly.io persistent VMs for the API backend, Turso (libSQL/SQLite edge database) for data storage
- **ALT-003**: **Rejection reason**: Fly.io provides persistent VMs rather than serverless functions, adding container management complexity. Rejected in favour of Cloudflare's fully serverless model.

### Railway

- **ALT-004**: **Description**: A simple deploy platform popular for Node.js applications
- **ALT-004**: **Rejection reason**: Railway does not support Cloudflare Workers or D1 — the entire stack would need to change to Node.js + PostgreSQL, abandoning the Workers-native architecture.

## Implementation Notes

- **IMP-001**: `apps/api/wrangler.toml` defines D1 binding (`QUIZ_DB`), KV binding (`QUIZ_CACHE`), and Worker name; `wrangler dev` starts a local dev server with Miniflare emulating D1 and KV
- **IMP-002**: `apps/web` is deployed to Cloudflare Pages via the `wrangler pages deploy` command or GitHub Actions integration; the build output is `apps/web/dist/`; a `_redirects` file routes all 404s to `index.html` for SPA client-side routing
- **IMP-003**: Success criterion — `wrangler deploy` in CI deploys the Worker without errors; Cloudflare Pages deploys the frontend on merge to `main`; `GET /api/health` returns `200` from the production URL

## References

- **REF-001**: `ADR-006-backend-framework.md` — Hono Workers are the API layer deployed here
- **REF-002**: `ADR-008-database-orm.md` — D1 is the database deployed here
- **REF-003**: `ADR-009-caching-strategy.md` — KV is the cache deployed here
- **REF-004**: https://developers.cloudflare.com/workers/
- **REF-005**: https://developers.cloudflare.com/pages/
