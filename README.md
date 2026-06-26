# Questify — Quiz Creator v2

A full-stack questionnaire platform for creating and sharing quizzes, surveys, and exams. Users can build rich questionnaires with multiple question types, publish via shareable links, and track responses through analytics dashboards.

> **Status:** Planning / Architecture phase. No application code written yet. See [`docs/architecture/`](docs/architecture/) for implementation blueprints.

---

## Architecture Overview

| Package | Role | Deploy Target |
|---|---|---|
| `apps/web` | React 19 frontend — all user-facing pages | Cloudflare Pages |
| `apps/api` | Hono API — REST endpoints, auth, data | Cloudflare Workers |
| `packages/ui` | Design system — shadcn/Maia components, Tailwind tokens | (consumed by apps/web) |
| `packages/db` | Drizzle schema, D1 client, migrations | (consumed by apps/api) |
| `packages/shared` | Shared TypeScript types, Zod schemas | (consumed by all) |

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript, TanStack Router, TanStack Query, shadcn/ui (Maia), Tailwind v4, Zustand
- **Backend:** Hono, Better-auth, Drizzle ORM, Cloudflare D1 (SQLite), Cloudflare KV
- **Tooling:** npm workspaces, Biome (lint/format), TypeScript strict
- **Testing:** Playwright
- **Deployment:** Cloudflare Pages + Workers + D1

---

## Project Phases

| Phase | Title | Status |
|---|---|---|
| 01 | Tech Stack ADRs | pending |
| 02 | Agent Configuration | pending |
| 03 | Monorepo Scaffolding | pending |
| 04 | Design System | pending |
| 05 | UI Components | pending |
| 06 | Data Modeling | pending |
| 07 | Database Schema | pending |
| 08 | Backend API Foundation | pending |
| 09 | Authentication | pending |
| 10 | Questionnaire Builder | pending |
| 11 | Taking Flows | pending |
| 12 | Results Pages | pending |
| 13 | Homepage Feed | pending |
| 14 | User Profile & Analytics | pending |
| 15 | Admin Analytics | pending |
| 16 | Cloudflare Deployment | pending |
| 17 | i18n & Accessibility | pending |
| 18 | Performance | pending |
| 19 | Test Automation | pending |

Full blueprints: [`docs/architecture/`](docs/architecture/)

---

## Documentation

| Document | Purpose |
|---|---|
| [`architecture/TAXONOMY.md`](architecture/TAXONOMY.md) | Naming conventions for all project documents |
| [`docs/architecture/`](docs/architecture/) | Phase blueprints, ADRs, STANDARDs, GUIDEs |
| [`docs/tickets/`](docs/tickets/) | QZ-NNNN implementation tickets |
| [`docs/workflow/dev-workflow.md`](docs/workflow/dev-workflow.md) | Branch, commit, and PR process |
| [`docs/workflow/qa-workflow.md`](docs/workflow/qa-workflow.md) | QA testing process |
| [`docs/devops/ci-cd.md`](docs/devops/ci-cd.md) | GitHub Actions CI/CD pipelines |
| [`docs/devops/environments.md`](docs/devops/environments.md) | Environment setup and Cloudflare resources |

---

## Prerequisites

Before setting up locally (available after PHASE-03):

- **Node.js** ≥ 22
- **npm** ≥ 10
- **Wrangler CLI** — `npm install -g wrangler` then `wrangler login`
- **Cloudflare account** — free tier is sufficient for development

---

_This README is maintained by Rex (ai-readme agent) and updated at the end of each implementation phase._
