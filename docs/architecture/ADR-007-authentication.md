---
title: "ADR-007: Authentication — Better-auth"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-007: Authentication — Better-auth

## Context

Questify users must be able to create accounts, sign in, and create/manage questionnaires. The platform must support sign-in by both email and username (users choose a display name at registration). An admin role is required for quiz moderation and platform management. The auth layer must run inside Cloudflare Workers (ADR-012) — it cannot depend on an external service that adds latency or a Node.js runtime. Session state must be persistent and revocable.

## Decision

Use Better-auth, self-hosted, with the Drizzle adapter, username plugin, and admin plugin.

Better-auth is open source (MIT), fully self-hosted, and has a first-class Drizzle ORM adapter that writes session, user, account, and verification tables directly into D1 (ADR-008). The username plugin enables username-based sign-in alongside email, which is required for the Questify user model. The admin plugin provides role-based access control for quiz moderation. Better-auth exposes a standard Web Fetch handler (`auth.handler(request)`) that integrates directly with Hono (ADR-006) as a middleware. Because Better-auth is self-hosted within Cloudflare, session data never leaves the Cloudflare network.

## Consequences

### Positive

- **POS-001**: Zero per-user cost and no vendor billing risk — Better-auth is self-hosted in the existing Cloudflare account
- **POS-002**: The Drizzle adapter writes auth tables into D1, keeping all persistent data in a single database with a single schema managed by drizzle-kit migrations
- **POS-003**: Username plugin enables `signIn({ username, password })` — users do not need to remember whether they registered with email or username

### Negative

- **NEG-001**: Better-auth is a newer library (first stable release 2024) — the ecosystem of community plugins is smaller than Auth.js; edge cases may require custom implementation
- **NEG-002**: Self-hosting means the team is responsible for security updates to the Better-auth package — must monitor the repository for security advisories
- **NEG-003**: The Drizzle adapter requires Better-auth's schema tables to coexist in the same D1 database as the application tables — naming collisions must be checked during schema design (PHASE-07)

## Alternatives Considered

### Clerk

- **ALT-001**: **Description**: A fully managed auth platform with pre-built UI components
- **ALT-001**: **Rejection reason**: Vendor lock-in and pricing that scales with monthly active users creates unpredictable cost for a public quiz platform. Clerk's session model is opaque and difficult to integrate with Cloudflare Workers + D1 without using Clerk-specific adapters.

### Auth.js (NextAuth v5)

- **ALT-002**: **Description**: A popular open-source auth library with a large ecosystem of providers
- **ALT-002**: **Rejection reason**: Auth.js has Node.js dependencies (`node:crypto`) that are incompatible with the Cloudflare Workers runtime without a compatibility shim. Auth.js's primary supported deployment target is Next.js, not Hono.

### Lucia Auth

- **ALT-003**: **Description**: An open-source auth library with minimal opinions, designed to be runtime-agnostic
- **ALT-003**: **Rejection reason**: Lucia Auth was officially discontinued and archived by its maintainer in late 2024. Using an abandoned library introduces long-term maintenance and security risk.

### Custom JWT

- **ALT-004**: **Description**: A hand-rolled JWT authentication system using the Web Crypto API
- **ALT-004**: **Rejection reason**: Requires correctly implementing refresh token rotation, session invalidation, CSRF protection, and secure password hashing — all attack surfaces where implementation mistakes are costly. Better-auth handles these correctly.

## Implementation Notes

- **IMP-001**: The Better-auth server instance is created at `apps/api/src/lib/auth.ts` with the Drizzle adapter pointing to `c.env.DB` (the D1 binding); it must be re-created per-request since Workers are stateless
- **IMP-002**: Hono mounts the Better-auth handler at `app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw))`; all other auth actions (sign-in, sign-up, sign-out) route through this handler
- **IMP-003**: Success criterion — `POST /api/auth/sign-in/email` with valid credentials returns a session cookie; `GET /api/auth/session` returns the authenticated user; signing out invalidates the session in D1

## References

- **REF-001**: `ADR-006-backend-framework.md` — Better-auth handler is mounted inside Hono
- **REF-002**: `ADR-008-database-orm.md` — Drizzle adapter writes auth tables to D1
- **REF-003**: `ADR-012-deployment-platform.md` — `BETTER_AUTH_SECRET` is a Cloudflare Worker secret set via `wrangler secret put`
- **REF-004**: https://www.better-auth.com/docs/adapters/drizzle
