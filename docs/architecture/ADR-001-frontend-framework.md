---
title: "ADR-001: Frontend Framework — Vite + React 19 + TypeScript"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-001: Frontend Framework — Vite + React 19 + TypeScript

## Context

Questify is a single-page application (quiz creation, taking, and results) hosted on Cloudflare Pages. The team needs a JavaScript framework and build tooling that supports a purely client-rendered architecture — no server-side rendering is required, as all data fetching is managed client-side. The project targets a global audience requiring fast initial load and smooth interactive transitions during quiz-taking flows.

The chosen framework must integrate with the rest of the selected stack: TanStack Router (ADR-002), TanStack Query (ADR-003), shadcn/ui (ADR-004), Zustand (ADR-005), and Better-auth client. It must also support the monorepo structure (ADR-013) where application code lives in `apps/web/` and shared packages are imported from `packages/`.

## Decision

Use Vite as the build tool and dev server, React 19 as the UI library, and TypeScript in strict mode as the language for the Questify frontend.

Vite's sub-second HMR and fast cold start keeps developer iteration tight across the monorepo. React 19 introduces `useOptimistic` and improved Suspense integration which benefits quiz-submission UX — tentative answers are shown before server confirmation, keeping the interface responsive. TypeScript strict mode, combined with TanStack Router's type-generated route tree, eliminates entire categories of runtime errors at compile time. Every library in the chosen stack (shadcn/ui, TanStack Router, TanStack Query, Zustand, Better-auth) has first-class React support.

## Consequences

### Positive

- **POS-001**: Sub-second HMR and instant cold start accelerate development iteration across the monorepo
- **POS-002**: React 19's `useOptimistic` enables fluid quiz-submission UX without blocking the UI on server round-trips
- **POS-003**: Strict TypeScript mode combined with TanStack Router's type-generated route tree eliminates entire categories of runtime errors at compile time
- **POS-004**: The entire chosen library stack (shadcn/ui, TanStack Router, TanStack Query, Better-auth client) has first-class React support — no integration shims required

### Negative

- **NEG-001**: No SSR — public quiz share pages (`/q/:shareToken`) are not server-rendered; meta tags for social sharing require a separate prerender strategy or dynamic og-tag generation at the Cloudflare Worker level
- **NEG-002**: React 19 is newer than React 18; some third-party libraries may carry incomplete React 19 compatibility at project start, requiring version pinning or patching
- **NEG-003**: SPA routing means the initial HTML shell is near-empty; users on slow connections see a blank page until the JavaScript bundle loads and hydrates

## Alternatives Considered

### Next.js 15

- **ALT-001**: **Description**: Full-stack React framework with App Router, server components, and SSR/SSG capabilities. Can deploy to Cloudflare Pages via the Next.js Cloudflare adapter.
- **ALT-001**: **Rejection reason**: Questify is a SPA on Cloudflare Pages — the SSR and server component machinery is unused complexity. The Next.js Cloudflare Pages adapter is experimental and adds deployment friction. The App Router's server component mental model conflicts with the chosen Hono + Cloudflare Workers backend (ADR-006), where all data fetching is explicit and client-initiated.

### Remix

- **ALT-002**: **Description**: A React-based framework optimized for server-side data loading, progressive enhancement, and form actions. Supports edge deployment.
- **ALT-002**: **Rejection reason**: Remix's core value proposition — server loaders and form actions — does not apply to a pure SPA where all data fetching is managed client-side by TanStack Query (ADR-003). Adopting Remix would mean fighting the framework's conventions rather than working with them.

### Vanilla Vite + Preact

- **ALT-003**: **Description**: Vite as the build tool with Preact as the rendering layer. Preact is API-compatible with React but bundles at approximately 3KB versus React 19's ~42KB.
- **ALT-003**: **Rejection reason**: React 19's concurrent features (`useOptimistic`, improved Suspense) provide concrete UX benefits for quiz flows. shadcn/ui and Better-auth client require React; using Preact would require compatibility shims or forking components. The marginal bundle size saving does not justify the ecosystem friction.

## Implementation Notes

- **IMP-001**: The Vite config lives at `apps/web/vite.config.ts`; the `@tanstack/router-plugin/vite` plugin must be registered there for file-based route generation. The `@tailwindcss/vite` plugin must also be registered for Tailwind CSS v4.
- **IMP-002**: TypeScript strict mode is defined in the root `tsconfig.json` and extended by each workspace package; all strict rules are documented in `STANDARD-typescript-strict.md`.
- **IMP-003**: Success criterion — `npm run build -w @quiz/web` completes with zero TypeScript errors and the output in `apps/web/dist/` is a valid SPA that loads in Chromium with no console errors.

## References

- **REF-001**: `ADR-002-routing.md` — TanStack Router choice depends on React as the rendering layer
- **REF-002**: `ADR-010-toolchain.md` — Biome linting and formatting applies to all TypeScript workspaces including `apps/web/`
- **REF-003**: `STANDARD-typescript-strict.md` — strict mode compiler rules enforced project-wide
