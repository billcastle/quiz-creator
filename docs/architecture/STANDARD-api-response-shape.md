---
title: "STANDARD: API Response Shape"
applies_to: "Backend"
status: "Active"
date: "2026-06-26"
authors: "Architect"
enforced_by: "Code review checklist, TypeScript return types on Hono handlers"
tags: ["standard"]
related_adrs: ["ADR-006-backend-framework.md"]
---

# STANDARD: API Response Shape

## Rule

> **Every JSON response from the Hono API must use the `{ data: T }` envelope for success and `{ error: string, code: string }` envelope for errors.**

## Rationale

A consistent response envelope means every frontend caller can handle responses with the same pattern — no per-endpoint branching on response shape. The `data` key makes it unambiguous that the response payload is inside a wrapper (not a naked value). The `code` field on errors provides a machine-readable identifier that the frontend can switch on (e.g., `AUTH_INVALID_CREDENTIALS` triggers a "wrong password" message, not a generic error toast).

This was established in ADR-006 as part of the Hono API design. Inconsistent response shapes were identified as a primary source of frontend integration bugs in comparable projects — the envelope eliminates that class of bug entirely.

Additional rules enforced by this standard:

1. Successful responses: `{ data: T }` — the `T` type must be a named TypeScript type or Zod-inferred type.
2. Error responses: `{ error: string, code: string }` — `error` is human-readable, `code` is SCREAMING_SNAKE_CASE namespaced by domain.
3. HTTP status codes must be explicitly set — never rely on Hono's default.
4. No "naked" returns — `c.json(someValue)` without a wrapper is a review failure.
5. Pagination responses: `{ data: T[], meta: { total: number, page: number, pageSize: number } }`.
6. Error codes are domain-namespaced: `QUIZ_NOT_FOUND`, `AUTH_INVALID_CREDENTIALS`, `VALIDATION_FAILED`.
7. `201 Created` for resource creation, `422 Unprocessable Entity` for validation errors, `403 Forbidden` for authorization failures, `404 Not Found` for missing resources.

## ✅ Correct

```typescript
// Correct — success response with explicit status
app.get('/api/questionnaires/:id', async (c) => {
  const quiz = await db.query.questionnaires.findFirst({ where: eq(questionnaires.id, c.req.param('id')) });
  if (!quiz) return c.json({ error: 'Not found', code: 'QUIZ_NOT_FOUND' }, 404);
  return c.json({ data: quiz }, 200);
});

// Correct — paginated response with meta
app.get('/api/questionnaires', async (c) => {
  const quizzes = await db.query.questionnaires.findMany({ limit: pageSize, offset: page * pageSize });
  return c.json({ data: quizzes, meta: { total, page, pageSize } }, 200);
});

// Correct — creation with 201
app.post('/api/questionnaires', async (c) => {
  const quiz = await db.insert(questionnaires).values(input).returning();
  return c.json({ data: quiz[0] }, 201);
});
```

## ❌ Incorrect

```typescript
// Wrong — naked value with no envelope
app.get('/api/questionnaires/:id', async (c) => {
  const quiz = await db.query.questionnaires.findFirst(...);
  return c.json(quiz); // ← missing { data: ... } wrapper
});

// Wrong — no explicit status code on creation
app.post('/api/questionnaires', async (c) => {
  return c.json({ data: newQuiz }); // ← should be 201, not Hono's default 200
});

// Wrong — unnamespaced, lowercase error code
return c.json({ error: 'Not found', code: 'not_found' }, 404);
// ← should be QUIZ_NOT_FOUND (SCREAMING_SNAKE_CASE, domain-namespaced)
```

## Enforcement

- **Tooling:** Hono route handlers should be typed with an explicit response type using `c.json<{ data: QuizType }>(...)` — TypeScript will error if the return type doesn't match.
- **Code review:** checklist item — "Does every handler wrap its response in `{ data: T }` or `{ error, code }`? Is the HTTP status code explicit on every `c.json()` call?"
- **Build:** Phase 19 integration tests send requests to every endpoint and assert the envelope shape — a missing wrapper causes test failure that blocks deployment.

## Exceptions

The Better-auth handler mounted at `/api/auth/**` returns responses shaped by the Better-auth library. These are exempt from this standard as their shape is library-controlled and cannot be overridden without forking the library.

## References

- [ADR-006-backend-framework.md](ADR-006-backend-framework.md)
