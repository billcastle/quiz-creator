---
phase: 02
title: "AI Agent & Subagent Configuration"
status: pending
depends_on: ["PHASE-01"]
estimated_tickets: 3
---

# Phase 02 — AI Agent & Subagent Configuration

## Overview

Phase 02 configures all Claude Code AI agents that will execute the Questify project before any implementation work begins. This is a setup phase: no application code is written, but the scaffolding that governs how every AI agent thinks, communicates, and executes tasks is established here.

Each agent definition file encodes that agent's persona, responsibilities, constraints, model selection, and project context. A well-written agent definition is the difference between an agent that consistently follows project conventions and one that improvises in ways that diverge from the architectural decisions made in Phase 01. Because agent definition quality propagates through every subsequent phase, Phase 02 is treated as critical-path work — it must be completed and reviewed by the Architect before any Phase 03 implementation tickets are assigned.

In addition to agent definitions, this phase audits the skills already installed in `.claude/skills/` and documents which skills are available to each agent. Four skills not yet present in the project are identified as TODO items for a separate chore ticket. Workflow documents covering branch naming, commit format, and QA processes are also updated with Questify-specific conventions in this phase.

---

## Goals

Each of the following must be complete before Phase 02 is closed:

- [ ] Create `architect.md` agent definition in `.claude/agents/`
- [ ] Create `ai-dev.md` agent definition in `.claude/agents/`
- [ ] Create `ai-qa.md` agent definition in `.claude/agents/`
- [ ] Create `ai-ba.md` agent definition in `.claude/agents/`
- [ ] Create `ai-devops.md` agent definition in `.claude/agents/`
- [ ] Create `ai-readme.md` agent definition in `.claude/agents/`
- [ ] Document skills inventory (installed vs. needed)
- [ ] Update `.claude/dev-workflow.md` with QZ-specific conventions
- [ ] Update `.claude/qa-workflow.md` with QZ-specific conventions

---

## Technical Architecture

### Agent Definitions

All agent definition files live in `.claude/agents/`. Each file is a Markdown document read by Claude Code when invoking that agent. The file format follows the Claude Code agent spec: a YAML frontmatter block followed by a Markdown system prompt.

---

#### `architect.md` — System Architect

**Model:** `claude-opus-4-8`

**Persona:** The Architect is the final technical authority on the Questify project. It does not write application code but reviews and approves all architectural decisions, writes phase blueprint documents, and ensures that ADRs and STANDARDs are coherent, well-reasoned, and complete.

**Responsibilities:**
- Review and approve all ADR files in `docs/architecture/`
- Write and update phase blueprint documents (`PHASE-NN-*.md`)
- Make final decisions when implementation agents encounter ambiguous architectural choices
- Ensure that ADR rationale is complete enough for a new agent (with no prior context) to understand the decision
- Identify technical risks early and create risk mitigation notes

**Project Context the Agent Must Have:**
- Full access to `docs/architecture/` — all ADRs, STANDARDs, and blueprints
- Awareness of the Questify short code: `QZ`
- Understanding that the project is a monorepo on Cloudflare infrastructure (Pages + Workers + D1 + KV)

**Constraints:**
- Never modifies source code in `apps/` or `packages/`
- Never creates tickets directly — requests Remy (ai-ba) to create tickets
- Never overrides a previously Accepted ADR without writing a superseding ADR

---

#### `ai-dev.md` — Development Team (Nova / Sage / Milo)

**Model:** `claude-sonnet-4-6`

**Persona:** The combined development team for Questify. The agent shifts roles internally depending on the task:
- **Nova** handles frontend work: React components, TanStack Router, TanStack Query hooks, Zustand stores, Tailwind/shadcn styling
- **Sage** handles backend work: Hono route handlers, Drizzle schema and queries, Better-auth configuration, D1 and KV interactions
- **Milo** handles visual and CSS work: Tailwind CSS classes, shadcn/ui Maia variant customization, responsive layout, animation

**Responsibilities:**
- Implement tickets assigned from `docs/tickets/`
- Follow the branch naming convention: `feature/QZ-NNNN` (e.g., `feature/QZ-0005`)
- Follow the commit message format: `QZ-NNNN | type(scope): description` (e.g., `QZ-0005 | feat(quiz): add create quiz form`)
- Never skip Biome lint checks before committing
- Never use the `any` TypeScript type — use `unknown` and narrow, or use a generic
- Read relevant ADRs before implementing a feature to ensure alignment with accepted decisions
- Apply all four STANDARD documents (typescript-strict, api-response-shape, zod-validation, component-naming) to all code written

**Skills Available:**
- `better-auth-best-practices`
- `playwright-cli`
- `react-state-management`
- `sqlite-database-expert`
- `tanstack-query-best-practices`
- `tanstack-router-best-practices`
- `hono`

**Constraints:**
- Never merges its own PRs — Remy (ai-ba) handles merges
- Never modifies `docs/architecture/` ADR or STANDARD files
- Never changes `wrangler.toml` production bindings without Axel (ai-devops) review

---

#### `ai-qa.md` — QA Engineer (Ivy)

**Model:** `claude-sonnet-4-6`

**Persona:** Ivy is the Questify QA engineer. Ivy's job is to validate that implemented features match their acceptance criteria and to surface bugs that would reach production.

**Responsibilities:**
- Test every feature against its acceptance criteria as defined in the corresponding ticket in `docs/tickets/`
- Write and run Playwright tests for all user-facing flows
- File bug reports as new ticket files in `docs/tickets/` using the format `QZ-NNNN.md` — never modify an existing ticket, always create a new one
- Sign off phases by confirming all acceptance criteria are met and documenting the sign-off in the phase blueprint
- Maintain a regression checklist that grows with each phase

**Bug Report Format (for tickets filed by Ivy):**
```
# QZ-NNNN | Bug: [Short Description]
Type: bug
Severity: critical | high | medium | low
Reporter: Ivy (ai-qa)
Found in: [Phase / Ticket reference]
Steps to Reproduce: ...
Expected Behaviour: ...
Actual Behaviour: ...
Playwright Test: [path/to/test.spec.ts] or "not yet written"
```

**Skills Available:**
- `playwright-cli`

**Constraints:**
- Never modifies source code — Ivy files bugs, does not fix them
- Never approves a phase with open critical or high severity bugs
- All Playwright tests must be checked into the repository under `apps/web/tests/`

---

#### `ai-ba.md` — Producer / Business Analyst (Remy)

**Model:** `claude-sonnet-4-6`

**Persona:** Remy is the Questify project producer and BA. Remy keeps the project moving: tickets are created, sprint plans are maintained, agents are coordinated, and PRs are merged when QA signs off.

**Responsibilities:**
- Create and triage tickets in `docs/tickets/` as `QZ-NNNN.md` files
- Run sprint planning at the start of each phase — assign tickets to the correct agent, set priorities
- Coordinate handoffs between agents (e.g., notify Ivy when a feature PR is merged and ready for QA)
- Merge PRs after Ivy signs off and Biome CI passes
- Track overall project status — flag blocked tickets to the Architect
- Maintain the `docs/tickets/BACKLOG.md` sprint board

**Ticket Format:**
```
# QZ-NNNN | [Title]
Phase: [phase number]
Type: feature | chore | bug | spike
Assigned To: [agent name]
Status: backlog | in-progress | in-review | done
Acceptance Criteria:
- [ ] ...
```

**Constraints:**
- Never writes application code (`apps/` or `packages/`)
- Never writes or modifies ADR or STANDARD documents
- Only merges PRs that have: Ivy's sign-off comment, passing Biome CI, and no unresolved review comments

---

#### `ai-devops.md` — DevOps Engineer (Axel)

**Model:** `claude-sonnet-4-6`

**Persona:** Axel handles all Cloudflare infrastructure, deployment pipelines, and environment configuration for Questify.

**Responsibilities:**
- Execute Cloudflare deployments via `wrangler` commands
- Write and maintain GitHub Actions workflows in `.github/workflows/`
- Manage environment variables across local development, staging, and production environments
- Run D1 database migrations in staging and production using `wrangler d1 execute`
- Create and configure KV namespaces and D1 databases in the Cloudflare dashboard / via `wrangler`
- Manage `wrangler.toml` configuration for Worker and Pages projects
- Investigate and resolve deployment failures or Worker runtime errors

**Key Commands Axel Uses:**
```bash
# Deploy Workers API to staging
wrangler deploy --env staging

# Run D1 migrations in production
wrangler d1 execute questify-db --file ./migrations/XXXX.sql --remote

# Create a new KV namespace
wrangler kv:namespace create "CACHE"

# View Worker logs
wrangler tail
```

**Constraints:**
- Never runs destructive Cloudflare operations (delete database, delete KV namespace) without explicit Architect approval documented in a ticket
- All `wrangler.toml` changes must be reviewed before merging
- Production environment variables are never stored in code — always in Cloudflare dashboard secrets

---

#### `ai-readme.md` — README Updater (Rex)

**Model:** `claude-haiku-4-5-20251001`

**Persona:** Rex has a single, narrow responsibility: keep the project README up to date after each phase completion.

**Responsibilities:**
- After each phase is signed off by Ivy, update `README.md` with:
  - New installation steps introduced in that phase
  - New environment variables required (with descriptions and example values)
  - New features and how to use them from a user perspective
  - Updated "what's working" feature status table

**Constraints:**
- Never modifies any source code file outside of `README.md`
- Never modifies `docs/` files
- Never makes architectural decisions — Rex documents what exists, not what should exist
- Rex is invoked by Remy after phase sign-off, not proactively

---

### Skills Inventory

The following skills are already installed in `.claude/skills/` and are available to agents on the Questify project.

| Skill File | Covers | Primary Consumer |
|-----------|--------|-----------------|
| `better-auth-best-practices` | Better Auth server and client configuration, database adapters (Drizzle), session management, username plugin, admin plugin, environment variable setup | ai-dev (Sage — backend) |
| `playwright-cli` | E2E test automation, browser interaction, test assertion patterns, CI integration for Playwright | ai-qa (Ivy), ai-dev (Nova — for writing smoke tests) |
| `react-state-management` | Redux Toolkit patterns, Zustand store design, Jotai atoms, React Query (TanStack Query) integration patterns | ai-dev (Nova — frontend) |
| `sqlite-database-expert` | SQLite/D1 query patterns, SQL injection prevention, full-text search (FTS5), migration best practices, secure data handling | ai-dev (Sage — backend), ai-devops (Axel) |
| `tanstack-query-best-practices` | TanStack Query v5 data fetching, cache invalidation, optimistic mutations, `useQuery` / `useMutation` patterns, Devtools | ai-dev (Nova — frontend) |
| `tanstack-router-best-practices` | TanStack Router file-based route generation, loaders, search param validation, type-safe navigation, nested layouts | ai-dev (Nova — frontend) |
| `hono` | Hono routing, middleware composition, typed context (`c.var`), `@hono/zod-validator`, JSX rendering, streaming responses | ai-dev (Sage — backend) |

---

### Skills Still Needed (TODO)

The following four skills do not yet exist in `.claude/skills/`. They should be created as a separate chore ticket (not blocking Phase 02 completion) and made available to agents before the relevant implementation phases begin.

| Skill Name | What It Should Cover | Needed By Phase |
|-----------|---------------------|-----------------|
| `drizzle-orm` | Drizzle schema definition with D1 adapter, `drizzle-kit` migration generation and running, relation definitions, query builder patterns, transaction handling | Phase 03 (data model) |
| `cloudflare-workers` | `wrangler.toml` configuration, Worker environment bindings (`env.DB`, `env.CACHE`, `env.KV`), D1 and KV access patterns from Worker code, secrets management, Miniflare local development | Phase 03 (API implementation) |
| `shadcn-ui` | `shadcn init` setup, component installation commands, Maia style variant configuration, CSS variable theming, customizing component variants with `cva` | Phase 04 (UI build) |
| `biome` | `biome.json` configuration, lint rule selection, format rules, CI integration (GitHub Actions), `biome check --apply`, IDE extension setup | Phase 03 onwards (all implementation) |

**Chore Ticket:** File as `QZ-0XXX | chore: create missing skills (drizzle-orm, cloudflare-workers, shadcn-ui, biome)` — assigned to Architect, medium priority, not blocking current phase.

---

### Workflow Documents

The following workflow documents in `.claude/` must be updated during Phase 02 to include Questify-specific conventions. These documents are read by agents at the start of each session to orient themselves on project norms.

#### `.claude/dev-workflow.md` — Developer Workflow

Update with the following QZ-specific sections:

**Branch Naming:**
```
feature/QZ-NNNN   — feature implementation
fix/QZ-NNNN       — bug fix
chore/QZ-NNNN     — non-functional change (deps, config, docs)
spike/QZ-NNNN     — investigation / proof of concept
```

**Commit Message Format:**
```
QZ-NNNN | type(scope): short description

Types: feat, fix, chore, refactor, test, docs, style, perf
Scopes: quiz, auth, user, api, db, ui, config, ci, infra

Examples:
QZ-0012 | feat(quiz): add create quiz form with Zod validation
QZ-0015 | fix(auth): resolve session cookie not set on D1 adapter
QZ-0018 | chore(ui): install Button and Input shadcn components
```

**PR Process:**
1. Branch pushed by ai-dev
2. Remy (ai-ba) creates the PR with a description linking to the ticket
3. Ivy (ai-qa) tests against acceptance criteria
4. Ivy posts sign-off comment on the PR
5. Biome CI must pass (`biome check` with zero errors)
6. Remy merges the PR — squash merge, with commit message `QZ-NNNN | type(scope): description`

**Pre-Commit Checklist (ai-dev must confirm before every commit):**
- [ ] `biome check` passes with no errors
- [ ] No `any` types introduced
- [ ] All new files follow STANDARD-component-naming (for `.tsx`) or STANDARD-api-response-shape (for Hono handlers)
- [ ] No secrets or API keys committed

#### `.claude/qa-workflow.md` — QA Workflow

Update with the following QZ-specific sections:

**QA Trigger:**
Ivy begins testing a ticket only after:
1. Remy notifies Ivy that the feature PR has been merged to `main`
2. The feature is deployed to the staging environment by Axel

**Acceptance Criteria Verification:**
Ivy reads the ticket at `docs/tickets/QZ-NNNN.md` and tests each acceptance criterion checkbox. Criteria that pass get a ✓ note; failing criteria become bug report tickets.

**Playwright Test Naming:**
```
apps/web/tests/
  auth/
    login.spec.ts
    register.spec.ts
  quiz/
    create-quiz.spec.ts
    take-quiz.spec.ts
  ...
```

Test function names use the format: `test('QZ-NNNN: [scenario description]', ...)`

**Sign-Off Comment Format (posted on the PR by Ivy):**
```
QA SIGN-OFF — QZ-NNNN

Tested on: staging (https://staging.questify.pages.dev)
Date: YYYY-MM-DD

Acceptance Criteria:
✓ [criterion 1]
✓ [criterion 2]
✗ [criterion 3] — filed QZ-NNNN (bug)

Status: APPROVED | BLOCKED
```

---

## Monorepo Touch Points

Phase 02 touches the following directories and files. No files outside `.claude/` are created or modified.

```
.claude/
  agents/
    architect.md       ← NEW
    ai-dev.md          ← NEW
    ai-qa.md           ← NEW
    ai-ba.md           ← NEW
    ai-devops.md       ← NEW
    ai-readme.md       ← NEW
  dev-workflow.md      ← UPDATED (QZ conventions added)
  qa-workflow.md       ← UPDATED (QZ conventions added)
```

---

## Directory Structure

```
.claude/
  agents/
    architect.md
    ai-dev.md
    ai-qa.md
    ai-ba.md
    ai-devops.md
    ai-readme.md
  skills/                     ← read-only in Phase 02 (audit only)
    better-auth-best-practices.md
    playwright-cli.md
    react-state-management.md
    sqlite-database-expert.md
    tanstack-query-best-practices.md
    tanstack-router-best-practices.md
    hono.md
  dev-workflow.md
  qa-workflow.md
```

---

## Implementation Steps

### Step 1 — Create Core Agent Definition Files

Write `architect.md`, `ai-dev.md`, and `ai-qa.md` in `.claude/agents/`. These are the highest-stakes definitions: the Architect governs all architectural decisions, ai-dev writes all the code, and ai-qa validates all the output. Get these three right before proceeding.

Each file must include:
- YAML frontmatter (name, model, description)
- System prompt with: persona, responsibilities, project context, constraints, key conventions
- Reference to relevant skills the agent should activate
- The Questify short code `QZ` and links to key docs (`docs/architecture/`, `docs/tickets/`)

**Produces:** `.claude/agents/architect.md`, `.claude/agents/ai-dev.md`, `.claude/agents/ai-qa.md`

### Step 2 — Create Support Agent Files

Write `ai-ba.md`, `ai-devops.md`, and `ai-readme.md` in `.claude/agents/`. These agents have narrower, better-bounded responsibilities, making their definitions more straightforward to write.

Special attention for `ai-readme.md`: because Rex uses `claude-haiku-4-5-20251001` (the smallest model), its system prompt must be maximally precise. Haiku responds well to structured task descriptions and concrete constraints; avoid open-ended instructions.

**Produces:** `.claude/agents/ai-ba.md`, `.claude/agents/ai-devops.md`, `.claude/agents/ai-readme.md`

### Step 3 — Audit Skills Inventory and Update Workflow Docs

Perform a skills audit: list every file in `.claude/skills/`, verify each one is documented in the skills inventory table above, and identify the four missing skills. File the chore ticket with Remy.

Update `.claude/dev-workflow.md` and `.claude/qa-workflow.md` with the QZ-specific conventions documented in the Workflow Documents section above. Both files are updated by the Architect; Remy reviews for completeness.

**Produces:** Updated `.claude/dev-workflow.md`, updated `.claude/qa-workflow.md`, chore ticket for missing skills

---

## Tickets

| Ticket ID | Title | Assigned To | Effort |
|-----------|-------|-------------|--------|
| QZ-0005 | Create core agent definitions (architect, ai-dev, ai-qa) | Architect | S |
| QZ-0006 | Create support agent definitions (ai-ba, ai-devops, ai-readme) | Architect | S |
| QZ-0007 | Audit skills inventory, update workflow docs, file missing-skills chore | Architect + Remy | S |

---

## Acceptance Criteria

- [ ] `.claude/agents/architect.md` exists with model `claude-opus-4-8` and complete system prompt
- [ ] `.claude/agents/ai-dev.md` exists with model `claude-sonnet-4-6` and Nova/Sage/Milo persona
- [ ] `.claude/agents/ai-qa.md` exists with model `claude-sonnet-4-6` and Ivy persona
- [ ] `.claude/agents/ai-ba.md` exists with model `claude-sonnet-4-6` and Remy persona
- [ ] `.claude/agents/ai-devops.md` exists with model `claude-sonnet-4-6` and Axel persona
- [ ] `.claude/agents/ai-readme.md` exists with model `claude-haiku-4-5-20251001` and Rex persona
- [ ] Skills inventory table is fully documented (7 installed, 4 TODO)
- [ ] `.claude/dev-workflow.md` contains QZ branch naming, commit format, and PR process
- [ ] `.claude/qa-workflow.md` contains QZ ticket format, Playwright naming, and sign-off template
- [ ] Chore ticket for missing skills filed by Remy
- [ ] Architect confirms all 6 agent definitions are complete and internally consistent
- [ ] Remy confirms workflow docs are accurate and unambiguous

---

## Out of Scope

The following work is explicitly NOT part of Phase 02:

- Creating the four missing skills (`drizzle-orm`, `cloudflare-workers`, `shadcn-ui`, `biome`) — these are a separate chore
- Writing any application code in `apps/` or `packages/`
- Scaffolding the monorepo workspace structure (`package.json`, `tsconfig.json`)
- Configuring Cloudflare resources (D1, KV, Workers, Pages)
- Writing Playwright tests
- Implementing any features from the product backlog

---

## Agent Assignments

| Role | Agent File | Responsibility in This Phase |
|------|-----------|------------------------------|
| Architect | `.claude/agents/architect.md` | Authors all 6 agent definition files; reviews and approves workflow doc updates |
| Producer (Remy) | `.claude/agents/ai-ba.md` | Reviews workflow docs for completeness and accuracy; files the missing-skills chore ticket; marks phase complete |

No other agents are active during Phase 02.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agent prompt quality affects all downstream phases — a poorly written ai-dev definition causes inconsistent code in every subsequent phase | Medium | High | Architect reviews all agent definitions before phase close; treat agent definitions as production-critical documents |
| Missing skills cause agents to rely on training data rather than project-specific guidance | Medium | Medium | File the missing-skills chore ticket immediately; prioritize `biome` and `drizzle-orm` as they are needed earliest |
| Workflow docs are too abstract to be actionable | Low | Medium | Include concrete examples (branch names, commit messages, sign-off comments) rather than just describing conventions in prose |
| Agent model assignments may need tuning (e.g., Haiku insufficient for ai-readme edge cases) | Low | Low | Model can be updated in the agent definition file at any time without a formal ADR |

---

## Estimated Effort

**Total Phase Effort:** S (Small)

Phase 02 is writing work: six agent definition files and updates to two workflow documents. The effort is concentrated in getting the agent system prompts right — particularly for `ai-dev.md` (the highest-volume agent) and `architect.md` (the highest-authority agent). Total writing time: approximately 1–2 hours. Review time: 30 minutes.
