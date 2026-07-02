---
title: "ADR-011: Short URL Scheme for Questionnaires"
status: "Accepted"
date: "2026-07-01"
authors: "billcastle_bose"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-011: Short URL Scheme for Questionnaires

## Context

Questionnaires were previously identified in user-facing URLs by their full UUID (36-character strings such as `550e8400-e29b-41d4-a716-446655440000`). This created several problems:

- URLs were too long to share verbally or in print.
- The UUID provides no human-readable signal about the quiz content.
- Editing a quiz title had no effect on the URL, meaning the URL never reflected what a user was about to see.

The project needed a URL design that: is short enough for practical sharing, carries a readable hint about the quiz topic, keeps the UUID as the stable primary key, and avoids reliance on title uniqueness (titles are not globally unique across users).

Constraints:

- UUID is already the primary key in all foreign-key relationships — changing it would require cascading migrations across questions, options, submissions, etc.
- Slugs derived from titles are not globally unique and change when a user edits a title.
- Share links must remain valid even after a title (and therefore slug) changes.

## Decision

Add two new columns to the `questionnaires` table:

1. `shortId text unique` — an 8-character alphanumeric identifier generated via `nanoid(8)` at row creation. Never changes after creation.
2. `slug text default ''` — a URL-safe version of the title, regenerated via `toSlug(title)` on every create and update.

Adopt the following URL structure:

| Route | Purpose |
|---|---|
| `/quiz/:shortId/edit` | Builder (authenticated) |
| `/quiz/:shortId/:slug` | Take page (canonical, public) |
| `/quiz/:shortId` | Redirect to canonical take URL |

The shortId-only URL (`/quiz/:shortId`) is resolved by a public, unauthenticated `GET /api/q/:shortId` endpoint that returns `{ shortId, slug }`. The client-side `QuizShortUrlPage` fetches from that endpoint and redirects to `/quiz/:shortId/:slug`. This keeps share links permanently valid: even if the slug changes, the shortId redirect always resolves to the current canonical form.

The UUID remains the primary key and is never exposed in user-facing URLs. The questionnaires API (`GET /api/questionnaires/:id`) accepts both UUID and shortId so internal consumers that still pass UUIDs continue to work.

## Consequences

### Positive

- Share URLs shrink from 36+ opaque UUID characters to 8 characters plus a readable slug (e.g., `/quiz/aB3xKp7q/intro-to-calculus`).
- Slug changes do not break existing share links — the shortId redirect always resolves to the current slug.
- UUID remains the primary key; no foreign-key migrations required.
- `shortId` uniqueness is enforced at the database level via a `unique` constraint.
- The public redirect endpoint is stateless and safe to cache at the edge.

### Negative

- Two additional columns must be maintained: `shortId` needs a unique index; `slug` must be kept in sync on every write.
- Questionnaires created before migration 0004 have no `shortId` and require a backfill to use the new URL scheme.
- No collision-retry loop is implemented for `nanoid(8)` generation; a collision causes an insert failure rather than a graceful retry.
- Client-side redirect for shortId-only links adds one extra round-trip compared to a direct canonical URL.

## Alternatives Considered

**Keep UUID in URLs** — Rejected. 36-character UUIDs are unreadable and impractical to share outside digital copy-paste contexts.

**Slug-only URLs (`/quiz/intro-to-calculus`)** — Rejected. Slugs are not globally unique. Enforcing uniqueness would require per-user namespacing or collision suffixes (e.g., `-2`), and editing a title would silently break all existing share links.

**Expose UUID as shortId with no separate column** — Rejected. Does not solve the length or readability problem, and collapses the distinction between the internal primary key and the public identifier.

**Server-side redirect for `/quiz/:shortId`** — Considered but rejected for the current SPA architecture. All routing lives in TanStack Router; adding a server-side rewrite for one path would require special-casing in the Cloudflare Workers or Pages config. Client-side redirect via `QuizShortUrlPage` keeps all routing logic within the SPA.

## Implementation Notes

- Migration: `0004_smart_pandemic.sql` adds `shortId text unique` and `slug text default ''` to `questionnaires`.
- `nanoid(8)` is called once per `POST /api/questionnaires`; the value is never regenerated.
- `toSlug(title)` is called on every create and PUT; the `slug` column is not user-editable.
- `GET /api/q/:shortId` is the only endpoint `QuizShortUrlPage.tsx` calls before redirecting.
- Existing questionnaires without a `shortId` return 404 from `GET /api/q/:shortId` until backfilled.
