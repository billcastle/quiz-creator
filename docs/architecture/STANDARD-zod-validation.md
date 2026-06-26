---
title: "STANDARD: Zod Validation at API Boundaries"
applies_to: "Backend"
status: "Active"
date: "2026-06-26"
authors: "Architect"
enforced_by: "@hono/zod-validator middleware, code review checklist"
tags: ["standard"]
related_adrs: ["ADR-006-backend-framework.md", "ADR-008-database-orm.md"]
---

# STANDARD: Zod Validation at API Boundaries

## Rule

> **Every Hono route handler that accepts user input (request body, path params, query params) must validate that input with a Zod schema before any business logic executes.**

## Rationale

User input is an untrusted boundary. A Hono handler that accesses `c.req.json()` without prior Zod validation trusts the caller to provide the correct shape — this trust is never safe.

Zod validation at the handler boundary enforces three properties simultaneously: (a) invalid input is rejected with a `422 VALIDATION_FAILED` response before touching D1; (b) the validated value is typed by TypeScript, eliminating `as T` casts downstream; (c) the same Zod schema can be imported from `packages/shared` on the frontend for form validation, ensuring client and server enforce identical rules.

The Zod schema in `packages/shared` is the single source of truth for the API contract. This was established in ADR-006 (Hono backend framework design) and reinforced by ADR-008 (Drizzle ORM, whose insert types are derived from the same shared schemas).

Additional rules enforced by this standard:

1. Every handler that reads a request body must use `@hono/zod-validator` middleware — never call `c.req.json()` directly in a handler.
2. Path params and query params with business-logic implications must be validated with Zod (e.g., `z.string().uuid()` for an ID param).
3. All API input types in `packages/shared/src/schemas/` must be Zod schemas first; TypeScript types are derived with `z.infer<typeof Schema>`.
4. `.parse()` is used for startup-time config (throws on failure — fail fast); `.safeParse()` is used for user input (returns result object for graceful error responses).
5. The same schema must be importable from both `apps/web` and `apps/api` — no schema duplication.
6. Manual `as SomeType` casts on request data are forbidden; Zod provides the typed value.

## ✅ Correct

```typescript
// packages/shared/src/schemas/questionnaire.ts
export const CreateQuestionnaireSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['quiz', 'survey', 'exam']),
  description: z.string().max(500).optional(),
});
export type CreateQuestionnaireInput = z.infer<typeof CreateQuestionnaireSchema>;

// apps/api/src/routes/questionnaires.ts
import { zValidator } from '@hono/zod-validator';
import { CreateQuestionnaireSchema } from '@quiz/shared';

app.post(
  '/api/questionnaires',
  zValidator('json', CreateQuestionnaireSchema),
  async (c) => {
    const input = c.req.valid('json'); // fully typed — no cast needed
    const quiz = await db.insert(questionnaires).values(input).returning();
    return c.json({ data: quiz[0] }, 201);
  }
);
```

## ❌ Incorrect

```typescript
// Wrong — direct req.json() with no validation; body is untyped
app.post('/api/questionnaires', async (c) => {
  const body = await c.req.json(); // ← untrusted, unvalidated input
  const quiz = await db.insert(questionnaires).values(body as CreateQuestionnaireInput);
  return c.json({ data: quiz });
});

// Wrong — manual cast instead of zValidator middleware
app.post('/api/questionnaires', async (c) => {
  const body = (await c.req.json()) as CreateQuestionnaireInput; // ← forbidden cast
  const quiz = await db.insert(questionnaires).values(body).returning();
  return c.json({ data: quiz[0] }, 201);
});
```

## Enforcement

- **Tooling:** `c.req.valid('json')` only compiles if `zValidator('json', schema)` is registered as middleware for that route — TypeScript will error if the middleware is absent, making unvalidated access a compile-time failure.
- **Code review:** checklist item — "Does every handler that reads request data use `zValidator` middleware? Are there any `c.req.json()` calls without a preceding `zValidator`?"
- **Build:** Phase 19 integration tests send malformed request bodies to every mutation endpoint and assert `422 VALIDATION_FAILED` — a missing validator causes test failure that blocks deployment.

## Exceptions

Read-only GET handlers that accept no input beyond a plain string path param (e.g., `/:id`) may skip `zValidator` if the param is passed as-is to the database query without transformation. UUIDs, slugs, and any param used in business logic must still be validated with `z.string().uuid()` or equivalent.

## References

- [ADR-006-backend-framework.md](ADR-006-backend-framework.md)
- [ADR-008-database-orm.md](ADR-008-database-orm.md)
- [STANDARD-api-response-shape.md](STANDARD-api-response-shape.md)
