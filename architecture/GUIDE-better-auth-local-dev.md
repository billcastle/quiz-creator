---
title: "GUIDE: Better Auth Local Dev Setup"
status: "Current"
audience: "Developers"
---

# GUIDE: Better Auth Local Dev Setup

End-to-end setup for running Better Auth locally. Covers all required env vars, how to verify each layer before adding the next, and how to debug `INVALID_ORIGIN`.

---

## How the pieces connect

```
Browser (localhost:5173)
  └─ fetch("/api/auth/sign-in/email")   ← relative URL, same-origin from browser's view
       └─ Vite proxy ──────────────────► Wrangler dev (localhost:8787)
                                              └─ Better Auth handler
                                                   ├─ validates Origin header
                                                   ├─ reads/writes D1 (user records)
                                                   └─ reads/writes KV (session tokens)
```

The browser never talks directly to port 8787 in dev. Vite's `/api` proxy forwards every auth request there and hands the response back. This keeps cookies same-origin (no `SameSite=None` or HTTPS required).

---

## Required configuration

Three files need values. Nothing else to touch.

### 1. `apps/api/.dev.vars`

Wrangler reads this file as local secrets for `wrangler dev`. Create it if it doesn't exist.

```
BETTER_AUTH_SECRET=<any random string, min 32 chars>
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:5173
```

**What each one does:**

| Variable | Value in dev | Why |
|---|---|---|
| `BETTER_AUTH_SECRET` | Any 32+ char random string | Signs session tokens. Use `openssl rand -hex 32` to generate one. |
| `BETTER_AUTH_URL` | `http://localhost:8787` | Tells Better Auth where **it** is running. Must match the wrangler dev port. Origin validation is derived from this. |
| `CORS_ORIGIN` | `http://localhost:5173` | The browser/frontend origin. Added to `trustedOrigins` so requests from the Vite dev server are accepted. |

> **The most common mistake:** setting `BETTER_AUTH_URL=http://localhost:5173`. That's the frontend URL — not where Better Auth runs. Better Auth runs in the Worker at `:8787`.

### 2. `apps/web/.env.local`

```
VITE_API_URL=
```

Leave `VITE_API_URL` **empty**. The auth client uses relative URLs (`/api/auth/...`), which the Vite proxy forwards to `:8787`. Setting it to `http://localhost:8787` would bypass the proxy, making it cross-origin and breaking cookies.

### 3. `apps/api/wrangler.toml` — no changes needed for dev

`CORS_ORIGIN` in `[vars]` is for static config. `.dev.vars` overrides it locally. The D1 and KV bindings are already wired up.

---

## Step-by-step setup

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Create `apps/api/.dev.vars`

```bash
# From repo root
cat > apps/api/.dev.vars << 'EOF'
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:5173
EOF
```

Or create the file manually with the values from the table above.

### Step 3 — Apply DB migrations

Better Auth needs four tables (`user`, `session`, `account`, `verification`) to exist before any auth request.

```bash
npm run db:migrate:local
```

Expected output: `Migrations applied successfully.` (or `No pending migrations.` if already applied.)

### Step 4 — Start the API

```bash
npm run dev:api
```

Wait until you see: `⎔ Starting local server...` or `Listening on http://localhost:8787`

### Step 5 — Verify the API is working (curl, no browser yet)

```bash
# Health check
curl http://localhost:8787/health
# Expected: {"status":"ok"}
```

```bash
# Create a test account — hit the Worker directly with the correct Origin header
curl -s -X POST http://localhost:8787/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}' | jq .
```

**Success looks like:**
```json
{
  "user": { "id": "...", "email": "test@example.com", ... },
  "session": { "token": "...", ... }
}
```

**If you see `INVALID_ORIGIN`:** the `Origin` header in the curl command (`http://localhost:5173`) does not match what's in `trustedOrigins`. Check that `CORS_ORIGIN=http://localhost:5173` is in `.dev.vars` and that wrangler was restarted after the file was created/changed.

```bash
# Sign in to verify session creation
curl -s -X POST http://localhost:8787/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -c /tmp/auth-cookies.txt \
  -d '{"email":"test@example.com","password":"password123"}' | jq .
```

```bash
# Check that the session cookie was stored and is valid
curl -s http://localhost:8787/api/auth/get-session \
  -H 'Origin: http://localhost:5173' \
  -b /tmp/auth-cookies.txt | jq .
# Expected: { "session": { ... }, "user": { ... } }
# Not: { "session": null }
```

### Step 6 — Start the web app and test in browser

```bash
# In a second terminal
npm run dev:web
```

Open `http://localhost:5173/sign-in`, fill in the credentials from step 5, and sign in. You should be redirected to `/`.

---

## Troubleshooting

### `INVALID_ORIGIN`

Better Auth rejected the request's `Origin` header.

**Most common cause — port mismatch:** Vite auto-increments its port when 5176 is in use (e.g. 5176 → 5177). `CORS_ORIGIN` is hardcoded, so they drift apart silently.

To diagnose: add a temporary `console.log` in the `/api/auth/**` handler and check the wrangler terminal when you sign in:
```ts
console.log('[auth]', { origin: c.req.header('origin'), CORS_ORIGIN: c.env.CORS_ORIGIN })
```
If `origin` and `CORS_ORIGIN` don't match, update `CORS_ORIGIN` in `.dev.vars` and `wrangler.toml [vars]` to match the actual Vite port.

`vite.config.ts` uses `strictPort: true`, so Vite will exit with an error instead of silently changing ports. If Vite fails to start, find and kill whatever is on the port:
```bash
lsof -ti:5176 | xargs kill
```

**Other causes:**
1. `BETTER_AUTH_URL` in `.dev.vars` must be `http://localhost:8787` (the wrangler port, not the Vite port).
2. **Restart `npm run dev:api`** after any `.dev.vars` change — wrangler only reads it on startup.
3. Test with the curl command in Step 5 to confirm the API layer is fixed before adding the browser.

### `No D1 tables found` / `table user does not exist`

Run `npm run db:migrate:local`. Migrations must be applied before the first auth request.

### `KV namespace not found`

For local dev, wrangler stores KV data in `.wrangler/state/`. The `id` and `preview_id` in `wrangler.toml` are remote Cloudflare IDs — they don't need to be valid for local dev. If wrangler logs a KV warning but still starts, it's safe to ignore during local dev.

### Session cookie not set after sign-in

`VITE_API_URL` must be empty in `apps/web/.env.local`. If it's set to `http://localhost:8787`, the auth client bypasses the Vite proxy, making cookies cross-origin. Cookies from a different origin/port are blocked by the browser's `SameSite=Lax` default.

### `Cannot find .dev.vars`

The file must be in `apps/api/.dev.vars` (same directory as `apps/api/wrangler.toml`). Wrangler looks for it relative to the wrangler.toml location.

---

## Production values

| Variable | How to set | Value |
|---|---|---|
| `BETTER_AUTH_SECRET` | `wrangler secret put BETTER_AUTH_SECRET` | Output of `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `wrangler secret put BETTER_AUTH_URL` | `https://api.tanong.com` (your Worker URL) |
| `CORS_ORIGIN` | `wrangler.toml [env.production] vars` | `https://tanong.com` (your Pages URL) |
| `VITE_API_URL` | Cloudflare Pages env var | `https://api.tanong.com` |

---

## References

- [ADR-002](ADR-002-hono-cloudflare-workers-api.md) — Hono on Cloudflare Workers
- [ADR-004](ADR-004-cloudflare-kv-sessions.md) — KV for session storage
- [PATTERN-per-request-env-factory](PATTERN-per-request-env-factory.md) — why `createAuth(env)` is a factory
- [GUIDE-adding-db-migration](GUIDE-adding-db-migration.md) — how to add new DB migrations
