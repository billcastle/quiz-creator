---
phase: 09
title: "Authentication"
status: pending
depends_on: ["PHASE-08"]
estimated_tickets: 5
---

# Phase 09 — Authentication

## Overview

This phase implements full authentication for Questify using Better-auth in the Hono backend and React frontend. It covers user registration (username + email + password), sign-in (by email OR username), session management, protected routes via TanStack Router's `beforeLoad`, and the auth middleware that secures API routes.

Better-auth is an open-source, self-hosted TypeScript authentication library that integrates directly with the existing Drizzle + D1 database stack. Unlike traditional JWT-based auth libraries, Better-auth manages sessions server-side and communicates via HTTP-only cookies, which eliminates the risk of token theft via XSS.

---

## Goals

- [ ] Better-auth server configured in `apps/api/src/lib/auth.ts` with Drizzle adapter, username plugin, and admin plugin
- [ ] Better-auth schema tables (sessions, accounts, verifications) added to packages/db and migrated
- [ ] Auth handler mounted at `/api/auth/**` in Hono
- [ ] Auth middleware validates sessions and attaches user to Hono context
- [ ] `requireAuth` and `requireAdmin` middleware guards working on all protected routes
- [ ] Better-auth client configured in `apps/web/src/lib/auth.ts`
- [ ] Zustand auth store created and wired to `useSession()`
- [ ] `/sign-in` page: email OR username + password, redirect after login
- [ ] `/sign-up` page: username + email + password with real-time validation
- [ ] TanStack Router `beforeLoad` guards on all protected routes
- [ ] CORS updated to allow credentials from frontend origin

---

## Monorepo Touch Points

| Package / App | Change |
|---|---|
| `packages/db` | New schema files: `sessions.ts`, `accounts.ts`, `verifications.ts`; new migration |
| `apps/api` | New `src/lib/auth.ts`; update `src/routes/auth.ts`; update `src/middleware/auth.ts` |
| `apps/web` | New `src/lib/auth.ts`; new `src/store/auth.store.ts`; new routes `sign-in.tsx`, `sign-up.tsx` |
| `packages/shared` | `UserRegistrationSchema` and `UserLoginSchema` already defined in PHASE-06; verified here |

---

## Technical Architecture

### Better-auth Overview for This Project

- **Library**: `better-auth` — open-source, self-hosted TypeScript authentication
- **Database integration**: Uses the Drizzle adapter (`better-auth/adapters/drizzle`) to store sessions, accounts, and verifications in the existing D1 (SQLite) database
- **Backend setup**: Configured once in `apps/api/src/lib/auth.ts`, then mounted as a Hono route handler
- **Frontend integration**: Uses `@better-auth/client` (actually `better-auth/react`) for typed, reactive API calls including `useSession()` hook
- **Plugins used**:
  - `username()` — enables sign-in with username in addition to email
  - `admin()` — enables role-based access control (`user` / `admin` roles)
- **Session transport**: HTTP-only cookies — no manual JWT handling, no `Authorization` header management needed
- **Email verification**: Disabled in Phase 09 (future phase)

---

### Better-auth Schema Integration

Better-auth generates its own set of database tables: `user`, `session`, `account`, and `verification`. These must co-exist carefully with the existing `users` table introduced in PHASE-07.

**Migration decision**: Use Better-auth's generated `user` table as the authoritative user record. The custom `users` table from PHASE-07 schema is superseded. Any additional application-specific fields (e.g., `username`, `role`) are declared as `additionalFields` in the Better-auth config, which instructs Better-auth to include them in the `user` table.

**New schema files to add to `packages/db/src/schema/`**:

| File | Purpose |
|------|---------|
| `sessions.ts` | Better-auth session table — stores session ID, userId, token, expiresAt, IP, user agent |
| `accounts.ts` | Better-auth account table — supports multiple credentials per user (email+password, future OAuth) |
| `verifications.ts` | Better-auth verification tokens — used for email verification, password reset (future phases) |

These schema files must be registered in the Drizzle adapter config passed to `betterAuth()`. The existing PHASE-07 Drizzle migration for `users` should be superseded by a new migration that drops the old table and creates Better-auth's tables.

---

### Backend Auth Configuration

**File**: `apps/api/src/lib/auth.ts`

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { admin } from 'better-auth/plugins'
import { db } from './db'
import { usersTable } from '@questify/db/schema/users'
import { sessionsTable } from '@questify/db/schema/sessions'
import { accountsTable } from '@questify/db/schema/accounts'
import { verificationsTable } from '@questify/db/schema/verifications'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: usersTable,
      session: sessionsTable,
      account: accountsTable,
      verification: verificationsTable,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  plugins: [
    username(),   // Enables POST /api/auth/sign-in/username
    admin(),      // Enables role field + admin-only routes
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7,  // 7 days
    },
  },
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        unique: true,
      },
      role: {
        type: 'string',
        default: 'user',
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // Phase 1: no email verification
  },
})
```

**Key config decisions**:
- `cookieCache.enabled` reduces DB round-trips on every request by caching session data in an encrypted cookie
- `requireEmailVerification: false` — users can sign in immediately after registration; email verification is deferred to a future phase
- `additionalFields.username` is marked `required: true` and `unique: true`, so the sign-up endpoint will reject requests missing a username
- The `admin` plugin adds `/api/auth/admin/**` routes for user management (list users, ban users, etc.)

---

### Mounting Better-auth in Hono

**File**: `apps/api/src/routes/auth.ts`

Better-auth exposes a standard `fetch`-compatible handler. In Hono, this is mounted by delegating the raw `Request` object:

```typescript
import { Hono } from 'hono'
import { auth } from '../lib/auth'

const authRouter = new Hono()

// Mount Better-auth handler at /api/auth/**
// Better-auth handles routing internally for all its endpoints
authRouter.on(['GET', 'POST'], '/**', (c) => {
  return auth.handler(c.req.raw)
})

export { authRouter }
```

Better-auth handles all routes under `/api/auth/` automatically, including:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/sign-up/email` | Register new user with email + password + username |
| `POST` | `/api/auth/sign-in/email` | Sign in with email + password |
| `POST` | `/api/auth/sign-in/username` | Sign in with username + password (via `username` plugin) |
| `POST` | `/api/auth/sign-out` | Clear session cookie |
| `GET` | `/api/auth/session` | Return current session and user data |
| `GET` | `/api/auth/get-session` | Alias for session retrieval |
| `POST` | `/api/auth/admin/**` | Admin-only user management (via `admin` plugin) |

In `apps/api/src/index.ts`, register the router:

```typescript
import { authRouter } from './routes/auth'
app.route('/api/auth', authRouter)
```

---

### Auth Middleware

**File**: `apps/api/src/middleware/auth.ts` (replaces the stub from PHASE-08)

```typescript
import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth'

// Attaches user to context if session is valid — does NOT block unauthenticated requests
export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session?.user) {
    c.set('user', {
      id: session.user.id,
      username: (session.user as any).username as string,
      email: session.user.email,
      role: (session.user as any).role ?? 'user',
    })
  }
  await next()
})

// Blocks unauthenticated requests with 401
export const requireAuth = createMiddleware(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// Blocks non-admin requests with 403
export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
```

`authMiddleware` is applied globally (or on all `/api/**` routes except `/api/auth/**`). `requireAuth` and `requireAdmin` are applied per-route as needed.

Hono context type augmentation (add to `apps/api/src/types/hono.d.ts`):

```typescript
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string
      username: string
      email: string
      role: 'user' | 'admin'
    } | undefined
  }
}
```

---

### Frontend Auth Client

**File**: `apps/web/src/lib/auth.ts`

```typescript
import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'
import { adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [usernameClient(), adminClient()],
})

// Named exports for convenience throughout the app
export const { signIn, signUp, signOut, useSession, getSession } = authClient
```

`useSession()` is a React hook that returns `{ data: session, isPending, error }`. It fetches session on mount and re-fetches when the window regains focus. This is the primary source of truth for session state in the frontend.

---

### Zustand Auth Store

**File**: `apps/web/src/store/auth.store.ts`

```typescript
import { create } from 'zustand'
import { signOut as betterAuthSignOut } from '../lib/auth'

interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  actions: {
    setUser: (user: User | null) => void
    clearAuth: () => void
    signOut: () => Promise<void>
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  actions: {
    setUser: (user) =>
      set({ user, isAuthenticated: !!user, isLoading: false }),

    clearAuth: () =>
      set({ user: null, isAuthenticated: false, isLoading: false }),

    signOut: async () => {
      await betterAuthSignOut()
      set({ user: null, isAuthenticated: false })
    },
  },
}))
```

**Note**: `useSession()` from Better-auth client is the reactive source for session state. The Zustand store is intentionally minimal — it is used for:
1. Caching the parsed user object for synchronous reads (e.g., in route guards without re-fetching)
2. Triggering global state updates after sign-in / sign-out
3. Sharing auth state to non-React contexts (e.g., TanStack Router loaders)

Initialize the store in `apps/web/src/main.tsx` by subscribing to `useSession()` changes and syncing to the store.

---

### Sign-in Page

**File**: `apps/web/src/routes/sign-in.tsx`

- **Route**: `/sign-in`
- **Layout**: Centered card, no top nav (or minimal nav with logo only)

Form fields:
- `identifier` — label: "Email or Username", placeholder: "you@example.com or your_username"
- `password` — label: "Password", type: password, with show/hide toggle

Client-side validation (using `UserLoginSchema` from `packages/shared`):
- `identifier`: required, non-empty string
- `password`: required, non-empty string

Submit logic:
```typescript
const onSubmit = async ({ identifier, password }) => {
  if (identifier.includes('@')) {
    await signIn.email({ email: identifier, password })
  } else {
    await signIn.username({ username: identifier, password })
  }
}
```

Post-submit behavior:
- **On success**: Read `redirect` query param; if present, navigate there; otherwise navigate to `/`
- **On error**: Display error message below the form: "Invalid email/username or password"
- **Network error**: Display "Something went wrong. Please try again."

Links:
- "Don't have an account? Sign up" → `/sign-up`
- "Forgot password?" → displayed as disabled/greyed with "(coming soon)"

Components used: `Card`, `CardHeader`, `CardContent`, `Input`, `Label`, `Button` from `packages/ui/shadcn`

---

### Sign-up Page

**File**: `apps/web/src/routes/sign-up.tsx`

- **Route**: `/sign-up`

Form fields:
- `username` — label: "Username"
- `email` — label: "Email address"
- `password` — label: "Password" with strength indicator
- `confirmPassword` — label: "Confirm password"

Client-side validation using `UserRegistrationSchema` + `confirmPassword` check:

| Field | Rules | Error message |
|-------|-------|---------------|
| username | 3–20 chars, `/^[a-zA-Z0-9_]+$/` | "3–20 characters, letters, numbers, underscores only" |
| email | valid email format | "Please enter a valid email address" |
| password | min 8 chars, ≥1 uppercase, ≥1 number | "Min 8 chars, 1 uppercase, 1 number" |
| confirmPassword | must match password | "Passwords do not match" |

**Real-time validation**: each field validates on `blur` event. Errors appear below each input. Password field shows a strength bar (Weak / Fair / Strong) based on entropy.

Submit logic:
```typescript
await signUp.email({
  email,
  password,
  name: username,   // Better-auth uses 'name' as display name
  username,         // additionalFields.username
})
```

Post-submit behavior:
- **On success**: User is automatically signed in. Redirect to `/`.
- **On error (username taken)**: Show error under username field: "This username is already taken"
- **On error (email taken)**: Show error under email field: "An account with this email already exists"
- **On general error**: Show banner at top of form

Links:
- "Already have an account? Sign in" → `/sign-in`

---

### Protected Routes — TanStack Router `beforeLoad`

Routes that require authentication define a `beforeLoad` function that checks session state before rendering:

```typescript
// Example: /create route
export const Route = createFileRoute('/create')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await getSession()
    if (!session?.user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
    return { user: session.user }
  },
  component: CreatePage,
})
```

**Routes requiring authentication** (beforeLoad redirect to `/sign-in`):

| Route | File |
|-------|------|
| `/create` | `routes/create.tsx` |
| `/builder/$id` | `routes/builder.$id.tsx` |
| `/profile` | `routes/profile.tsx` |
| `/profile/analytics` | `routes/profile.analytics.tsx` |

**Public routes** (no auth check):

| Route | Notes |
|-------|-------|
| `/` | Home feed — questionnaires browsable without login |
| `/sign-in` | Auth page |
| `/sign-up` | Auth page |
| `/q/$shareToken` | Take questionnaire — public by design |
| `/$username` | Public profile page |

Redirect-after-login: the `/sign-in` page reads `?redirect=` from the search params and navigates there after successful sign-in. TanStack Router's `search` param is typed via `validateSearch`.

---

### CORS Configuration Update

Since the web app runs on one origin (e.g., `http://localhost:5173` or `https://questify.app`) and the API on another (`http://localhost:8787` or `https://api.questify.app`), CORS must be configured to allow credentials. Update the CORS middleware from PHASE-08 in `apps/api/src/middleware/cors.ts`:

```typescript
import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,           // Required for cookies to be sent cross-origin
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})
```

**Critical**: `credentials: true` requires `origin` to be an exact string (or a function), NOT a wildcard `*`. Using `'*'` with credentials will cause browsers to block the request.

**Production cookie settings** (set in Better-auth config or via Hono response headers):
- `HttpOnly: true` — JavaScript cannot read the cookie (XSS protection)
- `SameSite: Lax` — cookie sent on top-level navigations, blocked on cross-site sub-requests (CSRF protection)
- `Secure: true` — only sent over HTTPS (production only; disable for localhost)
- `Domain`: if `questify.app` and `api.questify.app` are separate, set `Domain=questify.app` so the cookie is shared across subdomains

---

### Environment Variables

**Backend** (`wrangler.toml` secrets — do NOT commit to git):
```
BETTER_AUTH_SECRET=<minimum 32-character random string>
BETTER_AUTH_URL=http://localhost:8787
FRONTEND_URL=http://localhost:5173
```

In production:
```
BETTER_AUTH_URL=https://api.questify.app
FRONTEND_URL=https://questify.app
```

**Frontend** (`apps/web/.env.local`):
```
VITE_API_URL=http://localhost:8787
```

Generate `BETTER_AUTH_SECRET` with: `openssl rand -base64 32`

---

### Directory Structure

```
apps/api/src/
  lib/
    auth.ts              ← Better-auth server instance (NEW)
    db.ts                ← existing Drizzle DB instance
  routes/
    auth.ts              ← Updated: mounts Better-auth handler
  middleware/
    auth.ts              ← Updated: real session validation (replaces PHASE-08 stub)
    cors.ts              ← Updated: credentials: true
  types/
    hono.d.ts            ← ContextVariableMap with user type

apps/web/src/
  lib/
    auth.ts              ← Better-auth client instance (NEW)
  store/
    auth.store.ts        ← Zustand auth store (NEW)
  routes/
    sign-in.tsx          ← Sign-in page (NEW)
    sign-up.tsx          ← Sign-up page (NEW)
    create.tsx           ← Updated: add beforeLoad auth guard
    builder.$id.tsx      ← Updated: add beforeLoad auth guard
    profile.tsx          ← Updated: add beforeLoad auth guard

packages/db/src/schema/
  sessions.ts            ← Better-auth sessions table (NEW)
  accounts.ts            ← Better-auth accounts table (NEW)
  verifications.ts       ← Better-auth verifications table (NEW)
  index.ts               ← Updated: export new tables
```

---

## Implementation Steps

| Step | Description | Assignee |
|------|-------------|----------|
| 1 | Add Better-auth tables to `packages/db` schema (sessions, accounts, verifications). Generate and apply D1 migration. Resolve conflict with PHASE-07 `users` table. | Sage (Backend) |
| 2 | Configure Better-auth server in `apps/api/src/lib/auth.ts` with Drizzle adapter, `username` plugin, and `admin` plugin. Write unit tests for the config. | Sage (Backend) |
| 3 | Update auth middleware in `apps/api/src/middleware/auth.ts` to use `auth.api.getSession()`. Implement `requireAuth` and `requireAdmin` guards. Update CORS middleware to allow credentials. Mount auth router at `/api/auth/**` in Hono. | Sage (Backend) |
| 4 | Create Better-auth client in `apps/web/src/lib/auth.ts`. Create Zustand auth store. Wire `useSession()` to store initialization in `main.tsx`. | Nova (Frontend) |
| 5 | Build sign-in page (`/sign-in`) and sign-up page (`/sign-up`) with form validation, error handling, and redirect logic. Add `beforeLoad` guards to protected routes. | Nova (Frontend) |

---

## Tickets

| # | Title | Assignee | Effort |
|---|-------|----------|--------|
| 09-01 | Better-auth DB schema: sessions, accounts, verifications tables + D1 migration | Sage | M |
| 09-02 | Better-auth server configuration (auth.ts, username plugin, admin plugin, Drizzle adapter) | Sage | M |
| 09-03 | Auth middleware: session validation, requireAuth, requireAdmin, CORS credentials update | Sage | M |
| 09-04 | Frontend: Better-auth client, Zustand auth store, useSession initialization | Nova | S |
| 09-05 | Frontend: sign-in page, sign-up page, form validation, protected route beforeLoad guards | Nova | L |

---

## Acceptance Criteria

- `POST /api/auth/sign-up/email` creates user record with username and role fields, returns session cookie
- `POST /api/auth/sign-in/email` with valid email + password returns 200 and sets session cookie
- `POST /api/auth/sign-in/username` with valid username + password returns 200 (via `username` plugin)
- `GET /api/auth/session` returns current user object when a valid session cookie is present
- `POST /api/auth/sign-out` clears the session cookie and invalidates the server-side session
- `/sign-in` page accepts email or username in the identifier field
- `/sign-in` redirects to `?redirect` param destination or `/` after successful sign-in
- `/sign-up` page shows field-specific errors: username taken, email taken, password too weak
- `/sign-up` automatically signs in the user and redirects to `/` on success
- Navigating to `/create` while unauthenticated redirects to `/sign-in?redirect=/create`
- `authMiddleware` attaches `user` to Hono context for all authenticated requests
- `requireAuth` returns `401 Unauthorized` for requests without a valid session
- `requireAdmin` returns `403 Forbidden` for authenticated non-admin users
- TypeScript strict mode: zero type errors in all auth-related files across `apps/api` and `apps/web`
- CORS allows credentials from the frontend origin (no wildcard)

---

## Out of Scope (Future Phases)

- Email verification flow — future enhancement
- Password reset / forgot password — future enhancement
- OAuth providers (Google, GitHub) — future enhancement
- Two-factor authentication (2FA) — future enhancement
- Account deletion / GDPR data export — future enhancement
- Session management UI (view active sessions, revoke individual sessions) — future enhancement

---

## Phase Dependencies

- **PHASE-08 must be complete** because auth middleware replaces the stub from PHASE-08, and the Hono app structure must exist before mounting the Better-auth handler.
- **PHASE-07 must be complete** because the Drizzle D1 client and users table are prerequisites for the Better-auth Drizzle adapter.

---

## Agent Assignments

- **Architect:** Reviews auth configuration decisions (cookie settings, CORS policy, session duration). Approves the `users` table reconciliation strategy between PHASE-07 schema and Better-auth schema.
- **Dev/Sage (Backend):** Implements Better-auth server config, Drizzle adapter setup, schema migration (steps 1–3), auth middleware update.
- **Dev/Nova (Frontend):** Implements Better-auth client, Zustand auth store, sign-in page, sign-up page, and protected route `beforeLoad` guards (steps 4–5).
- **Dev/Milo (Visual/CSS):** Reviews sign-in and sign-up page layouts for consistency with design system.
- **QA/Ivy:** Tests all auth flows: registration, sign-in with email, sign-in with username, sign-out, protected route redirect, 401/403 responses.
- **DevOps/Axel:** Sets `BETTER_AUTH_SECRET` as a Wrangler secret. Confirms CORS origin env var is set for staging and production environments.
- **Remy (Producer):** Creates 5 tickets from implementation steps, tracks phase completion, coordinates Sage/Nova handoff.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Better-auth `users` table conflicts with PHASE-07 schema | High | High | Decision: let Better-auth own the `user` table; remove or alias PHASE-07's `users` table before migration |
| CORS + cookie credentials not working in cross-origin setup | Med | High | Test early with `localhost:5173` → `localhost:8787`; confirm `SameSite=Lax` + `credentials: true` works |
| Username plugin version incompatibility with Better-auth core | Low | Med | Pin versions; test username sign-in in isolation before full integration |
| Session not persisting across Wrangler dev server restarts | Med | Low | Expected behavior in dev; document workaround (sign in again); not a prod issue |
| Password hashing performance in edge runtime (Workers) | Low | Med | Better-auth uses bcrypt with low rounds; test latency; fallback to argon2 if needed |

---

## Estimated Effort

**Overall Phase Effort**: L (Large)

The bulk of the work is configuration and integration rather than custom logic. Better-auth handles the heavy lifting of session management, cookie security, and route handling. The most complex parts are:
1. Resolving the schema conflict between PHASE-07's `users` table and Better-auth's generated tables
2. Getting the CORS + cookie configuration right for cross-origin requests with credentials
3. Building robust form validation and error handling for the sign-in and sign-up pages
