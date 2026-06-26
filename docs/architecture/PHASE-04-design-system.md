---
phase: 04
title: "Design System & Theme"
status: pending
depends_on: ["PHASE-03"]
estimated_tickets: 4
---

# PHASE-04: Design System & Theme

## Overview

This phase establishes the visual foundation — design tokens, Tailwind CSS v4 configuration, dark mode,
shadcn/ui component installation, and a live design system documentation page. All subsequent UI work
builds on this foundation. No application pages or quiz-domain components are built in this phase;
only the primitive layer that every feature will consume.

After this phase, any developer or AI agent working on a feature page can import a Button, a Card, a
Dialog, or any other listed primitive from `@quiz/ui` and have it render correctly in both light and
dark mode with consistent Maia-style visual tokens.

---

## Goals

- [ ] `cn()` utility created at `packages/ui/src/lib/utils.ts` using `clsx` + `tailwind-merge`
- [ ] Tailwind v4 CSS variables defined for all semantic tokens in light and dark themes
- [ ] All CSS variables follow shadcn/ui naming conventions for full compatibility
- [ ] All listed shadcn components installed under `packages/ui/src/components/`
- [ ] All components exported from `packages/ui/src/index.ts`
- [ ] `ThemeProvider` component wraps the app and applies `dark` class to `<html>`
- [ ] `useTheme` hook provides `{ theme, setTheme, toggleTheme }`
- [ ] Dark mode preference persists in `localStorage`
- [ ] `prefers-color-scheme` media query respected on first visit (no localStorage entry)
- [ ] `/design-system` route in `apps/web` renders all tokens and component previews
- [ ] Zero TypeScript errors in `packages/ui`
- [ ] All components render in both light and dark modes without visual regressions

---

## Technical Architecture

### Maia Style Variant Characteristics

The Maia style is derived from the wireframes produced in PHASE-01/02 and defines the aesthetic
contract that all UI work must respect. Deviating from these characteristics requires an ADR.

**Core Aesthetic Principles:**

- **Clean and minimal** — generous whitespace, no decorative elements that do not carry information
- **Slate gray primary palette** — primary is not blue; it is slate-900 in light and slate-50 in dark
- **Consistent rounding** — `border-radius: 8px` (0.5rem) for inputs and buttons; `border-radius: 12px`
  (0.75rem) for cards and dialogs
- **Subtle elevation** — shadows are used sparingly; prefer `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
  over heavy drop shadows. Cards have a light border, not a heavy shadow.
- **Card-based layouts** — content is organized into cards with clear boundaries; no raw tables or
  bare content blocks without a container
- **Clean sans-serif typography** — Inter is preferred; Geist Sans is acceptable. System font stack
  is not acceptable for this project.
- **Muted borders** — borders use `--border` (slate-200 in light, slate-800 in dark), not stark black

**Color Philosophy:**
- Primary is used for the primary call-to-action button and active state indicators only
- Destructive (red) is reserved for irreversible delete actions
- Badge colors for quiz type labels: blue=Quiz, green=Survey, orange=Exam, purple=Poll
- Success and warning states use green-600 and amber-600 respectively

---

### Tailwind v4 CSS Variables

**File:** `packages/ui/src/globals.css`

Tailwind v4 uses CSS `@theme` to define design tokens directly in CSS. The variables below must be
defined so shadcn/ui components resolve them correctly at runtime.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", "Geist Sans", ui-sans-serif, system-ui, sans-serif;
  --radius: 0.5rem;
  --radius-card: 0.75rem;
}

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

**Why HSL?** shadcn/ui's generated components reference these variables via `hsl(var(--primary))`.
Keeping them in HSL format means all shadcn component code works without modification.

**Semantic token map:**

| Token | Light value | Dark value | Usage |
|-------|-------------|------------|-------|
| `--background` | white | slate-950 | Page background |
| `--foreground` | slate-900 | slate-50 | Body text |
| `--card` | white | slate-950 | Card backgrounds |
| `--primary` | slate-900 | slate-50 | Primary button bg, active nav |
| `--secondary` | slate-100 | slate-800 | Secondary button bg |
| `--muted` | slate-50 | slate-900 | Muted backgrounds, skeleton |
| `--muted-foreground` | slate-500 | slate-400 | Placeholder text, captions |
| `--accent` | slate-100 | slate-800 | Hover states |
| `--destructive` | red-500 | red-900 | Delete buttons, error states |
| `--border` | slate-200 | slate-800 | All borders |
| `--ring` | slate-900 | slate-300 | Focus ring |

---

### `cn()` Utility

**File:** `packages/ui/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

This is the single most-used utility in the entire UI layer. Every component uses it to merge
Tailwind classes without specificity conflicts. `tailwind-merge` understands Tailwind class
semantics (e.g., `p-4 p-2` → `p-2`) while `clsx` handles conditional class application.

All other utilities for the UI package live in `packages/ui/src/lib/` (e.g., `format-date.ts`,
`debounce.ts` if needed).

---

### shadcn/ui `components.json` Configuration

**File:** `components.json` (repository root, also referenced at `packages/ui/components.json`)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "packages/ui/tailwind.config.ts",
    "css": "packages/ui/src/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@quiz/ui/components",
    "utils": "@quiz/ui/lib/utils",
    "ui": "@quiz/ui/components",
    "lib": "@quiz/ui/lib",
    "hooks": "@quiz/ui/hooks"
  }
}
```

When running `npx shadcn add <component>`, it uses these aliases to install components into
`packages/ui/src/components/<name>/`. The component files are installed as-is and then re-exported
from `packages/ui/src/index.ts`.

---

### shadcn/ui Components to Install

Each component below must be installed, verified to TypeScript-compile, and exported from
`packages/ui/src/index.ts`. Components are installed via `npx shadcn add <name>`.

| Component | Install name | Path | Purpose |
|-----------|-------------|------|---------|
| Button | `button` | `src/components/button/` | Primary/secondary/ghost/destructive/outline variants. Used for every CTA and action. |
| Input | `input` | `src/components/input/` | Text input with consistent height and focus ring. Used in all forms. |
| Label | `label` | `src/components/label/` | Accessible form field labels. Always paired with Input, Select, etc. |
| Select | `select` | `src/components/select/` | Dropdown select built on Radix. Used for quiz type selector, difficulty. |
| Checkbox | `checkbox` | `src/components/checkbox/` | Used in multiple-select question types. |
| RadioGroup | `radio-group` | `src/components/radio-group/` | Used in single-choice question types. |
| Textarea | `textarea` | `src/components/textarea/` | Multiline input for question text, free-response answers. |
| Card | `card` | `src/components/card/` | Container for quiz cards, question cards, dashboard tiles. Exports: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter. |
| Badge | `badge` | `src/components/badge/` | Status labels. Variants used: default, secondary, destructive, outline. Custom variants added for quiz/survey/exam types. |
| Avatar | `avatar` | `src/components/avatar/` | User avatars in nav and quiz attribution. Exports: Avatar, AvatarImage, AvatarFallback. |
| Dialog | `dialog` | `src/components/dialog/` | Modal dialogs for confirm-delete, quiz settings, share. Exports: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter. |
| Sheet | `sheet` | `src/components/sheet/` | Side panels for filters, settings drawers. Exports: Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter. |
| Tabs | `tabs` | `src/components/tabs/` | Tab navigation for quiz builder sections (Questions / Settings / Preview). Exports: Tabs, TabsList, TabsTrigger, TabsContent. |
| Sonner (Toast) | `sonner` | `src/components/sonner/` | Toast notifications for save confirmations, errors, copy-link feedback. |
| Progress | `progress` | `src/components/progress/` | Progress bars in quiz taking flow (question X of Y). |
| Separator | `separator` | `src/components/separator/` | Visual dividers between sections. |
| Skeleton | `skeleton` | `src/components/skeleton/` | Loading state placeholders for cards and lists. |
| Switch | `switch` | `src/components/switch/` | Toggle for quiz settings (randomize questions, show results immediately). |

**Exports pattern in `packages/ui/src/index.ts`:**

```typescript
// Primitives
export { Button, type ButtonProps } from "./components/button/index.js";
export { Input } from "./components/input/index.js";
export { Label } from "./components/label/index.js";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/select/index.js";
export { Checkbox } from "./components/checkbox/index.js";
export { RadioGroup, RadioGroupItem } from "./components/radio-group/index.js";
export { Textarea } from "./components/textarea/index.js";

// Layout
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/card/index.js";
export { Separator } from "./components/separator/index.js";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs/index.js";

// Feedback
export { Badge, type BadgeProps } from "./components/badge/index.js";
export { Skeleton } from "./components/skeleton/index.js";
export { Progress } from "./components/progress/index.js";
export { Toaster } from "./components/sonner/index.js";

// Overlay
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "./components/dialog/index.js";
export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "./components/sheet/index.js";

// User
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar/index.js";
export { Switch } from "./components/switch/index.js";

// Utilities
export { cn } from "./lib/utils.js";
```

---

### Typography Scale

**Font loading** — Inter is loaded via CSS `@import` in `packages/ui/src/globals.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
```

For production builds, self-host via `fontsource` package to avoid Google Fonts network dependency:

```
npm install @fontsource-variable/inter --workspace=packages/ui
```

Then import `@fontsource-variable/inter` in `globals.css` instead.

**Type scale (defined as Tailwind v4 `@theme` tokens):**

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px / 0.75rem | Captions, metadata, timestamps |
| `text-sm` | 14px / 0.875rem | Secondary text, helper text, table cells |
| `text-base` | 16px / 1rem | Body text, form labels, button text |
| `text-lg` | 18px / 1.125rem | Card titles, section headings (small) |
| `text-xl` | 20px / 1.25rem | Page sub-headings |
| `text-2xl` | 24px / 1.5rem | Page headings (secondary) |
| `text-3xl` | 30px / 1.875rem | Page headings (primary) |
| `text-4xl` | 36px / 2.25rem | Hero text, quiz title on cover page |

**Font weight conventions:**

| Weight | Tailwind class | Usage |
|--------|---------------|-------|
| 400 | `font-normal` | Body text, descriptions |
| 500 | `font-medium` | Labels, secondary emphasis |
| 600 | `font-semibold` | Card titles, section headings, nav items |
| 700 | `font-bold` | Primary headings, CTA button text |

**Line height conventions:**

| Name | Value | Usage |
|------|-------|-------|
| `leading-tight` | 1.25 | Display headings |
| `leading-snug` | 1.375 | Sub-headings |
| `leading-normal` | 1.5 | Body text |
| `leading-relaxed` | 1.625 | Long-form descriptions, question text |

---

### Dark Mode Implementation

**Strategy:** CSS variables approach with class-based dark mode. The `dark` class on `<html>`
switches all tokens simultaneously via the `:root` / `.dark` variable definitions in `globals.css`.
No JavaScript theme-switching at the component level — components remain stateless.

**File:** `packages/ui/src/components/theme-provider/index.tsx`

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  resolvedTheme: "light" | "dark";
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "quiz-ui-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme | null) ?? defaultTheme;
  });

  const resolvedTheme: "light" | "dark" =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, toggleTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
```

**Integration in `apps/web/src/main.tsx`:**

```typescript
import { ThemeProvider } from "@quiz/ui";

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="questify-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
```

**`ThemeProvider` and `useTheme` are also exported from `packages/ui/src/index.ts`.**

**System preference listening:** On first visit (no localStorage), the `defaultTheme = "system"`
means `prefers-color-scheme` is checked. If the user explicitly sets a theme via toggle, their
preference overrides the system setting and is stored in `localStorage`.

---

### Design System Documentation Route

**File:** `apps/web/src/routes/design-system.tsx`

This route is for developer/AI reference only — it is not linked from the main navigation. It renders
all design tokens and every shadcn component in every meaningful variant state.

**Page structure:**

```
/design-system
├── Section: Colors
│   ├── Background colors (--background, --card, --muted)
│   ├── Foreground colors (--foreground, --muted-foreground, --primary)
│   ├── Border / ring colors
│   └── Semantic colors (destructive, ring, accent)
├── Section: Typography
│   ├── All text-{size} at font-normal, font-medium, font-semibold, font-bold
│   └── Leading / tracking examples
├── Section: Components
│   ├── Button (all variants: default, secondary, outline, ghost, destructive, link)
│   ├── Input (default, disabled, with error state)
│   ├── Label
│   ├── Select
│   ├── Checkbox (unchecked, checked, indeterminate)
│   ├── RadioGroup (2 options)
│   ├── Textarea
│   ├── Card (all sub-components)
│   ├── Badge (default, secondary, destructive, outline + custom quiz-type variants)
│   ├── Avatar (with image, with initials fallback)
│   ├── Dialog (trigger + content preview)
│   ├── Sheet (trigger + content preview)
│   ├── Tabs (3-tab example)
│   ├── Sonner (trigger toast button)
│   ├── Progress (at 25%, 50%, 75%, 100%)
│   ├── Separator (horizontal and vertical)
│   ├── Skeleton (card skeleton layout)
│   └── Switch (on and off)
└── Section: Dark Mode
    └── ThemeToggle component preview
```

**Color swatch rendering pattern:**

```typescript
function ColorSwatch({ variable, label }: { variable: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border border-border"
        style={{ backgroundColor: `hsl(var(${variable}))` }}
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">{variable}</p>
      </div>
    </div>
  );
}
```

---

## Directory Structure

Files created or significantly modified in this phase:

```
quiz-creator/
├── apps/
│   └── web/
│       └── src/
│           ├── main.tsx                            # ThemeProvider added
│           └── routes/
│               └── design-system.tsx              # New: living docs page
├── components.json                                # New: shadcn config (repo root)
└── packages/
    └── ui/
        ├── components.json                        # Updated: aliases finalized
        ├── src/
        │   ├── components/
        │   │   ├── avatar/
        │   │   │   └── index.tsx
        │   │   ├── badge/
        │   │   │   └── index.tsx
        │   │   ├── button/
        │   │   │   └── index.tsx
        │   │   ├── card/
        │   │   │   └── index.tsx
        │   │   ├── checkbox/
        │   │   │   └── index.tsx
        │   │   ├── dialog/
        │   │   │   └── index.tsx
        │   │   ├── input/
        │   │   │   └── index.tsx
        │   │   ├── label/
        │   │   │   └── index.tsx
        │   │   ├── progress/
        │   │   │   └── index.tsx
        │   │   ├── radio-group/
        │   │   │   └── index.tsx
        │   │   ├── select/
        │   │   │   └── index.tsx
        │   │   ├── separator/
        │   │   │   └── index.tsx
        │   │   ├── sheet/
        │   │   │   └── index.tsx
        │   │   ├── skeleton/
        │   │   │   └── index.tsx
        │   │   ├── sonner/
        │   │   │   └── index.tsx
        │   │   ├── switch/
        │   │   │   └── index.tsx
        │   │   ├── tabs/
        │   │   │   └── index.tsx
        │   │   ├── textarea/
        │   │   │   └── index.tsx
        │   │   └── theme-provider/
        │   │       └── index.tsx                  # New: ThemeProvider + useTheme
        │   ├── globals.css                        # Updated: full CSS variables
        │   ├── index.ts                           # Updated: all component exports
        │   └── lib/
        │       └── utils.ts                       # New: cn() utility
        └── tailwind.config.ts                     # New: Tailwind v4 config
```

---

## Implementation Steps

### Step 1 — shadcn init, CSS Variable Tokens, and `cn()` Utility

**Assigned to: Milo**

1. Run `npx shadcn init` from repository root, accepting `components.json` settings as specified
2. Write `packages/ui/src/globals.css` with all `--variable` definitions for `:root` and `.dark`
3. Create `packages/ui/src/lib/utils.ts` with the `cn()` function
4. Create `packages/ui/tailwind.config.ts` pointing at `globals.css`
5. Update `apps/web/vite.config.ts` to import `packages/ui/src/globals.css` in the entry
6. Verify all CSS variables render correctly by loading the app in both light and dark mode
7. Verify `cn("p-4", "p-2")` → `"p-2"` (tailwind-merge deduplication works)
8. Export `cn` from `packages/ui/src/index.ts`
9. Commit: `feat(ui): add CSS variable tokens, globals.css, and cn utility`

### Step 2 — Install All shadcn Components and Verify Package Exports

**Assigned to: Milo**

1. Run `npx shadcn add button input label select checkbox radio-group textarea card badge avatar`
2. Run `npx shadcn add dialog sheet tabs sonner progress separator skeleton switch`
3. Verify each component file is placed under `packages/ui/src/components/<name>/`
4. Add all component exports to `packages/ui/src/index.ts` following the export pattern above
5. Run `npm run typecheck --workspace=packages/ui` — must pass with zero errors
6. Verify that `apps/web` can import `{ Button }` from `@quiz/ui` without errors
7. Commit: `feat(ui): install all shadcn components and wire up package exports`

### Step 3 — ThemeProvider and Dark Mode Implementation

**Assigned to: Nova**

1. Create `packages/ui/src/components/theme-provider/index.tsx` with `ThemeProvider` and `useTheme`
2. Export `ThemeProvider` and `useTheme` from `packages/ui/src/index.ts`
3. Update `apps/web/src/main.tsx` to wrap the app in `<ThemeProvider defaultTheme="system">`
4. Create a `ThemeToggle` component in `packages/ui/src/components/theme-provider/` that renders a
   sun/moon icon button calling `toggleTheme()`
5. Verify localStorage persistence: set to dark, reload — should still be dark
6. Verify system preference: clear localStorage, check with `prefers-color-scheme: dark` — dark mode
7. Verify `dark` class is applied to `<html>` not `<body>` (shadcn requires it on `<html>`)
8. Commit: `feat(ui): add ThemeProvider, useTheme hook, and dark mode toggle`

### Step 4 — Design System Documentation Route (`/design-system`)

**Assigned to: Nova**

1. Create `apps/web/src/routes/design-system.tsx` with all sections described above
2. Register the route in TanStack Router's route tree (or let the file-based router pick it up)
3. Add color swatches for all CSS variables in a responsive grid
4. Add typography examples for all text sizes and weights
5. Add component demonstrations with every variant of every installed component
6. Add a `ThemeToggle` button at the top of the page for easy light/dark switching during review
7. Verify the page renders without console errors in both light and dark mode
8. Verify no TypeScript errors: `npm run typecheck --workspace=apps/web`
9. Commit: `feat(web): add /design-system living documentation route`

---

## Tickets

| # | Title | Assigned | Effort | Step |
|---|-------|----------|--------|------|
| PHASE-04-T01 | shadcn init + CSS variable tokens + cn utility | Milo | S | Step 1 |
| PHASE-04-T02 | Install all shadcn components + verify package exports | Milo | M | Step 2 |
| PHASE-04-T03 | ThemeProvider + dark mode implementation | Nova | S | Step 3 |
| PHASE-04-T04 | Design system documentation route (/design-system) | Nova | M | Step 4 |

---

## Acceptance Criteria

- [ ] `cn("p-4", "p-2")` returns `"p-2"` (tailwind-merge works correctly)
- [ ] All CSS variables (`--background`, `--foreground`, `--primary`, etc.) are defined and render
      with correct colors in both light and dark mode
- [ ] `ThemeProvider` wraps `apps/web` — `useTheme` returns the correct resolved theme
- [ ] Setting theme to `"dark"` applies `dark` class to `<html>` element
- [ ] Refreshing the page after selecting dark mode still shows dark mode (localStorage persists)
- [ ] On first visit with no localStorage entry and `prefers-color-scheme: dark`, dark mode is active
- [ ] All 18 shadcn components listed above are installed under `packages/ui/src/components/`
- [ ] All components are importable from `@quiz/ui`: `import { Button, Card, Dialog } from "@quiz/ui"`
- [ ] `npm run typecheck --workspace=packages/ui` passes with zero errors
- [ ] `/design-system` route is accessible in `apps/web` and renders without console errors
- [ ] Color swatches, typography scale, and all component variants are visible on `/design-system`
- [ ] Both light and dark modes look visually correct on the `/design-system` page
- [ ] No broken imports or missing exports in `packages/ui/src/index.ts`

---

## Out of Scope

The following are explicitly excluded from this phase:

- Custom quiz-domain components (QuizCard, QuestionEditor, AnswerOption, etc.) — these are PHASE-05
- Application pages (dashboard, quiz builder, quiz taking) — later phases
- Business logic of any kind
- API integration or data fetching
- Authentication UI (login form, user menu) — PHASE-07
- Storybook or any other component workbench (not in project scope)
- Animation or transition definitions beyond what shadcn provides by default
- Custom icon library (use `lucide-react` which is already a shadcn dependency)
- Responsive layout primitives (grid, layout shell) — PHASE-05

---

## Estimated Effort

**M** — Four focused tickets. The CSS variable work and component installations are straightforward
but require careful verification that each component renders correctly in both themes. The design
system route requires building representative previews of every component, which is the most
time-intensive part. Estimated 1 day for an AI team running tickets in parallel, with careful review
of the `/design-system` page as a visual acceptance gate.
