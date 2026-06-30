---
title: "ADR-010: Pathless Layout Route Groups"
status: "Accepted"
date: "2026-06-30"
authors: "Questify Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-010: Pathless Layout Route Groups

## Context

Questify has three distinct user experiences — creator (authenticated), auth (sign-in/up), and taker — each with different chrome, auth requirements, and visual structure. The route tree must enforce these layout boundaries without contaminating URLs with segment prefixes such as `/app/` or `/auth/`. TanStack Router was already chosen (ADR-003); the question is how to organise the tree to achieve layout isolation without URL pollution.

## Decision

All layout boundaries in the route tree are expressed as pathless layout routes: `createRoute` calls that supply `id` but no `path`. These routes render a layout shell that wraps an `<Outlet />`. Page routes are children of the pathless route that owns their layout. The three groups are: `_authenticated` (creator shell + auth guard), `_unauthenticated` (bare centered layout), and `_take` (isolated taker shell with no creator nav).

The `_authenticated` group uses a `beforeLoad` hook to enforce the auth guard in a single place. This hook currently reads the auth stub (replaced by Better Auth in QZ-0004).

## Consequences

### Positive

- **POS-001**: Layout boundaries are visible and enforced at the route-tree level — no conditional rendering of chrome inside individual page components.
- **POS-002**: URL paths remain clean and meaningful (`/questionnaire/$id`, not `/app/questionnaire/$id`); bookmarks and external links are stable.
- **POS-003**: Auth guard lives in exactly one `beforeLoad` on `_authenticated`; no per-page guard duplication.
- **POS-004**: Adding a new page to an existing layout requires only a child route in the correct group — zero layout code changes.

### Negative

- **NEG-001**: Pathless routes are a less commonly known TanStack Router feature; developers unfamiliar with the `id`-only pattern may not understand why some routes have no `path`.
- **NEG-002**: Nesting a page route under the wrong group is silent at compile time and only visible at runtime.
- **NEG-003**: All routes live in a single `apps/web/src/router.tsx`; the file grows as the route count grows.

## Alternatives Considered

### URL-prefix grouping (`/app/*`, `/auth/*`, `/take/*`)

- **ALT-001**: **Description**: Each layout group is given a URL segment prefix — the React Router v5 convention.
- **ALT-001**: **Rejection reason**: Leaks internal architecture into public URLs, breaks bookmarks if the prefix is renamed, and is unnecessary given TanStack Router's `id`-only route support.

### Conditional chrome in a single root layout

- **ALT-002**: **Description**: A single root layout reads `location.pathname` and conditionally renders TopNav/SideNav based on the current route.
- **ALT-002**: **Rejection reason**: Conflates three distinct layout responsibilities into one component, moves the auth guard out of the router and into render logic, and makes layout-level data loading impossible.

### Per-page layout wrapping

- **ALT-003**: **Description**: Each page component imports and wraps itself in the appropriate layout.
- **ALT-003**: **Rejection reason**: Duplicates layout rendering, makes the auth guard per-page (instead of per-group), and bloats every page component with layout concerns it should not own.

## Implementation Notes

- **IMP-001**: Pathless route IDs use a `_` prefix convention (`_authenticated`, `_unauthenticated`, `_take`) to visually distinguish them from path routes in the route tree.
- **IMP-002**: The `_authenticated` group's `beforeLoad` is the only place auth checks live. When QZ-0004 ships, only this hook changes — no page components are touched.
- **IMP-003**: Route tree is defined in `apps/web/src/router.tsx`. Verify by navigating to a protected route without auth and confirming the redirect to `/sign-in`.

## References

- **REF-001**: [ADR-003-tanstack-router.md](ADR-003-tanstack-router.md) — TanStack Router adoption decision
- **REF-002**: [PATTERN-navigation-callback-props.md](PATTERN-navigation-callback-props.md) — how layout components receive navigation without importing the router
- **REF-003**: [TanStack Router — Layout Routes](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layout-routes)
