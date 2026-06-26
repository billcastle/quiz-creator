---
title: "ADR-004: UI Component Library — shadcn/ui (Maia Variant) + Tailwind CSS v4"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-004: UI Component Library — shadcn/ui (Maia Variant) + Tailwind CSS v4

## Context

Questify requires a consistent, accessible, and visually branded component set across the quiz builder, quiz-taking flow, results pages, and homepage feed. The brand aesthetic is clean and minimal. All interactive components — dialogs, dropdowns, tabs, tooltips — must be keyboard-accessible and ARIA-compliant without custom implementation effort on every component.

The team needs full ownership of component code. An upstream breaking change in a component library must not force an emergency production upgrade. The styling system must work with Vite (ADR-001) and must not conflict with the chosen approach of co-locating styles with components rather than relying on runtime CSS-in-JS.

## Decision

Use shadcn/ui with the Maia style variant as the component foundation, and Tailwind CSS v4 for utility-first styling.

shadcn/ui's defining characteristic is that components are copied into the project repository via the `npx shadcn add` CLI — they are not imported from a versioned npm package. The team has full ownership of every component's markup and styles; no upstream version can break production. The Maia style variant provides a clean, minimal aesthetic appropriate for an educational quiz application. Radix UI primitives (which shadcn/ui wraps) provide accessible behavior — focus management, ARIA roles, keyboard navigation — without custom implementation. Tailwind CSS v4's CSS-first configuration (`@theme` in CSS files rather than `tailwind.config.js`) reduces config file proliferation and aligns with the framework's direction.

## Consequences

### Positive

- **POS-001**: Full component ownership — no risk of an upstream shadcn/ui update breaking Questify's UI; the team controls the component source and can update selectively
- **POS-002**: Radix UI primitives provide WCAG 2.1 AA keyboard navigation and ARIA compliance out of the box for all interactive components (Dialog, Select, Tabs, Tooltip, DropdownMenu)
- **POS-003**: Tailwind v4's `@theme` CSS custom properties enable runtime theming without JavaScript — dark mode, brand color overrides, and per-quiz custom accent colors are achievable via CSS variable reassignment

### Negative

- **NEG-001**: Updating to new shadcn/ui component versions requires manually re-running `npx shadcn add [component]` and reviewing diffs — there is no automatic update path; the team must proactively track upstream improvements
- **NEG-002**: Tailwind CSS v4 is newer than v3; some community plugins and tooling have not yet fully migrated, and certain utility patterns documented online reference the v3 `tailwind.config.js` API which does not apply
- **NEG-003**: Component files committed to the repository can diverge from the shadcn/ui defaults over time; a periodic review process is needed to decide which upstream improvements to adopt

## Alternatives Considered

### Radix UI Alone (Unstyled)

- **ALT-001**: **Description**: Use the Radix UI primitive components directly, without shadcn/ui's styling layer. All visual styles would be written from scratch using Tailwind utility classes.
- **ALT-001**: **Rejection reason**: shadcn/ui accelerates initial component setup by providing production-quality default styles and composition patterns for each Radix primitive. Writing equivalent styles from scratch would add significant effort during the early phases and would produce less consistent results than the Maia variant baseline.

### Material UI (MUI)

- **ALT-002**: **Description**: A complete React design system implementing Google's Material Design specification, with a large library of pre-built components.
- **ALT-002**: **Rejection reason**: MUI's styling system (Emotion) generates runtime CSS-in-JS that conflicts with Tailwind CSS v4's static extraction model. MUI's component API requires significant prop overrides to achieve a non-Material aesthetic, and the "Google Material" look does not fit the Questify brand direction. MUI is installed as a versioned npm package — the team does not own the component source.

### Chakra UI

- **ALT-003**: **Description**: A component library built on Emotion (runtime CSS-in-JS) with a props-based styling API.
- **ALT-003**: **Rejection reason**: Runtime CSS-in-JS conflicts with Tailwind CSS v4's static extraction approach — the two paradigms generate competing style sheets. Chakra UI's component ownership model (versioned npm package) carries the same upstream breaking-change risk that the team is explicitly avoiding.

## Implementation Notes

- **IMP-001**: shadcn/ui components live in `packages/ui/src/components/ui/`; domain-specific Questify components (quiz cards, answer options, progress bars) live in `packages/ui/src/components/quiz/`; naming rules are defined in `STANDARD-component-naming.md`
- **IMP-002**: Tailwind v4's `@theme` block defines all CSS custom properties (colors, spacing, typography, border-radius) in `packages/ui/src/globals.css` — no `tailwind.config.js` file is created or maintained; the `@tailwindcss/vite` plugin must be registered in `apps/web/vite.config.ts`
- **IMP-003**: Success criterion — all interactive shadcn/ui components (Button, Dialog, Select, Tabs, DropdownMenu) pass an axe accessibility scan with zero violations; keyboard navigation through a complete quiz-taking flow (Tab, Enter, Escape) works without mouse interaction

## References

- **REF-001**: `ADR-001-frontend-framework.md` — Tailwind CSS v4 requires the `@tailwindcss/vite` plugin registered in the Vite config
- **REF-002**: `STANDARD-component-naming.md` — all component file naming, export, and Props interface rules
- **REF-003**: https://ui.shadcn.com/docs/theming
