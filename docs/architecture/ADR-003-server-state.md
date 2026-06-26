---
title: "ADR-003: Server State Management — TanStack Query"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-003: Server State Management — TanStack Query

## Context

Questify's UI is entirely data-driven: the homepage feed fetches quiz listings, the builder loads draft state from the API, the quiz-taking flow reads questionnaire data, and the results page retrieves scores and leaderboard positions. All of this data originates from the Hono API (ADR-006) and must be cached client-side to avoid redundant network requests on navigation.

Mutations — submitting a quiz response, publishing a draft, saving builder changes — must support optimistic updates to keep the UI responsive under variable network conditions. The server state layer must also integrate cleanly with TanStack Router (ADR-002) so that route loaders can pre-warm the cache before a component mounts, eliminating loading spinners on route entry.

Client state that does not originate from the API (UI toggles, session progress, unsaved builder fields) is explicitly out of scope for this ADR — that concern is addressed in ADR-005 (Zustand).

## Decision

Use TanStack Query v5 (React Query) for all server state — fetching, caching, background refetching, and mutations.

TanStack Query's stale-while-revalidate strategy serves cached data immediately while refetching in the background — users never block on a network round-trip when data is available in cache. The `useMutation` API with `onMutate`/`onError`/`onSettled` callbacks enables optimistic UI for quiz submission: the next question is shown immediately, with the server confirmation completing asynchronously. TanStack Router loaders call `queryClient.ensureQueryData()` to warm the cache before the route renders, so navigating to a quiz detail page shows data instantly on return visits.

## Consequences

### Positive

- **POS-001**: Stale-while-revalidate means the quiz feed and builder load instantly from cache — no loading spinner on return navigation within the same session
- **POS-002**: Optimistic mutation with automatic rollback on error enables fluid quiz submission without blocking the UI on network latency
- **POS-003**: Automatic background refetch on window focus and network reconnect keeps quiz data fresh without manual polling code

### Negative

- **NEG-001**: Query key management requires discipline — a poorly named or incorrectly structured key causes stale cache bugs that are hard to diagnose; a project-wide naming convention must be established and documented in `STANDARD-api-response-shape.md`
- **NEG-002**: TanStack Query v5 changed its API from v4 (the `useQuery` options object is now required; the positional overload is removed); most community tutorials reference the v4 API, which can mislead developers new to the project
- **NEG-003**: Optimistic update logic adds complexity — rollback handlers must be tested for edge cases (concurrent mutations, partial failures), and this testing overhead must be budgeted when building the quiz submission flow

## Alternatives Considered

### SWR

- **ALT-001**: **Description**: Vercel's stale-while-revalidate library. Lighter than TanStack Query with a simpler `useSWR(key, fetcher)` API.
- **ALT-001**: **Rejection reason**: SWR's mutation support (`useSWRMutation`) does not provide an `onMutate` callback for optimistic updates — the rollback pattern must be implemented manually. SWR also lacks dependent query support and the TanStack Router loader integration that makes cache pre-warming ergonomic. For Questify's quiz submission UX, the full mutation lifecycle (`onMutate` / `onError` / `onSettled`) is a hard requirement.

### RTK Query (Redux Toolkit)

- **ALT-002**: **Description**: Redux Toolkit's built-in server state layer. Provides caching, invalidation, and optimistic updates as part of the Redux ecosystem.
- **ALT-002**: **Rejection reason**: RTK Query requires adopting Redux as a dependency. Questify's client state needs are modest and are covered by Zustand (ADR-005) without Redux overhead. Mixing RTK Query for server state and Zustand for client state would create two competing paradigms with no shared abstraction. The Redux DevTools provide time-travel debugging, but TanStack Query's dedicated DevTools browser extension provides equivalent cache introspection for server state.

### Apollo Client

- **ALT-003**: **Description**: A full-featured GraphQL client with caching, mutations, subscriptions, and optimistic UI.
- **ALT-003**: **Rejection reason**: The Questify backend is a REST API over Hono (ADR-006), not a GraphQL endpoint. Apollo Client is not applicable to a REST data layer.

## Implementation Notes

- **IMP-001**: The `QueryClient` is created once at the app root (`apps/web/src/main.tsx`) and passed to both `QueryClientProvider` and `RouterProvider` as context; it must not be instantiated inside a component function where it would be recreated on re-renders
- **IMP-002**: Query key factories must be defined in `packages/shared/src/query-keys.ts` and imported by all consumers; the naming convention (domain-prefixed tuples) is specified in `STANDARD-api-response-shape.md`
- **IMP-003**: Success criterion — the homepage quiz feed loads from cache with no network request (Chrome DevTools Network tab shows no duplicate requests) on second visit within the same session; a mutation failure on the quiz submission flow triggers an automatic rollback and displays an error state without corrupting the cache

## References

- **REF-001**: `ADR-002-routing.md` — TanStack Router loaders call `queryClient.ensureQueryData()` to pre-warm the cache on route entry
- **REF-002**: `ADR-005-client-state.md` — Zustand holds client UI state; TanStack Query holds server state; these two stores must not overlap
- **REF-003**: `STANDARD-api-response-shape.md` — query key naming convention and `data` envelope unwrapping pattern
- **REF-004**: https://tanstack.com/query/latest
