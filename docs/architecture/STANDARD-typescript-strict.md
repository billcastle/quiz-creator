---
title: "STANDARD: TypeScript Strict Mode"
applies_to: "All"
status: "Active"
date: "2026-06-26"
authors: "Architect"
enforced_by: "TypeScript compiler (tsc --noEmit), CI build step"
tags: ["standard"]
related_adrs: ["ADR-001-frontend-framework.md", "ADR-010-toolchain.md"]
---

# STANDARD: TypeScript Strict Mode

## Rule

> **All TypeScript code in every workspace must compile with `strict: true` and zero errors.**

## Rationale

Strict mode enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, and `strictBindCallApply`. Without strict mode, TypeScript's type checker allows common runtime errors to slip through undetected — null dereferences, incorrect function signatures, and untyped variables that widen to `any`. The `noUncheckedIndexedAccess` option (which must also be enabled) prevents unchecked array index access, a common source of runtime `undefined` bugs.

The `any` type is a type-safety escape hatch that disables compiler checks on a value — its use is banned because every `any` in the codebase is a potential runtime error that TypeScript could have caught. Both ADR-001 (frontend framework selection, which chose TypeScript-first React) and ADR-010 (toolchain, which established `tsc` as the authoritative type checker) require strict compilation as a baseline.

Additional rules enforced by this standard:

1. `"strict": true` in all `tsconfig.json` files — no exceptions.
2. `"noUncheckedIndexedAccess": true` must be set — `arr[0]` returns `T | undefined`, not `T`.
3. Zero tolerance for the `any` type — use `unknown` with a type guard or Zod parse instead.
4. Type assertions (`as SomeType`) must include a comment explaining why the assertion is safe.
5. `@ts-ignore` is forbidden — `@ts-expect-error` is allowed only with a comment and a linked ticket.
6. All exported functions must have explicit return types — no inferred return types on public APIs.
7. Generics are preferred over `any` for reusable utilities.

## ✅ Correct

```typescript
// Correct — using unknown with Zod parsing
function parseResponse(raw: unknown): QuizResponse {
  return QuizResponseSchema.parse(raw);
}

// Correct — explicit return type on exported function
export function calculateScore(answers: Answer[]): number {
  return answers.filter(a => a.isCorrect).length;
}

// Correct — generic instead of any for reusable utility
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Correct — type assertion with safety comment
const canvas = document.getElementById('quiz-canvas') as HTMLCanvasElement;
// Safe: this element is created by QuizRenderer and is always a canvas
```

## ❌ Incorrect

```typescript
// Wrong — using any bypasses all type checking
function parseResponse(raw: any): any {
  return raw;
}

// Wrong — missing return type on exported function
export function calculateScore(answers: Answer[]) {
  return answers.filter(a => a.isCorrect).length;
}

// Wrong — @ts-ignore suppresses errors silently with no explanation
// @ts-ignore
const result = unsafeFunction();

// Wrong — type assertion without explanation
const el = document.getElementById('foo') as HTMLCanvasElement;
```

## Enforcement

- **Tooling:** `tsc --noEmit` runs in each workspace; CI executes `npm run typecheck --workspaces` as a required check that blocks merge on failure.
- **Code review:** checklist item — "Does this PR introduce `any`, `@ts-ignore`, or exported functions without explicit return types? Reject if yes."
- **Build:** `npm run build` calls `tsc` as a pre-step; the build fails if type errors exist, preventing deployment of untypechecked code.

## Exceptions

No exceptions. The `any` type may not be used even for third-party libraries that expose `any` — wrap such libraries in typed adapter functions that accept `unknown` and return a named type.

## References

- [ADR-001-frontend-framework.md](ADR-001-frontend-framework.md)
- [ADR-010-toolchain.md](ADR-010-toolchain.md)
