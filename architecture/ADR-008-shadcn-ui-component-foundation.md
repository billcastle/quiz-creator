---
title: "ADR-008: shadcn/ui as component foundation"
status: "Accepted"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["architecture", "decision", "design-system", "components"]
supersedes: ""
superseded_by: ""
---

# ADR-008: shadcn/ui as component foundation

## Context

QZ-0002 required a library of accessible, styled UI primitives to build upon. Requirements:

- Styleable via Tailwind utilities and CSS custom properties — no locked-in stylesheet.
- Extensible with custom variants (e.g., Badge `quiz`, `survey`, `exam`) without forking an external package.
- Accessible (ARIA attributes, keyboard nav) without Questify building this layer from scratch.
- No version lock-in: components must be modifiable without waiting for an upstream release.

| Library | Project-owned | Token-themeable | Extensible without fork |
|---|---|---|---|
| shadcn/ui | Yes (installed as files) | Yes | Yes |
| Radix UI (raw) | No (npm dep) | Yes | Requires wrapper components |
| Chakra UI v3 | No | Partial | No |
| Mantine | No | Partial | No |
| Custom from scratch | Yes | Yes | Yes |

## Decision

shadcn/ui is the base component library for Questify. Components are installed into `packages/ui/src/components/ui/` via `npx shadcn@latest add <name>`. Once installed, these files are owned by the project — checked into version control and freely editable. Custom atoms and molecules build on top of shadcn primitives. Shadcn components use Tailwind utilities and CSS custom properties, making them compatible with the file-based theme engine.

## Consequences

### Positive

- **POS-001**: Component source lives in the repo. Any contributor can extend, fix, or restyle a component without a pull request to an external project.
- **POS-002**: shadcn components are built on Radix UI primitives — correct ARIA roles, keyboard navigation, and focus management are inherited without building them from scratch.
- **POS-003**: Custom variants are trivially added by editing the `cva()` call in the installed file. See `packages/ui/src/components/ui/badge.tsx` for the `quiz`, `survey`, `exam` variant pattern.
- **POS-004**: Upgrading individual components is opt-in: re-run `npx shadcn@latest add <name>` to pull upstream changes, then diff and merge. No forced upgrades.

### Negative

- **NEG-001**: Components are duplicated into the repo rather than shared via npm. Upstream security fixes must be manually re-applied alongside any local customizations.
- **NEG-002**: `packages/ui/src/components/ui/` grows as a flat directory with no namespace separation between component families.
- **NEG-003**: Contributors unfamiliar with shadcn may not realize `ui/` files are editable, leading to unnecessary abstraction layers on top of already-installed components.

## Alternatives Considered

### Radix UI primitives directly (rejected)

- **ALT-001**: **Description**: Use Radix's accessible primitives directly and write all visual styling from scratch.
- **ALT-001**: **Rejection reason**: The accessibility cost (ARIA, keyboard nav, focus traps for modals/dropdowns) is prohibitive at QZ-0002 stage. shadcn's Radix foundation provides this layer today. Reconsider if Questify needs a fully bespoke design system rebuild.

### Chakra UI v3 (rejected)

- **ALT-002**: **Description**: A component library with its own style system.
- **ALT-002**: **Rejection reason**: Chakra ships a parallel style system that overlaps with Tailwind. Managing two style systems in one project creates confusion about which to use for new components.

### Custom components from scratch (rejected)

- **ALT-003**: **Description**: Build all components from scratch — full ownership, no dependencies.
- **ALT-003**: **Rejection reason**: Correct long-term for a product at scale, but accessibility implementation cost is high for a team at QZ-0002 scope. shadcn components can be rewritten incrementally if needed.

## Implementation Notes

- **IMP-001**: Installed components at QZ-0002: Button, Input, Badge, Checkbox, Avatar, Separator, Progress, Tabs, DropdownMenu.
- **IMP-002**: All installed files live in `packages/ui/src/components/ui/`. Treat them as project source, not vendor files.
- **IMP-003**: To add a new shadcn component: `npx shadcn@latest add <name>` from the repo root. Commit the resulting file.
- **IMP-004**: To add custom variants: edit the `cva()` call in the component file directly. See `badge.tsx` for the established pattern.
- **IMP-005**: All edits to installed shadcn files are subject to [STANDARD-design-token-styling](STANDARD-design-token-styling.md) — no hardcoded colors even in modified installed files.

## References

- **REF-001**: [ADR-006-file-based-theme-engine.md](ADR-006-file-based-theme-engine.md) — shadcn components inherit theme switching because they use `var(--color-*)` tokens.
- **REF-002**: [STANDARD-design-token-styling.md](STANDARD-design-token-styling.md) — applies to all edits to installed shadcn component files.
