---
title: "ADR-001: npm Workspaces Monorepo"
status: "Accepted"
date: "2026-06-29"
authors: "Questify Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-001: npm Workspaces Monorepo

## Context

The Questify quiz creator (quiz-creatorv3) consists of five distinct packages that must share tooling, TypeScript configuration, and root-level scripts while being independently deployable:

- `apps/web` — Vite + React 19 frontend, deployed to Cloudflare Pages
- `apps/api` — Hono HTTP framework on Cloudflare Workers
- `packages/db` — Drizzle ORM schema and database factory
- `packages/shared` — shared TypeScript types and utilities
- `packages/ui` — shared React component library

A single-tool approach is needed to hoist shared devDependencies (Biome, TypeScript, Playwright) to the root, link workspace packages to each other using `"*"` version references, and run cross-package scripts from one root invocation. The deployment toolchain is `wrangler` for the Workers API and `vite build` for the web app — neither is managed by a build orchestration layer.

## Decision

Use npm workspaces as the sole monorepo package manager. No task orchestration layer (Turborepo, Nx) is added at this stage.

The root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`. All devDependencies shared across packages (Biome, TypeScript, Playwright, Drizzle Kit, Wrangler) live at the root. Inter-package references use `"*"` version specifiers so npm resolves them via symlinks at install time. Root scripts (`lint`, `format`, `test`, `typecheck`) invoke tools once across the entire workspace.

This decision is made because the build graph has no incremental caching need at current scale (five packages, two deploy targets), npm is already the required package manager for the Cloudflare Workers ecosystem, and adding a task orchestration layer before the project has demonstrated a build-time bottleneck adds configuration overhead with no present benefit.

## Consequences

### Positive

- **POS-001**: Zero additional tooling surface — npm ships with Node.js, requiring no separate install or version pinning for a workspace manager.
- **POS-002**: Flat hoisting model matches what `wrangler`'s bundler expects; Cloudflare Workers bundling works without phantom dependency workarounds.
- **POS-003**: Single `npm install` at the root installs all packages and creates workspace symlinks, making onboarding and CI setup straightforward.
- **POS-004**: Turborepo or Nx can be layered on top of npm workspaces at any point with no structural refactor — the workspace topology is not locked to a specific tool.

### Negative

- **NEG-001**: No incremental build caching — every `npm run build` re-executes all packages unconditionally. Acceptable now; will need revisiting if CI times grow past acceptable thresholds.
- **NEG-002**: npm workspaces provide no task graph — parallel script execution across packages requires explicit `--workspaces` flags or manual scripting rather than a dependency-aware runner.
- **NEG-003**: Flat hoisting can cause version conflicts when two packages require incompatible versions of the same dependency; must be managed manually in the root `package.json` using overrides if needed.

## Alternatives Considered

### Turborepo

- **ALT-001**: **Description**: A task orchestration layer that sits on top of npm/pnpm/yarn workspaces, adding remote caching, incremental builds, and a dependency-aware task graph.
- **ALT-001**: **Rejection reason**: The build graph for five packages with two deploy targets provides no meaningful opportunity for incremental caching at this stage. Turborepo requires a `turbo.json` pipeline config and would add conceptual overhead for a team bootstrapping the project. Can be added later without restructuring the workspace.

### pnpm Workspaces

- **ALT-002**: **Description**: pnpm provides workspace support with stricter dependency isolation via a virtual store and symlinked `node_modules`. It is faster at install time than npm for large dependency trees.
- **ALT-002**: **Rejection reason**: pnpm's strict hoisting behavior (non-flat `node_modules`) can cause bundling failures in Cloudflare Workers, where `wrangler` expects to resolve all dependencies from a flat structure. npm's permissive hoisting model matches wrangler's bundler expectations without workarounds.

### Nx

- **ALT-003**: **Description**: A full monorepo framework with generators, executors, project graph visualization, and remote caching built in.
- **ALT-003**: **Rejection reason**: Nx is designed for large, multi-team repositories. It requires generator and executor configuration for each package type and introduces Nx-specific conventions that would be heavyweight for five packages with straightforward deploy pipelines.

## Implementation Notes

- **IMP-001**: Root `package.json` `workspaces` field: `["apps/*", "packages/*"]`. Each workspace package's `package.json` uses `"*"` for cross-workspace dependencies (e.g., `apps/api` lists `"@questify/db": "*"`).
- **IMP-002**: All devDependencies consumed across multiple packages — TypeScript, Biome, Playwright, Drizzle Kit, Wrangler — are declared only in the root `package.json`. Workspace packages declare only their runtime dependencies locally.
- **IMP-003**: Verify by running `npm install` from the root and confirming `node_modules/@questify/db` is a symlink to `packages/db`. Run `npm run lint --workspaces` to confirm workspace scripts resolve correctly.

## References

- **REF-001**: [ADR-002-hono-cloudflare-workers-api.md](ADR-002-hono-cloudflare-workers-api.md) — deployment target that informed the hoisting model requirement
- **REF-002**: [ADR-005-biome-lint-format.md](ADR-005-biome-lint-format.md) — root-level tooling that depends on workspace structure
- **REF-003**: [npm workspaces documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
