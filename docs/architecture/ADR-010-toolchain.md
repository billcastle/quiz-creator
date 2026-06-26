---
title: "ADR-010: Toolchain — npm Workspaces + Biome"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-010: Toolchain — npm Workspaces + Biome

## Context

The Questify monorepo contains multiple workspaces (`apps/web`, `apps/api`, `packages/ui`, `packages/db`, `packages/shared`). Each workspace needs consistent TypeScript compilation, code formatting, and linting. The tooling must be fast enough for CI to complete in under 2 minutes and must not require complex configuration files that create maintenance burden.

A decision is required on two separate but related concerns: (1) how to manage the monorepo's workspace dependencies and cross-package scripts, and (2) which tool enforces code quality (formatting and linting) across all workspaces.

## Decision

npm workspaces (built into npm 7+) for monorepo management; Biome for linting and formatting as a single tool replacing ESLint + Prettier.

npm workspaces enable workspace-relative imports (`@quiz/ui`, `@quiz/shared`) and allow scripts to run across workspaces (`npm run build --workspaces`). No additional tooling is needed beyond what ships with npm. Adding Turborepo or Nx would be premature at the current scale of 5 workspaces; those tools are documented as the upgrade path if build times become problematic.

Biome is a Rust-based tool that replaces both ESLint and Prettier with a single binary. It runs in under 100ms on the full codebase (vs. 2–5 seconds for ESLint + Prettier). Its configuration is a single `biome.json` file at the monorepo root. Biome's formatter is compatible with Prettier's output for the common subset of rules, making future migration straightforward. Biome's linter covers the TypeScript rules that matter most (no-unused-variables, no-explicit-any, prefer-const) without the plugin sprawl of ESLint.

## Consequences

### Positive

- **POS-001**: Biome replaces ESLint + Prettier with a single dependency and single config file — no plugin version conflicts, no formatter-linter rule conflicts
- **POS-002**: Lint + format runs in under 100ms on the full codebase — CI `lint` step completes in under 10 seconds
- **POS-003**: npm workspaces require no additional dependencies — `npm install` at the monorepo root installs everything and links workspace packages

### Negative

- **NEG-001**: Biome's linter rule coverage is a subset of ESLint's full plugin ecosystem — some niche ESLint plugins (e.g., specific accessibility rules) have no Biome equivalent yet
- **NEG-002**: npm workspaces lack task orchestration (no parallel task execution, no affected-project detection) — if the monorepo grows beyond approximately 8 workspaces, a build orchestration layer (Turborepo) should be evaluated
- **NEG-003**: Biome's formatter differs from Prettier in some edge cases (e.g., trailing comma behavior in some TypeScript generics); the `biome.json` must specify `trailingCommas: "all"` to match team preference

## Alternatives Considered

### ESLint + Prettier

- **ALT-001**: **Description**: The incumbent combination of ESLint for linting and Prettier for formatting, connected via `eslint-config-prettier` to disable conflicting rules
- **ALT-001**: **Rejection reason**: Requires two separate configs, two dependency trees, and ongoing management of ESLint/Prettier rule conflicts. Rejected in favour of Biome's unified approach.

### Turborepo

- **ALT-002**: **Description**: A monorepo orchestration tool that adds remote caching and task pipelines on top of npm or pnpm workspaces
- **ALT-002**: **Rejection reason**: The project starts with 5 workspaces — Turborepo's benefits compound at 15+ workspaces. Rejected as premature but documented as the upgrade path.

### pnpm workspaces

- **ALT-003**: **Description**: An alternative package manager with stricter dependency isolation and better performance for large `node_modules` trees
- **ALT-003**: **Rejection reason**: Rejected in favour of npm workspaces due to team familiarity with npm conventions. pnpm migration is noted as a future option.

### oxlint

- **ALT-004**: **Description**: A Rust-based linter faster than Biome in benchmarks, with no formatting capability
- **ALT-004**: **Rejection reason**: Lacks formatting — requires Prettier alongside it, negating the single-tool benefit that motivated the switch away from ESLint + Prettier.

## Implementation Notes

- **IMP-001**: `biome.json` lives at the monorepo root and applies to all workspaces; each workspace `package.json` adds `"check": "biome check --write ."` as a dev script
- **IMP-002**: The root `package.json` defines `"lint": "biome check ."` and `"format": "biome format --write ."` as workspace-spanning scripts; CI runs `npm run lint` at the root
- **IMP-003**: Success criterion — `npm run lint` at the monorepo root completes in under 10 seconds with zero errors on a clean checkout

## References

- **REF-001**: `ADR-001-frontend-framework.md` — Vite config is linted by Biome
- **REF-002**: `ADR-013-monorepo-structure.md` — workspace layout that Biome's config covers
- **REF-003**: `STANDARD-typescript-strict.md` — TypeScript strict mode rules enforced in `tsconfig.json`
- **REF-004**: https://biomejs.dev/
