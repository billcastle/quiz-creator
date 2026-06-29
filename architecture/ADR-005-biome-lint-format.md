---
title: "ADR-005: Biome for Linting and Formatting"
status: "Accepted"
date: "2026-06-29"
authors: "Questify Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-005: Biome for Linting and Formatting

## Context

The Questify monorepo contains five TypeScript workspaces with `.ts` and `.tsx` source files. Every workspace requires consistent linting (enforce code quality rules) and formatting (enforce a single canonical code style). These two concerns must be configured once at the monorepo root and apply uniformly across all packages.

The industry-standard toolchain for this is ESLint (linting) + Prettier (formatting). In a TypeScript monorepo, this combination requires:

- `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` (TypeScript linting)
- `prettier` (formatting)
- `eslint-config-prettier` (disable ESLint formatting rules that conflict with Prettier)
- `eslint-plugin-import` or `@typescript-eslint/eslint-plugin` import order rules
- `.eslintrc.json` (or `.eslintrc.cjs`), `.prettierrc`, `.eslintignore`, `.prettierignore`

This is six or more packages and four or more config files for two tools that solve one concern: keeping code consistent. The cognitive overhead of managing two tool configurations and their interaction (particularly formatter-vs-linter rule conflicts) is non-trivial for a project that should be spending that energy on product features.

Biome v2 is a single Rust-native tool that covers both linting and formatting in one binary, one config file, and one npm package. It supports TypeScript, TSX, and JavaScript natively.

## Decision

Use Biome v2 as the sole linting and formatting tool for the entire monorepo. ESLint and Prettier are not installed.

A single `biome.json` at the monorepo root configures both the linter and formatter. The configuration applies to all files in all workspaces without per-package overrides. Root `package.json` scripts:

- `npm run lint` — runs `biome check .` (lint + format check, no writes)
- `npm run format` — runs `biome format --write .` (format in place)
- `npm run lint:fix` — runs `biome check --write .` (lint + format, apply safe fixes)

CI runs `biome check .` as a required check on every pull request. Any lint or format violation blocks merge.

## Consequences

### Positive

- **POS-001**: Single config file (`biome.json`) replaces six packages and four config files. Onboarding requires understanding one tool, not two tools plus their interaction rules.
- **POS-002**: Biome is Rust-native and significantly faster than ESLint — benchmarks show ~8ms for 25 files vs. seconds for equivalent ESLint runs. CI lint steps run in under two seconds for the full monorepo.
- **POS-003**: No formatter-linter conflict surface — because Biome owns both concerns, there is no equivalent of the ESLint vs. Prettier rule overlap that requires `eslint-config-prettier` to suppress formatting rules from ESLint's rule set.
- **POS-004**: Biome's formatter is opinionated and produces deterministic output, eliminating debates about formatting options. The formatter is intentionally similar to Prettier's output to ease migration if it were ever needed.

### Negative

- **NEG-001**: Biome has a smaller rule set than ESLint's plugin ecosystem. Some ESLint plugins (e.g., `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`) have no direct Biome equivalent. Accessibility and React-specific rules that those plugins provide are not enforced by Biome at this time.
- **NEG-002**: Biome is a newer tool with a smaller community than ESLint. Unusual edge cases in TypeScript linting may surface bugs or unimplemented rules. The escape hatch is `// biome-ignore` inline suppression comments.
- **NEG-003**: Some IDEs and editors have more mature ESLint integration than Biome. Developers on older editor setups may need to install or update the Biome editor extension to get inline diagnostics.

## Alternatives Considered

### ESLint + Prettier

- **ALT-001**: **Description**: The dominant industry standard for TypeScript linting and formatting. ESLint handles code quality rules; Prettier handles formatting.
- **ALT-001**: **Rejection reason**: Requires six or more packages and four or more config files to configure correctly for TypeScript. The `eslint-config-prettier` compatibility shim is a recurring source of misconfiguration. ESLint is 10–100x slower than Biome for large file sets. The complexity cost is not justified when Biome covers both concerns with a single config.

### oxlint

- **ALT-002**: **Description**: A Rust-native ESLint-compatible linter, significantly faster than ESLint.
- **ALT-002**: **Rejection reason**: oxlint is a linter only — its formatter is not production-ready at time of adoption. Using oxlint would still require Prettier for formatting, reintroducing the two-tool configuration problem. Biome covers both linting and formatting.

### dprint

- **ALT-003**: **Description**: A Rust-native code formatter with TypeScript and TSX support.
- **ALT-003**: **Rejection reason**: dprint is a formatter only with no linting capability. Adopting dprint would still require ESLint for linting, reintroducing the two-tool problem. Does not address the core motivation.

## Implementation Notes

- **IMP-001**: `biome.json` at monorepo root. Key settings: `"$schema": "https://biomejs.dev/schemas/2.5.1/schema.json"`, `linter.rules.recommended: true`, `formatter.indentStyle: "space"`, `formatter.indentWidth: 2`, `formatter.lineWidth: 100`, `javascript.formatter.quoteStyle: "single"`, `javascript.formatter.semicolons: "asNeeded"`, `javascript.formatter.trailingCommas: "es5"`.
- **IMP-002**: `biome.json` `files.ignore` array must include `["**/node_modules", "**/dist", "**/.wrangler", "**/build"]` to exclude generated output from lint and format checks.
- **IMP-003**: Verify by running `npm run lint` from the root. Confirm exit code 0 on a clean workspace and that a deliberately malformed file (trailing space, double quotes where single are required) produces a non-zero exit code with a descriptive diagnostic message.

## References

- **REF-001**: [ADR-001-npm-workspaces-monorepo.md](ADR-001-npm-workspaces-monorepo.md) — root `package.json` that hosts Biome as a devDependency and exposes lint/format scripts
- **REF-002**: [Biome documentation](https://biomejs.dev/docs/)
- **REF-003**: [Biome v2 migration guide](https://biomejs.dev/blog/biome-v2/)
