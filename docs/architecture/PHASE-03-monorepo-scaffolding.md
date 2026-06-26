---
phase: 03
title: "Monorepo Init & Project Scaffolding"
status: in-progress
depends_on: ["PHASE-01", "PHASE-02"]
estimated_tickets: 6
---

# PHASE-03: Monorepo Init & Project Scaffolding

## Overview

This phase initializes the entire monorepo skeleton — all apps, packages, configs, and CI. No feature
code is written. After this phase, every developer (human or AI) can clone and run the project locally.
The repository will contain all workspace definitions, shared tooling configurations, and the base
directory structure required for all subsequent phases to build upon.

The goal is a fully wired-up monorepo where `npm install` works from root, every workspace compiles
with zero TypeScript errors on its empty/stub files, the linter runs cleanly, and both dev servers
(Vite and Wrangler) can be started with a single command. CI must also be green on the first push.

---

## Goals

- [ ] Root `package.json` defines all workspaces and all shared scripts
- [ ] Biome is installed and configured at root with the agreed formatter/linter rules
- [ ] Root `tsconfig.json` provides the strict base that all workspaces extend
- [ ] `apps/web` scaffolded with Vite + React 19 + TanStack Router + TanStack Query + Zustand
- [ ] `apps/api` scaffolded with Hono + Wrangler targeting Cloudflare Workers
- [ ] `packages/ui` scaffolded with Tailwind v4 and shadcn/ui placeholder setup
- [ ] `packages/db` scaffolded with Drizzle ORM + D1/SQLite driver and drizzle-kit scripts
- [ ] `packages/shared` scaffolded with Zod as its sole runtime dependency
- [ ] Internal packages are resolvable via `@quiz/*` path aliases in consuming workspaces
- [ ] `.env.template` lists every required environment variable with empty values
- [ ] GitHub Actions CI workflow passes lint, typecheck, and build jobs on push/PR to main
- [ ] All workspace `node_modules` are hoisted correctly via npm workspaces
- [ ] `npm run dev:web` starts the Vite dev server without errors
- [ ] `npm run dev:api` starts Wrangler dev without errors
- [ ] `npm run build` completes successfully for all packages and apps

---

## Technical Architecture

### Root Package Configuration

**File:** `package.json` (repository root)

```json
{
  "name": "quiz-creator",
  "private": true,
  "version": "0.0.0",
  "description": "Questify — AI-powered quiz creator",
  "engines": {
    "node": ">=20.0.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev:web & npm run dev:api",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:api": "npm run dev --workspace=apps/api",
    "build": "npm run build --workspaces --if-present",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit --project tsconfig.json && npm run typecheck --workspaces --if-present",
    "test": "playwright test"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@playwright/test": "^1.48.0",
    "typescript": "^5.6.0"
  }
}
```

Key rules:
- **No runtime dependencies** at the root. All dependencies are isolated to individual workspaces.
- The `dev` script uses `&` (background) so both servers start concurrently in the same terminal.
- `build` uses `--workspaces --if-present` so packages without a `build` script are skipped silently.
- `typecheck` runs the root tsconfig first (which covers root-level TS), then delegates to each workspace.

---

### Biome Configuration

**File:** `biome.json` (repository root)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "extends": ["biome:recommended"],
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".wrangler",
      "migrations",
      "*.config.js",
      ".next",
      "coverage"
    ]
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

Biome replaces both ESLint and Prettier. It is fast (Rust-native), opinionated, and configured once at
the root so every workspace inherits the same rules without per-package config files. `noExplicitAny`
is set to `error` to enforce strict typing throughout the codebase. Import organization is enabled so
imports are auto-sorted on format.

---

### TypeScript Configuration

**File:** `tsconfig.json` (repository root — base config)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@quiz/ui": ["packages/ui/src/index.ts"],
      "@quiz/ui/*": ["packages/ui/src/*"],
      "@quiz/db": ["packages/db/src/index.ts"],
      "@quiz/db/*": ["packages/db/src/*"],
      "@quiz/shared": ["packages/shared/src/index.ts"],
      "@quiz/shared/*": ["packages/shared/src/*"]
    }
  },
  "include": [],
  "references": [
    { "path": "./apps/web" },
    { "path": "./apps/api" },
    { "path": "./packages/ui" },
    { "path": "./packages/db" },
    { "path": "./packages/shared" }
  ]
}
```

Each workspace `tsconfig.json` must:
1. `"extends": "../../tsconfig.json"` (two levels up from `apps/*` or `packages/*`)
2. Override `lib` and `target` as appropriate (Workers need `WebWorker`, web needs `DOM`)
3. Declare its own `include` pattern (`["src/**/*"]`)
4. Override `paths` only if adding workspace-specific aliases

**Why `noUncheckedIndexedAccess`?** Array indexing returns `T | undefined` instead of `T`, forcing
every array access to check for undefined. This catches a large class of runtime errors at compile
time, which is critical for quiz answer/option arrays.

---

### apps/web Configuration

**File:** `apps/web/package.json`

```json
{
  "name": "@quiz/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@quiz/shared": "*",
    "@quiz/ui": "*",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-router": "^1.82.0",
    "better-auth": "^1.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

**File:** `apps/web/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@quiz/ui": resolve(__dirname, "../../packages/ui/src"),
      "@quiz/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
```

**File:** `apps/web/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/**/*", "vite.config.ts"]
}
```

**File:** `apps/web/src/main.tsx` (stub)

```typescript
import React from "react";
import ReactDOM from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <div>Questify — scaffolding complete</div>
  </React.StrictMode>,
);
```

**File:** `apps/web/index.html` — standard Vite HTML entry point referencing `src/main.tsx`.

---

### apps/api Configuration

**File:** `apps/api/package.json`

```json
{
  "name": "@quiz/api",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler build",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "typecheck": "tsc --noEmit",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    "@quiz/db": "*",
    "@quiz/shared": "*",
    "better-auth": "^1.2.0",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241224.0",
    "typescript": "^5.6.0",
    "wrangler": "^3.88.0"
  }
}
```

**File:** `apps/api/wrangler.toml`

```toml
name = "quiz-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
node_compat = true

[vars]
ENVIRONMENT = "development"

[[d1_databases]]
binding = "QUIZ_DB"
database_name = "quiz-db"
database_id = ""

[[kv_namespaces]]
binding = "QUIZ_KV"
id = ""
preview_id = ""

[env.staging]
name = "quiz-api-staging"

[env.production]
name = "quiz-api-production"
```

**File:** `apps/api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/**/*", "wrangler.toml"]
}
```

**File:** `apps/api/src/index.ts` (stub)

```typescript
import { Hono } from "hono";

type Bindings = {
  QUIZ_DB: D1Database;
  QUIZ_KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok", phase: "scaffolding" }));

export default app;
```

The `Bindings` type is defined inline in the stub but will be extracted to a shared `env.ts` in
PHASE-05. The `D1Database` and `KVNamespace` types come from `@cloudflare/workers-types`.

---

### packages/ui Configuration

**File:** `packages/ui/package.json`

```json
{
  "name": "@quiz/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./components/*": "./src/components/*/index.ts",
    "./lib/*": "./src/lib/*.ts",
    "./globals.css": "./src/globals.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc --declaration --emitDeclarationOnly --outDir dist"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "lucide-react": "^0.460.0",
    "sonner": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**File:** `packages/ui/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

**File:** `packages/ui/src/index.ts` (placeholder stub)

```typescript
// Component exports populated in PHASE-04
export {};
```

**File:** `packages/ui/components.json` (shadcn/ui config — populated fully in PHASE-04)

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

---

### packages/db Configuration

**File:** `packages/db/package.json`

```json
{
  "name": "@quiz/db",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./migrations": "./src/migrations"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply quiz-db --local",
    "db:migrate:prod": "wrangler d1 migrations apply quiz-db --remote",
    "db:studio": "drizzle-kit studio",
    "db:seed": "node --loader ts-node/esm src/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "@cloudflare/workers-types": "^4.20241224.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0",
    "wrangler": "^3.88.0"
  }
}
```

**File:** `packages/db/drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dbCredentials: {
    accountId: process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "",
    databaseId: process.env["D1_DATABASE_ID"] ?? "",
    token: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  },
  verbose: true,
  strict: true,
});
```

**File:** `packages/db/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/**/*", "drizzle.config.ts"]
}
```

**File:** `packages/db/src/index.ts` (stub — schema populated in PHASE-06)

```typescript
// Schema and query helpers populated in PHASE-06
export * from "./schema/index.js";
```

**File:** `packages/db/src/schema/index.ts` (stub)

```typescript
// Tables defined in PHASE-06
export {};
```

---

### packages/shared Configuration

**File:** `packages/shared/package.json`

```json
{
  "name": "@quiz/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./constants": "./src/constants/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

**File:** `packages/shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

**File:** `packages/shared/src/index.ts` (stub)

```typescript
export * from "./types/index.js";
export * from "./schemas/index.js";
export * from "./constants/index.js";
```

**File:** `packages/shared/src/types/index.ts` — placeholder, types defined in PHASE-05.

**File:** `packages/shared/src/schemas/index.ts` — placeholder, Zod schemas defined in PHASE-05.

**File:** `packages/shared/src/constants/index.ts` — placeholder.

`packages/shared` must never import from `apps/*` or other packages. It is the dependency floor.
`packages/db` may import from `packages/shared`. `apps/*` may import from all packages.

---

### Environment Variables

**File:** `.env.template` (committed to repo — `.env` is gitignored)

```dotenv
# ─── Better Auth ─────────────────────────────────────────────
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# ─── CORS ────────────────────────────────────────────────────
CORS_ORIGIN=

# ─── Cloudflare (production — use wrangler secret put in CI) ─
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# ─── D1 Database ─────────────────────────────────────────────
# Used by drizzle.config.ts for remote migrations only
D1_DATABASE_ID=

# ─── KV Namespace ────────────────────────────────────────────
KV_NAMESPACE_ID=

# ─── Local Development ───────────────────────────────────────
NODE_ENV=development
VITE_API_URL=http://localhost:8787
```

Copy `.env.template` to `.env` and fill in values before running locally. Production secrets are
injected via `wrangler secret put <NAME>` or GitHub Actions secrets — never committed.

---

### GitHub Actions CI

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint (Biome)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Run Biome check
        run: npx biome check . --reporter=github

  typecheck:
    name: Typecheck (TypeScript)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Typecheck all workspaces
        run: npm run typecheck

  build:
    name: Build (all workspaces)
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Build all packages and apps
        run: npm run build
      - name: Upload web build artifact
        uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: web-dist
          path: apps/web/dist
          retention-days: 7
```

The `build` job depends on `lint` and `typecheck` passing first. This prevents wasted build time on
a branch with lint errors. The web dist is uploaded as an artifact on main-branch pushes (for preview
deploys in a later phase).

---

### .gitignore

**File:** `.gitignore` (repository root)

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
.wrangler/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*

# Playwright
test-results/
playwright-report/

# Drizzle
drizzle/

# Coverage
coverage/
```

---

## Directory Structure

Everything created in this phase (no feature files):

```
quiz-creator/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   └── index.ts                  # Hono stub
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── web/
│       ├── src/
│       │   └── main.tsx                  # React stub
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   └── index.ts              # Empty stub
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared/
│   │   ├── src/
│   │   │   ├── constants/
│   │   │   │   └── index.ts              # Empty stub
│   │   │   ├── schemas/
│   │   │   │   └── index.ts              # Empty stub
│   │   │   ├── types/
│   │   │   │   └── index.ts              # Empty stub
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ui/
│       ├── src/
│       │   └── index.ts                  # Empty stub
│       ├── components.json
│       ├── package.json
│       └── tsconfig.json
├── .env.template
├── .gitignore
├── biome.json
├── package.json                          # Root — workspaces, scripts
├── playwright.config.ts                  # E2E test config (stub)
└── tsconfig.json                         # Root base tsconfig
```

Total new files: ~30. No feature logic in any of them.

---

## Implementation Steps

### Step 1 — Initialize Root `package.json` and Biome Config

**Assigned to: Axel**

1. Create root `package.json` with workspaces array, scripts, engines, and devDependencies
2. Run `npm install` to generate root `package-lock.json`
3. Create `biome.json` with formatter, linter, organizeImports, and files.ignore config
4. Verify `npx biome check .` runs without config errors on an empty repo
5. Commit: `chore: initialize root package.json and Biome config`

### Step 2 — Scaffold `apps/web` with Vite + React 19

**Assigned to: Nova**

1. Create `apps/web/package.json` with all dependencies listed above
2. Create `apps/web/vite.config.ts` with TanStack Router plugin, React plugin, path aliases
3. Create `apps/web/tsconfig.json` extending root with DOM libs
4. Create `apps/web/index.html` (standard Vite entry)
5. Create `apps/web/src/main.tsx` (stub render)
6. Run `npm install` from root to hoist deps
7. Verify `npm run dev:web` starts without errors
8. Commit: `feat(web): scaffold Vite + React 19 app`

### Step 3 — Scaffold `apps/api` with Hono + Wrangler

**Assigned to: Sage**

1. Create `apps/api/package.json` with Hono, Wrangler, better-auth, @cloudflare/workers-types
2. Create `apps/api/wrangler.toml` with D1 and KV bindings (empty IDs)
3. Create `apps/api/tsconfig.json` extending root with cloudflare types
4. Create `apps/api/src/index.ts` Hono stub with `/health` route
5. Run `npm install` from root
6. Verify `npm run dev:api` starts Wrangler dev on port 8787
7. Verify GET `/health` returns `{"status":"ok"}`
8. Commit: `feat(api): scaffold Hono + Wrangler Cloudflare Worker`

### Step 4 — Scaffold `packages/ui` (Tailwind v4, shadcn placeholder)

**Assigned to: Milo**

1. Create `packages/ui/package.json` with Radix UI, Tailwind v4, clsx, tailwind-merge, CVA
2. Create `packages/ui/tsconfig.json` extending root with DOM libs and JSX
3. Create `packages/ui/src/index.ts` (empty export stub)
4. Create `packages/ui/components.json` (shadcn config pointing at this package)
5. Create `packages/ui/src/globals.css` (empty — populated in PHASE-04)
6. Verify package is resolvable from `apps/web` via `@quiz/ui` alias
7. Commit: `feat(ui): scaffold @quiz/ui package with Tailwind v4 and shadcn config`

### Step 5 — Scaffold `packages/db` and `packages/shared`

**Assigned to: Sage**

1. Create `packages/db/package.json` with drizzle-orm, drizzle-kit, cloudflare types
2. Create `packages/db/drizzle.config.ts` pointing at D1 driver
3. Create `packages/db/src/schema/index.ts` and `packages/db/src/index.ts` stubs
4. Create `packages/db/tsconfig.json`
5. Create `packages/shared/package.json` with only `zod` as runtime dependency
6. Create `packages/shared/src/` directory structure with stub index files
7. Create `packages/shared/tsconfig.json`
8. Run `npm install` from root, verify both packages typecheck cleanly
9. Commit: `feat(db,shared): scaffold @quiz/db and @quiz/shared packages`

### Step 6 — Add CI Workflow, `.gitignore`, `.env.template`, Root `tsconfig.json`

**Assigned to: Axel**

1. Create root `tsconfig.json` with all strict flags and `@quiz/*` path aliases
2. Create `.github/workflows/ci.yml` with lint, typecheck, and build jobs
3. Create `.env.template` with all required env var names (empty values)
4. Create `.gitignore` covering node_modules, dist, .wrangler, .env, .DS_Store
5. Create `playwright.config.ts` stub for E2E (populated in PHASE-10)
6. Run full CI locally: `npm run lint && npm run typecheck && npm run build`
7. Commit: `chore: add CI workflow, tsconfig, env template, and gitignore`
8. Push to main — verify GitHub Actions passes all three jobs

---

## Tickets

| # | Title | Assigned | Effort | Step |
|---|-------|----------|--------|------|
| PHASE-03-T01 | Initialize root package.json and Biome config | Axel | S | Step 1 |
| PHASE-03-T02 | Scaffold apps/web with Vite + React 19 | Nova | M | Step 2 |
| PHASE-03-T03 | Scaffold apps/api with Hono + Wrangler | Sage | M | Step 3 |
| PHASE-03-T04 | Scaffold packages/ui with Tailwind v4 and shadcn config | Milo | S | Step 4 |
| PHASE-03-T05 | Scaffold packages/db and packages/shared | Sage | S | Step 5 |
| PHASE-03-T06 | Add CI workflow, .gitignore, .env.template, root tsconfig | Axel | S | Step 6 |

**Coordination:** Remy reviews each PR for workspace hygiene (no cross-package imports that violate
the dependency hierarchy), confirms CI passes, and gates PHASE-04 until all 6 tickets are merged.

---

## Acceptance Criteria

- [ ] `npm install` succeeds from root with no peer dependency warnings
- [ ] `npm run dev:web` starts Vite dev server on port 5173 without errors
- [ ] `npm run dev:api` starts Wrangler dev on port 8787 without errors
- [ ] `GET http://localhost:8787/health` returns `{"status":"ok","phase":"scaffolding"}`
- [ ] `npm run lint` runs Biome across all workspaces with no config errors
- [ ] `npm run typecheck` runs tsc with zero type errors across all workspaces
- [ ] `npm run build` completes successfully for all packages and apps
- [ ] `npm run format` formats all files without errors
- [ ] Internal packages are importable: `import {} from "@quiz/shared"` resolves in apps/web
- [ ] `.env.template` contains all required variable names
- [ ] GitHub Actions CI passes lint, typecheck, and build jobs on push to main
- [ ] `node_modules` at root is properly hoisted (no duplicate installs per workspace)
- [ ] No secrets or `.env` files are tracked in git

---

## Out of Scope

The following are explicitly excluded from this phase:

- Feature code of any kind (routes, components, API handlers beyond `/health`)
- Database schema definitions (PHASE-06)
- Authentication configuration (PHASE-07)
- Tailwind CSS variable definitions and design tokens (PHASE-04)
- shadcn/ui component installation (PHASE-04)
- TanStack Router route tree generation (PHASE-05)
- Drizzle migrations (PHASE-06)
- Deployment pipeline (PHASE-11)
- E2E test suite (PHASE-10)

---

## Estimated Effort

**L** — Six atomic tickets, all scaffolding/config. No logic to reason about, but workspace wiring
(path aliases, hoisting, tsconfig references, Wrangler bindings) has many interdependent parts that
must be verified together. Estimated 1–2 days for an AI team running tickets in parallel.
