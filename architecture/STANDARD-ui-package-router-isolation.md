---
title: "STANDARD: UI Package Router Isolation"
applies_to: "All components in packages/ui"
status: "Active"
date: "2026-06-30"
authors: "Questify Architect"
enforced_by: "Code review checklist"
tags: ["standard"]
related_adrs: ["ADR-010-pathless-layout-route-groups.md"]
---

# STANDARD: UI Package Router Isolation

## Rule

> **Never import from `@tanstack/react-router` (or any other router library) inside `packages/ui`. All navigation must be received as callback props.**

## Rationale

`packages/ui` is a router-agnostic component library consumed by `apps/web`. If components inside the package import from `@tanstack/react-router`, the package acquires a hard dependency on one specific router, which has three failure modes:

1. **Testability breaks.** Unit-testing a component that calls `useNavigate()` requires a router provider wrapper, even when the test has nothing to do with navigation.
2. **Reusability is destroyed.** Any future app in this monorepo that uses a different router cannot consume the component without TanStack Router as a peer dependency.
3. **Package boundaries collapse.** Components begin encoding app-level route knowledge (which paths exist, what params they accept), coupling the shared library to the application.

See PATTERN-navigation-callback-props for the implementation technique.

## ✅ Correct

```typescript
// packages/ui/src/components/organisms/TopNav.tsx
// Navigation actions declared as callbacks — no router import
interface TopNavProps {
  onLogoClick: () => void
  onSignOut: () => void
  onHamburgerClick: () => void
}

export function TopNav({ onLogoClick, onSignOut, onHamburgerClick }: TopNavProps) {
  return (
    <header>
      <button type="button" onClick={onLogoClick}>Questify</button>
    </header>
  )
}
```

```typescript
// apps/web/src/layouts/AuthenticatedLayout.tsx
// Router import lives only in the app layer
import { useNavigate } from '@tanstack/react-router'
import { TopNav } from '@quiz/ui'

export function AuthenticatedLayout() {
  const navigate = useNavigate()
  return (
    <TopNav
      onLogoClick={() => navigate({ to: '/' })}
      onSignOut={handleSignOut}
      onHamburgerClick={() => setSideNavOpen(true)}
    />
  )
}
```

## ❌ Incorrect

```typescript
// packages/ui/src/components/organisms/TopNav.tsx
// Wrong — router import inside packages/ui creates a hard dependency
import { useNavigate } from '@tanstack/react-router'

export function TopNav() {
  const navigate = useNavigate()
  return (
    <header>
      <button type="button" onClick={() => navigate({ to: '/' })}>Questify</button>
    </header>
  )
}
```

## Enforcement

- **Code review:** Mandatory block — any PR touching `packages/ui/src/` that introduces an import whose specifier contains `react-router`, `tanstack/react-router`, `wouter`, `next/router`, or `next/navigation` is rejected until removed.
- **Tooling:** A Biome lint rule codifying this check is planned for a future ticket. Until then, the code review gate is the sole enforcement mechanism.

## Exceptions

No exceptions. If a component needs to reflect the current URL (e.g., active-link styling), the consuming layout reads `useRouterState()` and passes the result as a plain prop (e.g., `activePath: string`).

## References

- [PATTERN-navigation-callback-props.md](PATTERN-navigation-callback-props.md) — the implementation pattern this standard requires
- [ADR-010-pathless-layout-route-groups.md](ADR-010-pathless-layout-route-groups.md) — layout architecture that establishes the boundary
