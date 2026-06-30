---
title: "PATTERN: File-based theme"
category: "Design System / Theming"
status: "Established"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["pattern", "design-system", "theming"]
---

# PATTERN: File-based theme

## Problem

The application supports multiple visual themes. Adding a new theme must not require modifying any existing file — no toggle component, no CSS file, no barrel export, no configuration constant.

## Solution

Create a new `.ts` file in `packages/ui/src/themes/`. The file must export a default object satisfying the `Theme` interface from `packages/ui/src/themes/types.ts`. `ThemeToggle` discovers all theme files via `import.meta.glob` and renders a swatch for each. Selecting a theme calls `applyTheme(theme)`, which writes each token value to `document.documentElement.style.setProperty()`.

No other file needs to change. The new theme appears in the toggle automatically on next build.

## Real Code Example

The complete source of `packages/ui/src/themes/dusk.ts`:

```typescript
import type { Theme } from './types'

export default {
  id: 'dusk',
  name: 'Dusk',
  swatches: ['#1a0f14', '#2a1c24', '#bcf8ec', '#e8f8f5', '#8b687f'],
  tokens: {
    '--color-bg-base': '#1a0f14',
    '--color-bg-surface': '#2a1c24',
    '--color-bg-subtle': '#3a2b34',
    '--color-border': '#8b687f',
    '--color-border-focus': '#aed9e0',
    '--color-text-primary': '#e8f8f5',
    '--color-text-secondary': '#aed9e0',
    '--color-text-disabled': '#8b687f',
    '--color-accent': '#bcf8ec',
    '--color-accent-hover': '#aed9e0',
    '--color-accent-fg': '#1a0f14',
    '--color-destructive': '#f28b8b',
    '--color-success': '#bcf8ec',
    '--color-warning': '#9fa0c3',
    '--color-quiz': '#9fa0c3',
    '--color-survey': '#aed9e0',
    '--color-exam': '#8b687f',
  },
} satisfies Theme
```

## Required Shape (`Theme` interface)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique kebab-case identifier (stored in localStorage) |
| `name` | `string` | Display name shown in `ThemeToggle` |
| `swatches` | `string[]` | Color dots shown in the toggle UI |
| `tokens` | `Record<string, string>` | All 17 CSS custom property names → values |

The `satisfies Theme` type assertion (not `as Theme`) lets TypeScript catch missing or misnamed tokens as compile errors.

## Steps to Apply

1. Copy an existing theme file: `cp packages/ui/src/themes/dusk.ts packages/ui/src/themes/ocean.ts`
2. Update `id` (unique kebab-case), `name`, and `swatches`.
3. Replace all 17 `tokens` values with the new palette colors.
4. Run `npm run typecheck` — missing tokens are compile errors.
5. Run `npm run dev:web`, open `/design-system`, select the new theme, verify all sections render correctly.
6. Commit only the new theme file — the diff should contain exactly one new file.

## Known Uses

| File | Notes |
|---|---|
| `packages/ui/src/themes/default.ts` | Light theme — baseline token values |
| `packages/ui/src/themes/dark.ts` | Dark theme |
| `packages/ui/src/themes/dusk.ts` | Dusk — deep plum/mint palette |

## Related Documents

- [ADR-006-file-based-theme-engine.md](ADR-006-file-based-theme-engine.md) — the decision behind this pattern.
- [GUIDE-adding-theme.md](GUIDE-adding-theme.md) — full operational guide with verification checklist.
- [STANDARD-design-token-styling.md](STANDARD-design-token-styling.md) — components must use `var(--color-*)` or theme switching has no effect.
