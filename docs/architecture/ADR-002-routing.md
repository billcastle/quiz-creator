---
title: "ADR-002: Client-Side Routing — TanStack Router"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-002: Client-Side Routing — TanStack Router

## Context

React 19 (ADR-001) does not ship a built-in router. Questify requires nested layouts (authenticated shell, quiz builder layout, public quiz-taking layout), type-safe route parameters (quiz ID, share token, question index), and deep integration with TanStack Query (ADR-003) so that route loaders can pre-warm the query cache before the component renders. URL-driven state — active feed filters, pagination, search query — must be fully typed and validated without manual type declarations.

The router is one of the most foundational dependencies in the frontend. A router that lacks type safety or loader primitives forces boilerplate workarounds throughout the codebase; a router that integrates cleanly with the query cache eliminates a large category of loading-state complexity.

## Decision

Use TanStack Router v1 with the Vite plugin for file-based route generation.

TanStack Router generates a fully-inferred TypeScript route tree at build time via the `@tanstack/router-plugin/vite` Vite plugin. Every route param, search param, and loader result is typed without manual declarations — navigating to `/builder/$id` with a non-string `id` is a build error, not a runtime bug. The built-in `loader` function accepts a `context` object pre-populated with the `QueryClient`, enabling loaders to call `queryClient.ensureQueryData(...)` to warm the cache before the component mounts. Search param schemas defined with Zod (via `@tanstack/zod-adapter`) give validated, typed URL state for quiz feed filters.

## Consequences

### Positive

- **POS-001**: Route params and search params are compile-time typed — the generated `routeTree.gen.ts` makes incorrect navigation a build failure, not a runtime bug
- **POS-002**: Route loaders integrate directly with TanStack Query via `context.queryClient.ensureQueryData()`, eliminating loading spinners on route entry for data that can be pre-fetched
- **POS-003**: Built-in scroll restoration, pending navigation UI state, and error boundary support reduce boilerplate for the quiz navigation UX

### Negative

- **NEG-001**: The auto-generated `routeTree.gen.ts` file must be committed to the repository; contributors must run the Vite dev server or build once to generate it before TypeScript will compile
- **NEG-002**: TanStack Router's file-based routing conventions (`$param` segments, flat file names in `routes/`) differ from Next.js page conventions — onboarding developers familiar with Next.js has a learning curve
- **NEG-003**: Search param Zod integration requires installing `@tanstack/zod-adapter` as an additional dependency; this is a small but explicit coupling between the router and Zod

## Alternatives Considered

### React Router v7

- **ALT-001**: **Description**: The dominant React router by ecosystem adoption. v7 introduced typed routes via a route manifest, providing compile-time safety for route params.
- **ALT-001**: **Rejection reason**: React Router v7's typed params require a manual route manifest or `Route.LoaderData` generics that are more verbose than TanStack Router's fully inferred tree. The `loader` API does not accept a `QueryClient` context natively — pre-warming the TanStack Query cache from a React Router loader requires a workaround (module-level singleton or React context bridging). TanStack Router's tighter integration with TanStack Query is a decisive advantage.

### Wouter

- **ALT-002**: **Description**: A minimal (~2KB) client-side router for React with a `useLocation` / `useRoute` API.
- **ALT-002**: **Rejection reason**: Wouter provides no loader primitives, no nested layout support, no search param validation, and no data pre-fetching integration. Building these features from scratch for the quiz flow would re-implement the core of TanStack Router without the benefit of its maintained, tested implementation.

## Implementation Notes

- **IMP-001**: Route files live in `apps/web/src/routes/`; the Vite plugin auto-generates `apps/web/src/routeTree.gen.ts` on every file save — this file must be committed but must never be hand-edited
- **IMP-002**: The router's `context` must be typed as `{ queryClient: QueryClient }` and the `QueryClient` instance must be created once at the app root and passed to `RouterProvider`; it must not be recreated on re-renders
- **IMP-003**: Success criterion — navigating to a route with a param of the wrong type produces a TypeScript error at build time; the `routeTree.gen.ts` file exists and is committed in the initial scaffold

## References

- **REF-001**: `ADR-001-frontend-framework.md` — React 19 is required for TanStack Router
- **REF-002**: `ADR-003-server-state.md` — TanStack Query and TanStack Router loaders are designed to compose via `queryClient.ensureQueryData()`
- **REF-003**: https://tanstack.com/router/latest
