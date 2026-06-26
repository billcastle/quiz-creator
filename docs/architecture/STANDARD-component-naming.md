---
title: "STANDARD: React Component Naming Conventions"
applies_to: "Frontend"
status: "Active"
date: "2026-06-26"
authors: "Architect"
enforced_by: "Biome linter (useNamingConvention), code review checklist"
tags: ["standard"]
related_adrs: ["ADR-001-frontend-framework.md", "ADR-004-ui-component-library.md"]
---

# STANDARD: React Component Naming Conventions

## Rule

> **React component function names must use PascalCase, their file names must use kebab-case, and each non-trivial component must live in its own file.**

## Rationale

Consistent naming means any developer or AI agent can predict the file path of a component from its name and vice versa: `QuizCard` → `quiz-card.tsx`, always. This eliminates the cognitive overhead of remembering whether a project uses `QuizCard.tsx`, `quiz-card.tsx`, or `Quiz_Card.tsx`.

The "one component per file" rule prevents files from becoming grab-bags of unrelated components that are hard to locate and refactor. Page-level components carry the `Page` suffix so routing entry points are visually distinct from reusable components at a glance. These conventions were established in ADR-001 (React + TypeScript frontend) and reinforced by ADR-004 (shadcn/ui component library, which follows the same kebab-case file convention).

Additional rules enforced by this standard:

1. Component function names use PascalCase: `export function QuizCard(...)`, `export function EditQuestionModal(...)`.
2. Component file names use kebab-case: `quiz-card.tsx`, `edit-question-modal.tsx`.
3. The name is deterministic from the file — split on hyphens, capitalise each word.
4. The Props interface is named `[ComponentName]Props` and defined immediately before the component in the same file: `interface QuizCardProps { ... }`.
5. One component per file for all non-trivial components. Small private sub-components in the same file must be prefixed with underscore: `function _QuizCardBadge(...)`.
6. Page-level route components use the `Page` suffix: `QuizDetailPage`, `HomeFeedPage`.
7. Layout components use the `Layout` suffix: `AppLayout`, `BuilderLayout`.
8. Each feature directory exports from a barrel file `index.ts` — external imports use the barrel, not individual file paths.

## ✅ Correct

```typescript
// File: packages/ui/src/components/quiz/quiz-card.tsx

interface QuizCardProps {
  title: string;
  type: 'quiz' | 'survey' | 'exam';
  shareToken: string;
}

export function QuizCard({ title, type, shareToken }: QuizCardProps) {
  return <div>...</div>;
}

// Private sub-component in same file — underscore prefix signals non-export
function _QuizCardTypeBadge({ type }: { type: QuizCardProps['type'] }) {
  return <span>{type}</span>;
}
```

```typescript
// File: apps/web/src/routes/quiz/$shareToken.tsx (TanStack Router file-based route)

export function QuizTakingPage() {
  return <div>...</div>;
}
```

## ❌ Incorrect

```typescript
// Wrong — camelCase function name; React requires PascalCase
export function quizCard({ title }: QuizCardProps) {
  return <div>{title}</div>;
}

// Wrong — file named quiz_card.tsx (underscore) instead of quiz-card.tsx (hyphen)
// quiz_card.tsx ← must be quiz-card.tsx

// Wrong — Props interface not named [ComponentName]Props
interface CardData {
  title: string;
}
// ← should be QuizCardProps

// Wrong — multiple exported components in one file without underscore on private ones
export function QuizCard(...) { ... }
export function QuizCardTitle(...) { ... }
// ← QuizCardTitle should be _QuizCardTitle if it is private, or moved to its own file
```

## Enforcement

- **Biome:** The `useNamingConvention` rule in `biome.json` enforces PascalCase for exported React component functions — Biome CI check fails on violation.
- **Code review:** checklist item — "Does the file name (kebab-case) match the exported component name (PascalCase)? Is the Props interface named `[ComponentName]Props`?"
- **TanStack Router:** File-based routing enforces kebab-case file names for route files — the component exported from the file must follow PascalCase or the router build step will reject it.

## Exceptions

TanStack Router infrastructure files that use framework-specified prefixes (`__root.tsx`, `_layout.tsx`, `_authenticated.tsx`) are exempt — these filenames are dictated by TanStack Router conventions and are routing infrastructure, not reusable components. The components inside these files still follow PascalCase naming.

## References

- [ADR-001-frontend-framework.md](ADR-001-frontend-framework.md)
- [ADR-004-ui-component-library.md](ADR-004-ui-component-library.md)
