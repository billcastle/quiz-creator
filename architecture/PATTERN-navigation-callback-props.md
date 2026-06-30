---
title: "PATTERN: Navigation Callback Props"
category: "UI"
status: "Established"
date: "2026-06-30"
authors: "Questify Dev Team"
tags: ["pattern"]
related_adrs: ["ADR-010-pathless-layout-route-groups.md"]
---

# PATTERN: Navigation Callback Props

## Intent

Expose navigation actions from `packages/ui` components as plain callback props so the component stays router-agnostic while the consuming layout wires the actual router calls.

## Motivation

`packages/ui` components must not import from `@tanstack/react-router` (STANDARD-ui-package-router-isolation). Yet navigation-triggering components like `TopNav` and `SideNav` inherently need to cause route changes. The Navigation Callback Props pattern resolves this: the component declares what navigations are possible via typed callback props, and the consuming layout in `apps/web` supplies the implementations using whatever router it has access to.

Without this pattern one of two bad outcomes occurs: the component imports a router and becomes untestable without a router context, or navigation bypasses React's data flow via imperative DOM events.

## Structure

```
packages/ui (TopNav, SideNav)
  └─ declares: onLogoClick, onNavigate, onSignOut, etc.
  └─ receives: activePath (string, computed by layout)
  └─ NO router imports

apps/web/src/layouts/AuthenticatedLayout.tsx
  └─ imports: useNavigate, useRouterState  ← router lives here
  └─ wires: () => navigate({ to: '/' }) as onLogoClick
  └─ wires: location.pathname as activePath
```

## Implementation

### Step 1 — Declare callback props in the packages/ui component

Name each prop `on[Action]`. For navigation to a dynamic destination, use `onNavigate: (path: string) => void`. Pass `activePath: string` (not a router object) for active-state styling.

### Step 2 — Wire the prop to the DOM event handler inside the component

The component calls `props.onLogoClick()` — it has no knowledge of routes.

### Step 3 — In the consuming layout, call useNavigate and pass closures

```typescript
// apps/web/src/layouts/AuthenticatedLayout.tsx
import { SideNav, TopNav } from '@quiz/ui'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { stubSignOut } from '../lib/auth-stub'

export function AuthenticatedLayout() {
  const navigate = useNavigate()
  const { location } = useRouterState()
  const [sideNavOpen, setSideNavOpen] = useState(false)

  function handleSignOut() {
    stubSignOut()
    navigate({ to: '/sign-in' })
  }

  function handleNavigate(path: string) {
    navigate({ to: path as never })
    setSideNavOpen(false)
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-base)]">
      <TopNav
        isAuthenticated
        onLogoClick={() => navigate({ to: '/' })}
        onSignOut={handleSignOut}
        onHamburgerClick={() => setSideNavOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <SideNav
            activePath={location.pathname}   {/* plain string, not router state */}
            onNavigate={handleNavigate}
            onCreateQuestionnaire={() => navigate({ to: '/questionnaire/new' })}
            onCreateSurvey={() => navigate({ to: '/survey/new' })}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

## When to Use

- A `packages/ui` component needs to trigger a route change.
- A `packages/ui` component needs to reflect the active route (e.g., highlight the current nav item).

## When NOT to Use

- Components internal to `apps/web` may use `useNavigate` directly — this pattern applies only to the shared `packages/ui` boundary.
- Do not model every interaction as a navigation callback if the component has no navigation concern; don't add `onNavigate` props speculatively.

## Known Uses in This Codebase

- [`packages/ui/src/components/organisms/TopNav.tsx`](../packages/ui/src/components/organisms/TopNav.tsx) — `onLogoClick`, `onSignOut`, `onHamburgerClick`
- [`packages/ui/src/components/organisms/SideNav.tsx`](../packages/ui/src/components/organisms/SideNav.tsx) — `onNavigate`, `onCreateQuestionnaire`, `onCreateSurvey`; receives `activePath`
- [`apps/web/src/layouts/AuthenticatedLayout.tsx`](../apps/web/src/layouts/AuthenticatedLayout.tsx) — wires `useNavigate` + `useRouterState` to both organisms

## Related Documents

- [STANDARD-ui-package-router-isolation.md](STANDARD-ui-package-router-isolation.md) — the standard this pattern implements
- [ADR-010-pathless-layout-route-groups.md](ADR-010-pathless-layout-route-groups.md) — layout architecture this pattern supports
