---
title: "ADR-013: Monorepo Structure — npm Workspaces, apps/ + packages/ Layout"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-013: Monorepo Structure — npm Workspaces, apps/ + packages/ Layout

## Context

The Questify project has multiple distinct deployable artifacts (the Vite SPA frontend, the Hono Workers backend) and shared code that both apps need (TypeScript types, Zod schemas, shadcn/ui components, Drizzle schema). These must be coordinated in a way that allows atomic cross-cutting changes (e.g., adding a new API endpoint and the React hook that calls it in a single PR) while keeping each artifact's deployment independent.

A decision is needed on the physical layout of the repository and the mechanism for sharing code between workspaces.

## Decision

A single Git repository with npm workspaces, organized as `apps/` (deployable units) and `packages/` (shared internal libraries).

```
quiz-creatorv2/
  apps/
    web/          — @quiz/web — Vite + React 19 SPA (→ Cloudflare Pages)
    api/          — @quiz/api — Hono backend (→ Cloudflare Workers)
  packages/
    ui/           — @quiz/ui — shadcn/ui components + Tailwind
    db/           — @quiz/db — Drizzle schema + D1 client
    shared/       — @quiz/shared — Zod schemas, TypeScript types, constants
```

npm workspaces enable workspace-relative imports (`import { CreateQuizInput } from '@quiz/shared'`) that work in both `apps/web` and `apps/api`, giving the project a type-safe API contract end-to-end. Changes that span the frontend and backend can be made in a single PR, reviewed atomically, and merged together. The `apps/` vs `packages/` split makes it immediately clear whether a workspace is a deployable artifact or an internal library — new contributors can orient themselves without reading documentation.

## Consequences

### Positive

- **POS-001**: Atomic cross-cutting changes — a new API endpoint and its React Query hook can be in a single PR, tested together, and reviewed as a unit
- **POS-002**: Shared Zod schemas in `packages/shared` are the single source of truth for API contracts — no duplication, no drift between frontend and backend validation
- **POS-003**: The `apps/` vs `packages/` convention is used by Turborepo, Nx, and other monorepo tools — migrating to a more sophisticated build system later is low-friction

### Negative

- **NEG-001**: npm workspaces lack task orchestration — running `npm run build --workspaces` runs sequentially, not in dependency order; a `packages/db` change requires manually ensuring `apps/api` is rebuilt after
- **NEG-002**: A single Git repo means all contributors have access to all workspaces — there is no access control granularity below the repo level
- **NEG-003**: `node_modules` hoisting in npm workspaces can cause subtle version conflicts when two workspaces depend on different versions of the same package; `overrides` in the root `package.json` may be needed to resolve conflicts

## Alternatives Considered

### Separate Git repositories (polyrepo)

- **ALT-001**: **Description**: One Git repository per app and per package, each deployed and versioned independently
- **ALT-001**: **Rejection reason**: Coordinating cross-cutting changes requires multiple PRs in multiple repos — atomic changes are impossible. Reviewing a new API endpoint alongside its React hook requires jumping between repositories.

### Nx monorepo

- **ALT-002**: **Description**: A full monorepo platform with generators, affected-project detection, and remote caching, layered on top of npm or pnpm workspaces
- **ALT-002**: **Rejection reason**: Over-engineered for 5 workspaces. Noted as upgrade path if the workspace count exceeds approximately 10.

### Flat monorepo (all workspaces at root)

- **ALT-003**: **Description**: All packages at the same directory level without the `apps/` vs `packages/` grouping (e.g., `web/`, `api/`, `ui/`, `db/`, `shared/` directly at root)
- **ALT-003**: **Rejection reason**: Becomes disorganized quickly — the deployable/library distinction is immediately useful for new contributors and is not surfaced in a flat layout.

## Implementation Notes

- **IMP-001**: The root `package.json` defines `"workspaces": ["apps/*", "packages/*"]`; workspace packages use `@quiz/` scoped names matching the directory structure
- **IMP-002**: Each workspace has its own `tsconfig.json` extending the root `tsconfig.base.json`; path aliases (`"@quiz/shared": ["../../packages/shared/src"]`) are defined in the root tsconfig and inherited by all workspaces
- **IMP-003**: Success criterion — `npm install` at the root links all workspaces; `import { createDb } from '@quiz/db'` resolves correctly in `apps/api`; `import { Button } from '@quiz/ui'` resolves correctly in `apps/web`

## References

- **REF-001**: `ADR-010-toolchain.md` — npm workspaces is the foundation for Biome's multi-package linting
- **REF-002**: `ADR-012-deployment-platform.md` — each app in `apps/` is a separate deployment target
- **REF-003**: https://docs.npmjs.com/cli/v10/using-npm/workspaces
