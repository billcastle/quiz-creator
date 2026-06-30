---
title: "STANDARD: Design token styling"
applies_to: "All UI components in packages/ui and apps/web"
status: "Active"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["standard", "design-system", "theming"]
---

# STANDARD: Design token styling

## Rule

Always use CSS custom properties from the Questify token set (`var(--color-*)`) for all color values in component source. Never use hardcoded hex values, RGB/HSL literals, or Tailwind color palette utilities (e.g., `bg-blue-500`, `text-gray-900`) in component definitions.

## Rationale

The Questify theme engine overwrites CSS custom property values on `<html>` at runtime (see [ADR-006](ADR-006-file-based-theme-engine.md)). Any component that references a hardcoded color bypasses this mechanism — it will not respond when the user switches themes. A single hardcoded color in a component produces a visible artifact (wrong color) in every non-default theme.

The 17 tokens defined in `packages/ui/src/styles/globals.css` cover the full color vocabulary for Questify components. If a needed token does not exist, propose adding it to the token set — do not hardcode a value.

## Enforcement

**Primary — code review**: Every PR touching `packages/ui/src/components/` is reviewed for hardcoded color values. Reviewers must reject PRs that introduce `#`, `rgb(`, `hsl(`, or Tailwind palette class names (e.g., `-blue-`, `-gray-`, `-red-`) in component `className` strings or `style` props.

**Secondary — Biome linter**: When a Biome rule capable of detecting hardcoded color values in JSX `className` or `style` props becomes available, it will be added to `biome.json` as a required CI check.

## Correct Usage

```tsx
// Token via Tailwind arbitrary value
<div className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]">
  Content
</div>

// Token via inline style
<div style={{ color: 'var(--color-text-secondary)' }}>
  Muted text
</div>
```

## Incorrect Usage

```tsx
// WRONG — hardcoded hex
<div style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>

// WRONG — Tailwind palette utility (not a token)
<div className="bg-blue-500 text-white">

// WRONG — hardcoded RGB
<div className="bg-[rgb(26,26,26)]">
```

## Scope

**In scope** (this standard applies):
- All files in `packages/ui/src/components/` including shadcn-installed files in `ui/`
- All component JSX in `apps/web/src/` with inline styles or className props

**Out of scope** (intentionally exempt):
- `packages/ui/src/styles/globals.css` — defines token values using base color strings
- `packages/ui/src/themes/*.ts` — theme files define token values; raw colors are intentional here

## References

- **REF-001**: [ADR-006-file-based-theme-engine.md](ADR-006-file-based-theme-engine.md) — why tokens are the only reliable mechanism for theme-responsive styling.
- **REF-002**: [ADR-008-shadcn-ui-component-foundation.md](ADR-008-shadcn-ui-component-foundation.md) — installed shadcn components are project files and subject to this standard.
- **REF-003**: [PATTERN-file-based-theme.md](PATTERN-file-based-theme.md) — shows the full token map a theme must supply.
