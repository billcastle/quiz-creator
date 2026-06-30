---
title: "PATTERN: Per-request env factory"
status: "Established"
category: "Cloudflare Workers / API"
---

# PATTERN: Per-request env factory

Cloudflare Workers env bindings (`D1Database`, `KVNamespace`, secrets) are not available at module load time — they are injected per-request through the `fetch(request, env, ctx)` handler. Any service that depends on bindings must therefore be constructed *inside* a request handler, not at the module level.

---

## Problem

```ts
// ❌ WRONG — env is undefined at module init time
import { betterAuth } from 'better-auth'

const auth = betterAuth({
  database: drizzleAdapter(createDb(env.QUIZ_DB), { provider: 'sqlite' }), // ReferenceError
})

export default app
```

This fails silently or throws a `ReferenceError` at first request because `env` does not exist when the module is evaluated.

---

## Solution

Export a factory function that accepts `env` and returns the configured service instance. Call it once per request inside the Hono handler.

```ts
// apps/api/src/lib/auth.ts
export function createAuth(env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.QUIZ_DB), { provider: 'sqlite' }),
    secondaryStorage: {
      get: (key) => env.QUIZ_KV.get(key),
      set: (key, value, ttl) =>
        env.QUIZ_KV.put(key, value, ttl ? { expirationTtl: ttl } : undefined),
      delete: (key) => env.QUIZ_KV.delete(key),
    },
    emailAndPassword: { enabled: true },
    trustedOrigins: [env.CORS_ORIGIN],
  })
}

// apps/api/src/index.ts
app.all('/api/auth/**', (c) => {
  const auth = createAuth(c.env) // constructed here, inside the handler
  return auth.handler(c.req.raw)
})
```

---

## When to use

Apply this pattern to any service that requires one or more of: `D1Database`, `KVNamespace`, `R2Bucket`, or a secret (`string` binding) from `c.env`. This includes:

- Auth service (`createAuth`)
- Database client (`createDb` — already follows this pattern)
- Any future service wrapping a CF binding (email, AI, etc.)

---

## When NOT to use

Services with no dependency on CF bindings (pure utilities, Zod validators, route helpers) can be safely initialized at module level. The factory pattern adds a small allocation per request; don't use it unnecessarily.

---

## Known uses

- `apps/api/src/lib/auth.ts` — `createAuth(env)` called per request in the `/api/auth/**` handler
- `packages/db/src/index.ts` — `createDb(d1)` called per request in all Hono routes that touch D1

---

## References

- [ADR-002](ADR-002-hono-cloudflare-workers-api.md) IMP-002 — bindings injected through `c.env`
- [ADR-004](ADR-004-cloudflare-kv-sessions.md) IMP-002 — auth instance must not be created at module load time
