---
phase: 01
title: "Tech Stack Selection & ADRs"
status: pending
depends_on: []
estimated_tickets: 4
---

# Phase 01 — Tech Stack Selection & Architecture Decision Records

## Overview

Phase 01 is a documentation-only phase. No application code, configuration files, package manifests, or CI pipelines are created during this phase. The sole output is a set of Architecture Decision Records (ADRs) and Coding Standards documents that will govern every subsequent phase of the Questify (Quiz Creator v2) project.

The purpose of front-loading these decisions is to eliminate ambiguity before implementation begins. Each ADR captures the decision made, the alternatives that were evaluated, and the rationale for the chosen approach. This creates a permanent record that future contributors — human or AI agent — can consult to understand why the project is structured the way it is. ADRs are immutable once approved; if a decision must be revisited, a superseding ADR is written rather than the original being edited.

The four STANDARD documents produced alongside the ADRs define cross-cutting coding rules that apply project-wide. Unlike ADRs (which capture point-in-time decisions), STANDARDs are living documents that may receive minor clarifications as edge cases are discovered during implementation. All agents working on the Questify codebase are expected to read and apply these standards before writing any code.

---

## Goals

The following artifacts must be produced and reviewed by the Architect before this phase is considered complete.

### Architecture Decision Records (ADRs)

- [ ] ADR-001: Frontend Framework (Vite + React 19 + TypeScript)
- [ ] ADR-002: Routing (TanStack Router)
- [ ] ADR-003: Server State Management (TanStack Query)
- [ ] ADR-004: UI Component Library (shadcn/ui Maia variant + Tailwind CSS v4)
- [ ] ADR-005: Client State Management (Zustand)
- [ ] ADR-006: Backend Framework (Hono + Cloudflare Workers)
- [ ] ADR-007: Authentication (Better-auth)
- [ ] ADR-008: Database & ORM (Drizzle ORM + Cloudflare D1)
- [ ] ADR-009: Caching Strategy (Cloudflare KV + Upstash Redis fallback)
- [ ] ADR-010: Toolchain (npm workspaces + Biome)
- [ ] ADR-011: Testing Strategy (Playwright E2E — Phase 1 scope)
- [ ] ADR-012: Deployment Platform (Cloudflare Pages + Workers + D1)
- [ ] ADR-013: Monorepo Structure (npm workspaces, apps/ + packages/ layout)

### Coding Standards

- [ ] STANDARD-typescript-strict
- [ ] STANDARD-api-response-shape
- [ ] STANDARD-zod-validation
- [ ] STANDARD-component-naming

---

## Architecture Decisions Required

This IS the ADR phase. The decisions documented here are not preliminary notes — they are the output artifacts of this phase. Each ADR file written during Phase 01 becomes an authoritative record that downstream phases treat as settled. The Architect is responsible for authoring each ADR file and confirming that the rationale is complete enough that a new team member (or AI agent with no prior context) could understand the decision without asking follow-up questions.

---

## Technical Architecture

### ADR-001: Frontend Framework — Vite + React 19 + TypeScript

**Decision Being Made:** Which JavaScript framework and build tooling will be used for the Questify web application frontend.

**Chosen Approach:** Vite as the build tool and dev server, React 19 as the UI library, TypeScript in strict mode as the language.

**Key Alternatives Considered:**

- **Next.js 15:** Rejected. Next.js is optimized for server-side rendering and hybrid rendering models. Questify is a single-page application hosted on Cloudflare Pages. The SSR plumbing that Next.js adds would be unused complexity. Next.js also has deeper coupling to Vercel's infrastructure; deploying to Cloudflare Pages without Next.js-specific adapters is possible but adds friction. The App Router's server component model adds conceptual overhead that is not justified for a client-rendered SPA.
- **Remix:** Rejected for the same class of reasons as Next.js. Remix's strength is server-side data loading, progressive enhancement, and form actions. None of these patterns fit the Questify use case where all data fetching is managed client-side by TanStack Query.
- **Vanilla Vite + Preact:** Considered for bundle size. Rejected because React 19's concurrent features (Transitions, Suspense, `useOptimistic`) provide concrete UX benefits for quiz-taking flows, and the ecosystem compatibility of React outweighs the marginal bundle savings.

**Rationale:** Vite's build speed (sub-second HMR, fast cold starts) keeps developer iteration tight. React 19 introduces `useOptimistic` and improved Suspense integration which will benefit the quiz-taking and real-time scoring flows in later phases. TypeScript strict mode, combined with TanStack Router's type-safe routing, eliminates entire categories of runtime errors at compile time.

---

### ADR-002: Routing — TanStack Router

**Decision Being Made:** Which client-side routing library will handle URL management, route-level data loading, and navigation for the Questify SPA.

**Chosen Approach:** TanStack Router v1 with the Vite plugin for file-based route generation.

**Key Alternatives Considered:**

- **React Router v7:** The dominant option by ecosystem share. Rejected because its type safety for route params and search params requires manual type assertions or third-party wrappers. TanStack Router generates fully inferred TypeScript types for every route, param, and search param automatically, which eliminates a class of bugs that React Router cannot prevent at compile time.
- **Wouter:** A minimal (~2KB) router that covers basic hash and history routing. Rejected because it provides no data loading primitives, no search param type safety, and no route preloading. Questify's quiz flow requires nested layouts and loader-driven data fetching; Wouter would require building these patterns from scratch.

**Rationale:** TanStack Router's 100% type-safe route tree means that navigating to a route with incorrect params is a compile error, not a runtime surprise. The built-in `loader` pattern integrates cleanly with TanStack Query's cache (loaders can `ensureQueryData`, ensuring the cache is warm before the component renders). First-class search param support with Zod validation means filter and pagination state in the URL is fully typed and validated.

---

### ADR-003: Server State Management — TanStack Query

**Decision Being Made:** How the frontend application will fetch, cache, and synchronize server data (quiz lists, user profiles, scores, etc.).

**Chosen Approach:** TanStack Query v5 (React Query) for all server state — fetching, caching, background refetching, and mutations.

**Key Alternatives Considered:**

- **SWR:** Vercel's stale-while-revalidate library. Lighter than TanStack Query but lacks mutation management, dependent queries, infinite queries, and the Devtools panel. TanStack Query's mutation patterns (`onMutate`, `onError`, `onSettled` with optimistic rollback) are essential for the quiz submission flow.
- **RTK Query (Redux Toolkit):** A capable server-state solution that ships with Redux Toolkit. Rejected because it requires adopting Redux as a dependency, and Questify's client state needs are modest enough that Zustand covers them without the Redux overhead. Mixing RTK Query and Zustand would result in two competing state paradigms.
- **Apollo Client:** Considered only briefly since the backend is a REST/RPC API over Hono, not a GraphQL endpoint. Not applicable.

**Rationale:** TanStack Query's stale-while-revalidate cache strategy means the UI never blocks on a network request when cached data is available — it shows cached data immediately and refetches in the background. Optimistic updates via `useMutation` with rollback capability are critical for a fluid quiz-taking experience. The Devtools browser extension provides cache inspection during development. TanStack Query and TanStack Router are designed to compose with each other (loaders calling `queryClient.ensureQueryData`), making them a natural pairing.

---

### ADR-004: UI Component Library — shadcn/ui (Maia Style Variant) + Tailwind CSS v4

**Decision Being Made:** How UI components will be sourced, styled, and maintained across the Questify frontend.

**Chosen Approach:** shadcn/ui with the Maia style variant as the component foundation, Tailwind CSS v4 for utility-first styling.

**Key Alternatives Considered:**

- **Radix UI alone (unstyled):** Radix UI provides the accessible primitives that shadcn/ui wraps. Using Radix directly without shadcn's styling layer would require writing all visual styles from scratch. Rejected because shadcn/ui accelerates initial component setup without sacrificing customization.
- **Material UI (MUI):** A complete design system with opinionated visual defaults. Rejected because MUI's styling system (Emotion/styled-components) conflicts with the Tailwind-first approach, and MUI's component API often requires significant overrides to achieve a custom design aesthetic. The "Google Material" look does not fit the Questify brand direction.
- **Chakra UI:** Similar category to MUI — a full design system with runtime CSS-in-JS. Rejected for the same reasons: conflicts with Tailwind CSS v4, and the runtime styling overhead is unnecessary given Tailwind's static extraction.

**Rationale:** shadcn/ui's defining characteristic is that components are copied into the project repository, not imported from a versioned npm package. This means the team has full ownership of every component's markup and styles, with no risk of a breaking upstream update. The Maia style variant provides a clean, minimal aesthetic that suits an educational quiz application. Tailwind CSS v4's CSS-first configuration (using `@theme` in CSS rather than `tailwind.config.js`) reduces config file proliferation and aligns with the direction of the framework.

---

### ADR-005: Client State Management — Zustand

**Decision Being Made:** How ephemeral, UI-local, and cross-component client state (modal open/close, active quiz session state, user preferences not yet persisted) will be managed.

**Chosen Approach:** Zustand for all client-side global state that does not originate from the server.

**Key Alternatives Considered:**

- **Redux Toolkit:** The industry standard for complex client state. Rejected for Questify because the client state surface area is modest — quiz session progress, UI toggle states, and a few user preferences. Redux Toolkit's slice/reducer/action pattern is well-suited for large, complex state graphs; for Questify it would be over-engineering with significant boilerplate cost.
- **Jotai:** An atomic state library that composes well with React. Considered seriously. Rejected because Jotai's atom-per-value model becomes difficult to trace when atoms derive from other atoms in a quiz session flow. Zustand's single-store-per-domain model is easier for AI agents to reason about and extend.
- **React Context API:** Rejected as the primary solution because Context causes full subtree re-renders on any state change, which creates performance issues at scale (e.g., a quiz session store with a timer that ticks every second would re-render every consumer).

**Rationale:** Zustand has minimal boilerplate (a single `create()` call defines a store), is TypeScript-first without additional type gymnastics, and integrates cleanly alongside TanStack Query (server state lives in Query's cache; client state lives in Zustand stores — clear separation of concerns). Zustand stores are also easy to persist to `localStorage` using the built-in `persist` middleware.

---

### ADR-006: Backend Framework — Hono + Cloudflare Workers

**Decision Being Made:** Which HTTP framework and runtime will power the Questify API.

**Chosen Approach:** Hono as the HTTP framework, deployed as Cloudflare Workers.

**Key Alternatives Considered:**

- **Express.js:** The most widely used Node.js HTTP framework. Rejected because Express is not edge-native. It cannot run inside a Cloudflare Worker without a compatibility layer, and even with that layer it carries Node.js assumptions (file system access, native modules) that conflict with the Workers runtime model.
- **Fastify:** A high-performance Node.js framework. Rejected for the same reasons as Express — not Workers-compatible out of the box and carries Node.js runtime assumptions.
- **Plain `fetch` handler:** Cloudflare Workers can be written as a single exported `fetch` function with manual routing. Rejected because it provides no middleware composition, no validation layer, and no structured error handling — all of which would need to be re-implemented from scratch.
- **itty-router:** A lightweight Workers-compatible router. Considered but rejected in favour of Hono because Hono has a richer middleware ecosystem, typed context, and first-class Zod validation integration via `@hono/zod-validator`.

**Rationale:** Hono is designed to run natively in any Web Standards-compatible runtime, including Cloudflare Workers. Its bundle size is tiny (under 14KB), which is important for Workers where bundle size affects startup performance. Hono's middleware system is composable and typed — adding authentication, CORS, rate limiting, and logging as middleware is idiomatic. The `c.var` typed context system means downstream handlers can safely access middleware-injected values (like the authenticated user) without type assertions.

---

### ADR-007: Authentication — Better-auth

**Decision Being Made:** How Questify users will authenticate, how sessions will be managed, and which user management features (username-based login, admin roles) will be supported.

**Chosen Approach:** Better-auth, self-hosted, with the Drizzle adapter, username plugin, and admin plugin.

**Key Alternatives Considered:**

- **Clerk:** A fully managed auth platform with excellent developer UX. Rejected primarily due to vendor lock-in and pricing. Clerk's pricing scales with monthly active users, which is unpredictable for a public quiz application. Additionally, Clerk's session management is opaque; integrating it with Cloudflare Workers and D1 requires their specific SDK patterns that would be difficult to migrate away from later.
- **Auth0:** Similar category to Clerk. Rejected for cost and vendor lock-in reasons. Auth0's free tier is restrictive, and the self-hosting story for Auth0 (the community edition) is complex.
- **Lucia Auth:** An open-source auth library with minimal opinions. Considered seriously. Rejected because Lucia has been officially discontinued by its maintainer. Using a discontinued library introduces long-term maintenance risk.
- **Custom JWT:** Rolling a custom JWT-based auth system. Rejected because it requires implementing refresh token rotation, session invalidation, CSRF protection, and password hashing correctly — all attack surfaces where mistakes are costly. Better-auth handles these correctly out of the box.

**Rationale:** Better-auth is open source (MIT), fully self-hosted on Cloudflare infrastructure, and has a first-class Drizzle ORM adapter that writes session and user tables directly into D1. The username plugin enables username-based login (not just email), which suits a quiz platform where users want display names. The admin plugin provides role-based access for quiz moderation. Because Better-auth is self-hosted, there are no per-user costs and no data leaves the Cloudflare network.

---

### ADR-008: Database & ORM — Drizzle ORM + Cloudflare D1

**Decision Being Made:** Which database will store Questify's persistent data (users, quizzes, questions, answers, scores) and which ORM/query builder will be used to interact with it.

**Chosen Approach:** Drizzle ORM as the ORM, Cloudflare D1 as the SQLite-compatible database.

**Key Alternatives Considered (ORM):**

- **Prisma:** The most popular TypeScript ORM. Rejected because Prisma's query engine is a native binary sidecar process that cannot run inside a Cloudflare Worker. Prisma's edge driver exists but is limited in functionality and lags behind the main client in features.
- **Kysely:** A type-safe SQL query builder. Considered as a lighter alternative to Drizzle. Rejected because Kysely has no migration tooling — migrations must be written by hand. Drizzle's `drizzle-kit` generates migrations automatically from schema diffs.
- **Raw SQL:** Rejected because type safety for query inputs and outputs would need to be maintained manually, increasing the risk of SQL injection and type mismatches.

**Key Alternatives Considered (Database):**

- **PlanetScale:** A MySQL-compatible serverless database. Rejected due to cost at scale and the fact that it introduces an external vendor dependency outside the Cloudflare ecosystem.
- **Turso (libSQL):** A distributed SQLite service. Technically compatible with Drizzle but introduces a separate vendor for the database layer, adding complexity to the deployment stack.
- **Cloudflare Hyperdrive + external Postgres:** Hyperdrive caches connections to external Postgres databases from Workers. Rejected because it requires provisioning and managing an external Postgres instance, adding operational overhead for a project that can fit comfortably in SQLite at MVP scale.

**Rationale:** Drizzle is lightweight, generates fully typed query results, and its `drizzle-kit` migration tool handles schema evolution cleanly. D1 is SQLite-compatible and runs on Cloudflare's infrastructure, collocated with Workers — queries from a Worker to D1 have minimal latency. The Drizzle D1 adapter is the official integration path and is well-maintained. The entire data layer (Workers + D1) lives within one Cloudflare account with no cross-vendor networking.

---

### ADR-009: Caching Strategy — Cloudflare KV (Primary) + Upstash Redis (Fallback Option)

**Decision Being Made:** How the Questify backend will cache read-heavy data (quiz feed, leaderboards, popular question sets) to reduce D1 query load and improve response times.

**Chosen Approach:** Cloudflare KV as the primary distributed cache, with Upstash Redis documented as an upgrade path for use cases requiring sorted sets or pub/sub (e.g., real-time leaderboards).

**Key Alternatives Considered:**

- **In-memory cache (Worker-local):** Workers are stateless and may run on many edge nodes simultaneously. A Worker-local in-memory cache is not shared across instances and resets on every deployment, making it suitable only for request-scoped caching, not application-level caching.
- **External Redis (self-hosted or Elasticache):** A traditional Redis instance hosted outside Cloudflare would require Workers to make a round-trip to a remote data centre, adding 20–100ms of latency — defeating the purpose of edge computing.
- **Cloudflare Durable Objects:** A stateful primitive that can serve as a cache. Powerful, but adds significant architectural complexity for a use case (simple key-value caching) where KV is sufficient.

**Rationale:** Cloudflare KV is globally replicated to 200+ edge locations, meaning cache reads from a Worker are nearly always served from the same data centre or an adjacent one. For read-heavy data like a quiz feed or a category listing, KV cache misses are rare once the cache is warm. KV's eventual consistency model is acceptable for this use case — slight staleness in a quiz feed is not a correctness problem. Upstash Redis is documented as the upgrade path (not an initial requirement) for when sorted-set operations (leaderboard ranking) or pub/sub (live quiz rooms) are needed.

---

### ADR-010: Toolchain — npm Workspaces (Monorepo) + Biome (Lint & Format)

**Decision Being Made:** Which monorepo management tooling and code quality tooling will be used across the Questify codebase.

**Chosen Approach:** npm workspaces (built into npm 7+) for monorepo workspace management; Biome for linting and formatting as a unified tool replacing ESLint + Prettier.

**Key Alternatives Considered (Monorepo Tooling):**

- **Turborepo:** A build orchestration layer that adds remote caching, task pipelines, and incremental builds on top of npm/pnpm workspaces. Considered but rejected for Phase 1 because the Questify monorepo will start with 2–3 workspaces. Turborepo's benefits compound with scale; adding it now would be premature optimization that introduces unfamiliar tooling without immediate payoff.
- **pnpm workspaces:** pnpm's workspace protocol is stricter about dependency isolation and has better performance for large `node_modules` trees. Rejected in favour of npm workspaces due to team familiarity — all agents on the project are calibrated for npm conventions. Migrating to pnpm later is low-risk if needed.
- **Nx:** A full monorepo platform with code generation, affected project analysis, and distributed task execution. Rejected as significantly over-engineered for a project of this size.

**Key Alternatives Considered (Lint/Format):**

- **ESLint + Prettier:** The incumbent combination for TypeScript projects. Works well but requires maintaining two separate configs, two sets of plugin dependencies, and dealing with ESLint/Prettier rule conflicts. Rejected in favour of Biome because one tool is simpler to configure and faster to run.
- **oxlint:** Another Rust-based linter. Newer and faster than Biome in benchmarks but currently lacks the formatting capability, requiring Prettier to be paired with it — negating the single-tool benefit.

**Rationale:** npm workspaces require no additional dependencies and are already available in any modern npm installation. Biome replaces ESLint and Prettier with a single Rust-based tool that runs in milliseconds even on large codebases. Biome's configuration is a single `biome.json` file. CI lint/format checks run in under 2 seconds.

---

### ADR-011: Testing Strategy — Playwright E2E Only (Phase 1)

**Decision Being Made:** What level of automated testing will be implemented during Phase 1 of Questify development, and which tool will be used.

**Chosen Approach:** Playwright for end-to-end browser tests only. Unit and integration tests are deferred until Phase 3 (after core features stabilize).

**Key Alternatives Considered:**

- **Vitest (unit) + Playwright (E2E):** The recommended combination for React + Vite projects. Adding Vitest from the start adds setup cost: mock strategies, test utilities for React components, Worker mocking for Hono handlers. Rejected for Phase 1 because the component and handler contracts are still evolving — unit tests written now would need heavy refactoring as the architecture is established.
- **Cypress:** A browser automation tool with component testing support. Rejected because Playwright has better multi-browser support (Chromium, Firefox, WebKit), faster test execution, and better TypeScript integration out of the box.
- **Storybook + Chromatic (visual regression):** A useful addition for a component-heavy UI but represents significant setup overhead. Deferred to a future phase.

**Rationale:** E2E tests validate complete user flows (register → create quiz → publish → take quiz → view score) rather than isolated units, providing the most coverage per test for an early-stage application. Playwright runs headless tests against the actual deployed frontend and backend, catching integration issues that unit tests miss. Deferring unit tests until Phase 3 keeps the Phase 1 and 2 velocity high; once core feature shapes stabilize, adding Vitest unit tests for business logic (scoring, quiz validation) will be straightforward.

---

### ADR-012: Deployment Platform — Cloudflare Pages + Workers + D1

**Decision Being Made:** Where and how the Questify application will be hosted, and how deployments will be triggered and managed.

**Chosen Approach:** Cloudflare Pages for the frontend SPA, Cloudflare Workers for the API backend, Cloudflare D1 for the database, Cloudflare KV for the cache — all within a single Cloudflare account.

**Key Alternatives Considered:**

- **Vercel (frontend) + PlanetScale (database):** A popular combination. Rejected because it splits the platform across two vendors, each with separate pricing, billing, and credential management. Vercel's free tier limits serverless function execution time, which is a concern for quiz submission handlers.
- **AWS (S3 + CloudFront + Lambda + RDS):** Maximum flexibility but extreme operational overhead for a small team. Provisioning, IAM, VPC, and RDS management are not justified at MVP scale. Rejected.
- **Fly.io + Turso:** An alternative edge computing stack. Fly.io has a good developer experience but requires managing Docker containers and persistent volumes, adding operational complexity. Rejected in favour of Cloudflare's serverless primitives.

**Rationale:** Cloudflare's unified platform means the frontend, backend, database, and cache all run within Cloudflare's network with no cross-provider latency. Cloudflare Workers have no cold start problem (unlike AWS Lambda or Vercel Edge Functions) — every request is handled in under 5ms initialization time. The free tier for Pages, Workers, and D1 is generous enough to support a public beta without immediate cost. Using a single vendor also reduces the blast radius of billing surprises and simplifies secret/environment variable management (everything is in the Cloudflare dashboard and `wrangler.toml`).

---

### ADR-013: Monorepo Structure — npm Workspaces, apps/ + packages/ Layout

**Decision Being Made:** How the Questify repository will be physically organized — directory layout, workspace naming conventions, and how shared code will be packaged.

**Chosen Approach:** A single Git repository with npm workspaces. Top-level directories: `apps/` for deployable applications, `packages/` for shared internal packages.

**Key Alternatives Considered:**

- **Separate Git Repositories (Polyrepo):** One repo for the frontend, one for the backend, one for shared types. Rejected because coordinating changes that span the frontend and backend (e.g., adding a new API endpoint and the React query hook that calls it) requires PRs in multiple repositories, increasing coordination overhead and making atomic cross-cutting changes impossible.
- **Nx Monorepo:** Nx provides a structured monorepo framework with generators, affected-project detection, and remote caching. Rejected as over-engineered for the current scale. The project may adopt Nx in a later phase if the number of workspaces grows significantly.
- **Flat monorepo (no apps/ / packages/ split):** All workspaces at the root level. Rejected because it becomes disorganized quickly. The apps/ vs packages/ distinction makes it immediately clear whether a workspace is a deployable artifact (app) or an internal library (package).

**Planned Workspace Layout:**

```
apps/
  web/          — Vite + React 19 frontend (Cloudflare Pages)
  api/          — Hono + Cloudflare Workers backend
packages/
  shared/       — Shared TypeScript types, Zod schemas, constants
  ui/           — Shared shadcn/ui component library (optional, promoted from apps/web if needed)
```

**Rationale:** The apps/ + packages/ convention is widely understood and used by TurboRepo, Nx, and other monorepo tools — adopting it now means any future migration to a more sophisticated build system is low-friction. The `packages/shared` workspace is the single source of truth for types and Zod schemas shared between the frontend and backend, eliminating duplication and ensuring the API contract is type-safe end-to-end.

---

## Coding Standards

### STANDARD-typescript-strict

**Governs:** TypeScript compiler configuration and type discipline across all workspaces.

**Key Rules:**

1. `"strict": true` must be enabled in all `tsconfig.json` files. This enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, and `strictBindCallApply`.
2. `"noUncheckedIndexedAccess": true` must be set. Array index access (`arr[0]`) returns `T | undefined`, not `T`. This prevents unchecked array access bugs.
3. Zero tolerance for the `any` type. If a value is genuinely unknown, use `unknown` and narrow it with a type guard or Zod parsing. If a third-party library returns `any`, wrap it in a typed function that asserts the shape.
4. Type assertions (`as SomeType`) must include a comment explaining why the assertion is safe. Unaccompanied `as` casts in PRs are a review failure.
5. Generics are preferred over `any` for reusable utilities. A function that operates on an unknown collection should be `function process<T>(items: T[]): T` not `function process(items: any[]): any`.
6. All exported functions and methods must have explicit return types. TypeScript's inferred return types are convenient but hide accidental shape changes.
7. `@ts-ignore` is forbidden. `@ts-expect-error` is allowed only with a comment and a linked ticket to fix the underlying issue.

---

### STANDARD-api-response-shape

**Governs:** The shape of all JSON responses returned by Hono route handlers in `apps/api/`.

**Key Rules:**

1. All successful responses return a JSON object with a top-level `data` key: `{ data: T }`. The `T` type is defined per-endpoint and must be a named TypeScript type or inferred from a Zod schema.
2. All error responses return a JSON object with `error` (human-readable message string) and `code` (machine-readable error code string): `{ error: string, code: string }`.
3. HTTP status codes must always be explicitly set. Never rely on Hono's default status when the intent matters (e.g., 201 for resource creation, 422 for validation errors, 403 for authorization failures).
4. No "naked" returns. A handler must never `return c.json(someValue)` where `someValue` is not wrapped in `{ data: someValue }` or `{ error: ..., code: ... }`.
5. Pagination responses use `{ data: T[], meta: { total: number, page: number, pageSize: number } }`.
6. The `code` field in error responses uses SCREAMING_SNAKE_CASE and is namespaced by domain: e.g., `QUIZ_NOT_FOUND`, `AUTH_INVALID_CREDENTIALS`, `VALIDATION_FAILED`.

---

### STANDARD-zod-validation

**Governs:** Input validation at API boundaries and the relationship between Zod schemas and TypeScript types.

**Key Rules:**

1. Every Hono route handler that accepts a request body, path parameter, or query parameter must validate that input with a Zod schema using `@hono/zod-validator` before any business logic executes. A handler that accesses `c.req.json()` without prior Zod validation is a review failure.
2. All shared TypeScript types in `packages/shared/` that correspond to API inputs or outputs must be derived from Zod schemas using `z.infer<typeof Schema>`. The Zod schema is the single source of truth; the TypeScript type is a derived artifact.
3. No manual type casting of request bodies. `const body = (await c.req.json()) as CreateQuizRequest` is forbidden. The Zod validator middleware provides the parsed, typed value through Hono's context; use that.
4. Zod schemas in `packages/shared/` must be importable in both `apps/web/` (for client-side form validation) and `apps/api/` (for server-side input validation), ensuring identical validation rules on both sides.
5. `.parse()` (throws on failure) is used for data that should always be valid (e.g., environment variables at startup). `.safeParse()` (returns a result object) is used for user-supplied data so failures can be handled gracefully and returned as structured error responses.

---

### STANDARD-component-naming

**Governs:** File naming, component function naming, export style, and Props interface naming for all React components in `apps/web/`.

**Key Rules:**

1. Component function names and their exports use PascalCase: `export function QuizCard(...)`.
2. Component file names use kebab-case: `quiz-card.tsx`. The component name is deterministic from the file name (kebab-to-pascal).
3. The Props interface for a component is named `[ComponentName]Props` and is defined in the same file immediately before the component function: `interface QuizCardProps { ... }`.
4. Each component directory or feature directory exports its components from an `index.ts` barrel file. External modules import from the barrel, not from individual component files.
5. One component per file for all non-trivial components. Small co-located sub-components (e.g., an icon wrapper used only within one parent) may be defined in the same file but must be placed below the main export and prefixed with an underscore to signal they are private: `function _QuizCardBadge(...)`.
6. Page-level route components (files in the TanStack Router `routes/` directory) use the `Page` suffix: `QuizDetailPage`, `HomePageRoute`. This makes it easy to distinguish routing entry points from reusable components.

---

## Monorepo Touch Points

Phase 01 touches only the `docs/architecture/` directory. No application code, workspace configuration, environment files, or CI configuration is created or modified.

```
docs/
  architecture/
    PHASE-01-tech-stack-adrs.md      ← this document (blueprint)
    PHASE-02-agent-configuration.md  ← Phase 02 blueprint
    ADR-001-frontend-framework.md
    ADR-002-routing.md
    ADR-003-server-state.md
    ADR-004-ui-component-library.md
    ADR-005-client-state.md
    ADR-006-backend-framework.md
    ADR-007-authentication.md
    ADR-008-database-orm.md
    ADR-009-caching-strategy.md
    ADR-010-toolchain.md
    ADR-011-testing-strategy.md
    ADR-012-deployment-platform.md
    ADR-013-monorepo-structure.md
    STANDARD-typescript-strict.md
    STANDARD-api-response-shape.md
    STANDARD-zod-validation.md
    STANDARD-component-naming.md
```

---

## Implementation Steps

### Step 1 — Frontend Stack ADRs (ADR-001 through ADR-005)

Write individual ADR files for each frontend decision: frontend framework, routing, server state, UI component library, and client state. Each file follows the standard ADR template: Status, Context, Decision, Consequences. The Architect reviews all five before proceeding.

**Produces:** `ADR-001-frontend-framework.md`, `ADR-002-routing.md`, `ADR-003-server-state.md`, `ADR-004-ui-component-library.md`, `ADR-005-client-state.md`

### Step 2 — Backend Stack ADRs (ADR-006 through ADR-009)

Write individual ADR files for each backend decision: backend framework, authentication, database & ORM, and caching strategy. The Architect cross-references these four ADRs to confirm they are internally consistent (e.g., Better-auth's Drizzle adapter is compatible with the D1 driver selected in ADR-008).

**Produces:** `ADR-006-backend-framework.md`, `ADR-007-authentication.md`, `ADR-008-database-orm.md`, `ADR-009-caching-strategy.md`

### Step 3 — Toolchain, Testing, Deployment, and Monorepo ADRs (ADR-010 through ADR-013)

Write ADR files for toolchain choices, testing scope, deployment platform, and repository structure. These four ADRs have cross-cutting implications that affect every future phase, so they should be reviewed last after the application-layer ADRs are settled.

**Produces:** `ADR-010-toolchain.md`, `ADR-011-testing-strategy.md`, `ADR-012-deployment-platform.md`, `ADR-013-monorepo-structure.md`

### Step 4 — Coding Standards Documents

Write the four STANDARD documents. Each standard must be actionable: a developer (or AI agent) reading a standard should be able to determine unambiguously whether a specific line of code complies or violates it.

**Produces:** `STANDARD-typescript-strict.md`, `STANDARD-api-response-shape.md`, `STANDARD-zod-validation.md`, `STANDARD-component-naming.md`

---

## Tickets

| Ticket ID | Title | Assigned To | Effort |
|-----------|-------|-------------|--------|
| QZ-0001 | Write frontend stack ADRs (ADR-001 – ADR-005) | Architect | M |
| QZ-0002 | Write backend stack ADRs (ADR-006 – ADR-009) | Architect | M |
| QZ-0003 | Write toolchain/deploy/monorepo ADRs (ADR-010 – ADR-013) | Architect | S |
| QZ-0004 | Write coding standards documents (4 STANDARDs) | Architect | S |

---

## Acceptance Criteria

- [ ] `ADR-001-frontend-framework.md` exists in `docs/architecture/` and is marked `Status: Accepted`
- [ ] `ADR-002-routing.md` exists and is marked `Status: Accepted`
- [ ] `ADR-003-server-state.md` exists and is marked `Status: Accepted`
- [ ] `ADR-004-ui-component-library.md` exists and is marked `Status: Accepted`
- [ ] `ADR-005-client-state.md` exists and is marked `Status: Accepted`
- [ ] `ADR-006-backend-framework.md` exists and is marked `Status: Accepted`
- [ ] `ADR-007-authentication.md` exists and is marked `Status: Accepted`
- [ ] `ADR-008-database-orm.md` exists and is marked `Status: Accepted`
- [ ] `ADR-009-caching-strategy.md` exists and is marked `Status: Accepted`
- [ ] `ADR-010-toolchain.md` exists and is marked `Status: Accepted`
- [ ] `ADR-011-testing-strategy.md` exists and is marked `Status: Accepted`
- [ ] `ADR-012-deployment-platform.md` exists and is marked `Status: Accepted`
- [ ] `ADR-013-monorepo-structure.md` exists and is marked `Status: Accepted`
- [ ] `STANDARD-typescript-strict.md` exists and is marked `Status: Active`
- [ ] `STANDARD-api-response-shape.md` exists and is marked `Status: Active`
- [ ] `STANDARD-zod-validation.md` exists and is marked `Status: Active`
- [ ] `STANDARD-component-naming.md` exists and is marked `Status: Active`
- [ ] All documents reviewed and approved by the Architect
- [ ] Remy (ai-ba) confirms all 17 docs are present and Phase 01 complete

---

## Out of Scope

The following work is explicitly NOT part of Phase 01:

- Creating `package.json`, `tsconfig.json`, or any workspace configuration files
- Installing npm dependencies
- Scaffolding the `apps/web/` or `apps/api/` directories
- Writing any application source code (TypeScript, CSS, HTML)
- Creating GitHub Actions CI workflows
- Configuring `wrangler.toml` for Cloudflare deployment
- Creating AI agent definition files (that is Phase 02)
- Provisioning any cloud resources (D1 database, KV namespace, Cloudflare Pages project)

---

## Agent Assignments

| Role | Agent File | Responsibility in This Phase |
|------|-----------|------------------------------|
| Architect | `.claude/agents/architect.md` | Authors all 13 ADR files and all 4 STANDARD files |
| Producer (Remy) | `.claude/agents/ai-ba.md` | Tracks ticket completion, confirms all files exist, marks phase complete |

No other agents are active during Phase 01.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ADR decisions may need revision once implementation reveals constraints | Medium | Medium | ADRs can be superseded by a new ADR; original is marked `Status: Superseded` with a reference to the new ADR |
| Incomplete rationale in ADRs leads AI agents to misunderstand intent | Medium | High | Architect review gate before phase close; ADRs must answer "why not X" for at least two alternatives |
| STANDARD rules are too strict to be practical | Low | Medium | STANDARDs can receive minor clarifications (with annotation) without requiring a full superseding document |
| Scope creep: pressure to start coding during Phase 01 | Low | High | Phase 01 strictly produces docs only; any implementation work must be filed as a ticket for Phase 03+ |

---

## Estimated Effort

**Total Phase Effort:** M (Medium)

Phase 01 requires deep thinking and written precision rather than large code output. The 17 document artifacts (13 ADRs + 4 STANDARDs) take roughly 2–4 hours of focused writing. The primary cost is decision quality: a poorly reasoned ADR has downstream consequences in every phase that follows.
