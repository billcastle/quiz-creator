---
title: "ADR-006: File-based theme engine with import.meta.glob"
status: "Accepted"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["architecture", "decision", "design-system", "theming"]
supersedes: ""
superseded_by: ""
---

# ADR-006: File-based theme engine with import.meta.glob

## Context

QZ-0002 required a theme switching system that could support multiple visual themes (Default, Dark, Dusk at launch) with a clear path for contributors to add themes without modifying any existing file.

Two approaches were evaluated:

1. **CSS class switching** — declare each theme as a CSS class (e.g., `.theme-dusk`) on `<html>`. The toggle adds/removes the class. Each theme overrides the same custom properties under its class selector.
2. **File-based TypeScript objects** — each theme is a `.ts` file exporting a plain object satisfying a `Theme` interface (17-token map + metadata). Vite's `import.meta.glob` auto-discovers all files in `packages/ui/src/themes/`. Applying a theme calls `document.documentElement.style.setProperty()` for each token.

CSS class switching requires pre-declaring every theme in a stylesheet and updating that file with each addition. It also creates specificity problems when themes need to override component-level styles.

The TypeScript approach makes each theme a self-contained, type-checked unit. Adding a new theme is a single-file operation — no changes to `ThemeToggle`, no CSS file edits, no barrel export changes.

## Decision

Themes are standalone `.ts` files in `packages/ui/src/themes/`. Each exports a default object satisfying the `Theme` interface. `ThemeToggle` discovers themes at runtime via `import.meta.glob` and applies the selected theme by calling `document.documentElement.style.setProperty()` for each token. No CSS class is written to `<html>` — all application happens via inline CSS custom properties on the root element.

## Consequences

### Positive

- **POS-001**: Adding a new theme requires creating exactly one file. No other file in the codebase changes.
- **POS-002**: TypeScript enforces that every required token is present in every theme file — missing tokens are compile errors, not runtime surprises.
- **POS-003**: Inline `style` on `<html>` has the highest CSS specificity, so themes always win over component-level styles without needing `!important`.
- **POS-004**: Theme metadata (id, name, swatches) lives alongside tokens in the same file — one source of truth per theme.
- **POS-005**: Vite tree-shakes unused themes in production bundles via the dynamic import boundary.

### Negative

- **NEG-001**: `import.meta.glob` is Vite-specific. If the build tool changes, theme discovery must be re-implemented.
- **NEG-002**: Themes are runtime JavaScript, not pure CSS. A server-side render without hydration would flash unstyled content until the theme JS runs. Accepted risk — Questify is a client-rendered SPA.
- **NEG-003**: Inline styles on `<html>` are overridden by any other code that sets competing root-level inline styles. Requires discipline not to do this elsewhere in the app.

## Alternatives Considered

### CSS class switching (rejected)

- **ALT-001**: **Description**: Each theme is a CSS class on `<html>`. ThemeToggle adds/removes the class. Each theme overrides all custom properties under its class selector in a shared stylesheet.
- **ALT-001**: **Rejection reason**: Adding a theme requires editing the global stylesheet and keeping class names in sync with ThemeToggle. Creates coupling between the stylesheet and the toggle component. Multi-file change per theme.

### Single theme file with multiple named exports (rejected)

- **ALT-002**: **Description**: All themes live in one file (`themes/all.ts`). Adding a theme means editing that shared file.
- **ALT-002**: **Rejection reason**: Creates merge conflicts on a high-traffic file and removes the "one file per theme" guarantee.

## Implementation Notes

- **IMP-001**: `Theme` interface and `themes[]` export live in `packages/ui/src/themes/index.ts`. Types for the interface are in `packages/ui/src/themes/types.ts`.
- **IMP-002**: The glob pattern resolves `./*.ts` relative to the themes directory, picking up every `.ts` file present (except `index.ts` and `types.ts`, which export no `default Theme`).
- **IMP-003**: `applyTheme(theme)` is called by the theme store on selection and on initial load (reading `localStorage["questify-theme"]`, falling back to `prefers-color-scheme`).
- **IMP-004**: Success criterion: dropping a new `.ts` file into `packages/ui/src/themes/` causes it to appear in `ThemeToggle` with no other code change.

## References

- **REF-001**: [PATTERN-file-based-theme.md](PATTERN-file-based-theme.md) — reuse pattern with full code example for adding a theme.
- **REF-002**: [GUIDE-adding-theme.md](GUIDE-adding-theme.md) — operational guide for contributors.
- **REF-003**: [STANDARD-design-token-styling.md](STANDARD-design-token-styling.md) — rule that makes theme switching take effect in components.
- **REF-004**: [ADR-005-biome-lint-format.md](ADR-005-biome-lint-format.md) — Tailwind v4 reads the same CSS custom properties as the token system.
