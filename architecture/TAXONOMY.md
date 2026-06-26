# Architecture & Documentation Taxonomy — Quiz Creator v2

> Single reference for all document types, file naming conventions, and process standards.  
> Every agent and developer reads this **before** creating or updating any project document.

---

## Project Identifiers

| Field | Value |
|---|---|
| Project name | Quiz Creator v2 |
| App brand | Questify |
| Project short code | **QZ** |
| Repository | `quiz-creatorv2` |
| Ticket prefix | `QZ-NNNN` (4-digit, zero-padded) |

---

## The Six Document Types

### Phase Blueprint

**When to create:** Before any implementation work begins on a phase. Describes the full technical specification an agent needs to implement the phase step-by-step.  
**Who creates:** Architect, reviewed by Producer (Remy).  
**Lifecycle:** `pending` → `in-progress` → `complete`  
**Key rule:** A phase blueprint must be `complete` before the next dependent phase starts. Do not split implementation across phases without a clear handoff contract.  
**File:** `docs/architecture/PHASE-NN-[slug].md`  
**Phase numbers:** 2-digit, zero-padded (01, 02, … 19)  
**Template:** [`architecture/templates/TEMPLATE-PHASE.md`](templates/TEMPLATE-PHASE.md)

---

### ADR — Architecture Decision Record

**When to create:** A binding technical decision has been made that constrains future work.  
**Who creates:** Architect, with input from team. Remy merges after review.  
**Lifecycle:** `Proposed` → `Accepted` | `Rejected` | `Superseded`  
**Key rule:** Once `Accepted`, an ADR is immutable. Amend only by creating a new ADR that supersedes it.  
**File:** `docs/architecture/ADR-NNN-[slug].md`  
**Template:** [`architecture/templates/TEMPLATE-ADR.md`](templates/TEMPLATE-ADR.md)

---

### RFC — Request for Comments

**When to create:** A significant design needs team input *before* a decision is locked. An RFC is a conversation starter, not a commitment.  
**Who creates:** Any team member. Architect or Remy promotes or closes it.  
**Lifecycle:** `Open` → `In Review` → `Accepted` (promotes to ADR) | `Rejected` | `Withdrawn`  
**Key rule:** Every accepted RFC must reference the ADR it produced. RFCs are never deleted — they are the paper trail.  
**File:** `docs/architecture/RFC-NNN-[slug].md`  
**Template:** [`architecture/templates/TEMPLATE-RFC.md`](templates/TEMPLATE-RFC.md)

---

### PATTERN — Engineering Pattern

**When to create:** A reusable solution to a *recurring class of problem* has been proven in the codebase. Do not write a PATTERN for something untested — patterns emerge from implementation, not wishful thinking.  
**Who creates:** Dev team. Sage/Nova write first draft; Architect marks `Established`.  
**Lifecycle:** `Draft` → `Established` → `Deprecated`  
**Key rule:** A PATTERN must include at least one real code example from this codebase — no pseudo-only patterns.  
**File:** `docs/architecture/PATTERN-[slug].md`  
**Template:** [`architecture/templates/TEMPLATE-PATTERN.md`](templates/TEMPLATE-PATTERN.md)

---

### STANDARD — Engineering Standard

**When to create:** A non-negotiable rule that all code must follow. If you find yourself writing the same rule in three different ADRs or code review comments, extract it as a STANDARD.  
**Who creates:** Architect, backed by an ADR or team agreement. Remy publishes.  
**Lifecycle:** `Active` → `Deprecated` | `Superseded`  
**Key rule:** Every STANDARD must name its enforcement mechanism (Biome rule, CI check, code review checklist). A rule that isn't enforceable is a wish, not a standard.  
**File:** `docs/architecture/STANDARD-[slug].md`  
**Template:** [`architecture/templates/TEMPLATE-STANDARD.md`](templates/TEMPLATE-STANDARD.md)

---

### GUIDE — Engineering Guide

**When to create:** Step-by-step instructions for a complex, recurring task that an agent or developer needs to execute correctly without rediscovering the steps.  
**Who creates:** Whoever knows the process best — dev team, DevOps, or QA.  
**Lifecycle:** `Current` → `Outdated` | `Draft`  
**Key rule:** Guides describe *how*, not *why*. If the document is mostly rationale, it's an RFC or ADR.  
**File:** `docs/architecture/GUIDE-[slug].md`  
**Template:** [`architecture/templates/TEMPLATE-GUIDE.md`](templates/TEMPLATE-GUIDE.md)

---

## Decision Tree: Which Document Do I Need?

```
Is this an implementation phase that needs a technical blueprint?
  YES → PHASE-NN-[slug].md

Is this a binding technical decision?
  YES → ADR

Is this a proposal you want feedback on before deciding?
  YES → RFC

Is this a proven reusable solution pattern from the codebase?
  YES → PATTERN

Is this a non-negotiable rule all code must follow?
  YES → STANDARD

Is this a step-by-step procedure for a complex task?
  YES → GUIDE
```

---

## File Naming Quick Reference

| Type | Prefix | Numbered? | Example |
|---|---|---|---|
| Phase Blueprint | `PHASE-` | Yes — 2-digit | `PHASE-03-monorepo-scaffolding.md` |
| ADR | `ADR-` | Yes — 3-digit | `ADR-001-tech-stack-frontend.md` |
| RFC | `RFC-` | Yes — 3-digit | `RFC-001-questionnaire-schema-design.md` |
| PATTERN | `PATTERN-` | No | `PATTERN-hono-route-factory.md` |
| STANDARD | `STANDARD-` | No | `STANDARD-typescript-no-any.md` |
| GUIDE | `GUIDE-` | No | `GUIDE-adding-drizzle-migration.md` |

**Slug rules:** lowercase · hyphen-separated · 3–5 words · no special characters

---

## Ticket Conventions

| Field | Rule |
|---|---|
| File path | `docs/tickets/QZ-NNNN.md` |
| Prefix | `QZ` (Quiz Creator) |
| Number format | 4-digit zero-padded: `QZ-0001` |
| Template | `docs/tickets/_template.md` |

**Get next ticket ID:**
```bash
ls docs/tickets/QZ-*.md 2>/dev/null | grep -oE 'QZ-[0-9]+' | sort -t- -k2 -n | tail -1
# Then increment by 1. If no tickets exist yet, start at QZ-0001.
```

---

## Branch Naming

```
feature/QZ-NNNN    ← new feature or phase story
fix/QZ-NNNN        ← bug fix (ticket created by Ivy)
chore/QZ-NNNN      ← tooling, docs, config
```

Re-branch naming for subsequent PRs on the same ticket:
```
feature/QZ-NNNN-v2   ← second PR for the same ticket
feature/QZ-NNNN-v3   ← third PR, etc.
```

---

## Commit Message Format

```
QZ-NNNN | type(scope): description
```

Examples:
```
QZ-0001 | chore(governance): add project taxonomy and phase blueprints
QZ-0012 | feat(auth): add better-auth sign-in with email and username
QZ-0042 | fix(builder): correct checkbox state on question reorder
QZ-0042 | fix(builder): correct checkbox state on question reorder (Closes QZ-0042)
```

**Rules:**
- Ticket ID is always first — no exceptions
- `type` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- Add `(Closes QZ-NNNN)` at the end of the last fix commit to auto-update ticket status
- **No ticket ID in the commit = the commit is invalid.** Remy will not merge the PR.

---

## PR Title Format

```
QZ-NNNN | type: brief description
```

Examples:
```
QZ-0001 | chore: project governance and phase blueprints
QZ-0012 | feat: better-auth sign-in with email and username
QZ-0042 | fix: checkbox state on question reorder
```

---

## Monorepo Structure

```
quiz-creatorv2/                         ← workspace root (all npm commands here)
  apps/
    web/                                ← @quiz/web — Vite + React 19 frontend (→ Cloudflare Pages)
    api/                                ← @quiz/api — Hono backend (→ Cloudflare Workers)
  packages/
    ui/                                 ← @quiz/ui — Design system (shadcn/Maia + Tailwind)
    db/                                 ← @quiz/db — Drizzle schema + Cloudflare D1 client
    shared/                             ← @quiz/shared — Shared types, Zod schemas, utils
  docs/                                 ← Project documentation
    architecture/                       ← Phase blueprints, ADRs, RFCs, PATTERNs, STANDARDs, GUIDEs
    tickets/                            ← QZ-NNNN.md wiki tickets
    ui/                                 ← Wireframes and design assets
    workflow/                           ← Process documentation
    devops/                             ← CI/CD and environment docs
  architecture/                         ← TAXONOMY.md and doc templates
  .claude/
    agents/                             ← Agent definition files
    skills/                             ← Skill files for technologies
  .agents/
    skills/                             ← Installed skill packages
```

**Cardinal placement rule:**
| What you're building | Where it lives |
|---|---|
| Primitive UI (Button, Input, Card) | `packages/ui/src/components/ui/` |
| Domain UI (QuizCard, QuestionBuilder) | `packages/ui/src/components/quiz/` |
| App-specific screen component | `apps/web/src/components/` |
| Hono route handler | `apps/api/src/routes/` |
| Drizzle schema + migration | `packages/db/src/` |
| Shared Zod schemas / types | `packages/shared/src/` |

---

## Agent File Naming

All agent definitions live in `.claude/agents/`.

| Agent | File | Model |
|---|---|---|
| Architect | `architect.md` | `claude-opus-4-8` |
| Dev Team (Nova/Sage/Milo) | `ai-dev.md` | `claude-sonnet-4-6` |
| QA (Ivy) | `ai-qa.md` | `claude-sonnet-4-6` |
| Producer/BA (Remy) | `ai-ba.md` | `claude-sonnet-4-6` |
| DevOps (Axel) | `ai-devops.md` | `claude-sonnet-4-6` |
| README Updater (Rex) | `ai-readme.md` | `claude-haiku-4-5-20251001` |

---

## Standards File Naming

Skills live in `.claude/skills/` (project-level) or `.agents/skills/` (installed packages).

| Technology | Skill Location |
|---|---|
| Hono | `.claude/skills/hono/SKILL.md` |
| Better Auth | `.agents/skills/better-auth-best-practices/SKILL.md` |
| TanStack Router | `.agents/skills/tanstack-router-best-practices/SKILL.md` |
| TanStack Query | `.agents/skills/tanstack-query-best-practices/SKILL.md` |
| Playwright | `.agents/skills/playwright-cli/SKILL.md` |
| React State (Zustand) | `.agents/skills/react-state-management/SKILL.md` |
| SQLite/D1 | `.agents/skills/sqlite-database-expert/SKILL.md` |

---

## Phase Registry

| Phase | Title | Status | Depends On |
|---|---|---|---|
| PHASE-01 | Tech Stack Selection & ADRs | pending | — |
| PHASE-02 | AI Agent & Subagent Configuration | pending | — |
| PHASE-03 | Monorepo Init & Project Scaffolding | pending | PHASE-01 |
| PHASE-04 | Design System & Theme | pending | PHASE-03 |
| PHASE-05 | Custom UI Components | pending | PHASE-04 |
| PHASE-06 | Data Modeling & Domain Design | pending | PHASE-01 |
| PHASE-07 | Database Schema & Migrations | pending | PHASE-06 |
| PHASE-08 | Backend API Foundation | pending | PHASE-03, PHASE-07 |
| PHASE-09 | Authentication | pending | PHASE-08 |
| PHASE-10 | Questionnaire Builder Feature | pending | PHASE-09, PHASE-05 |
| PHASE-11 | Quiz/Survey/Exam Taking Flows | pending | PHASE-10 |
| PHASE-12 | Results Pages | pending | PHASE-11 |
| PHASE-13 | Homepage Feed & Discovery | pending | PHASE-10, PHASE-05 |
| PHASE-14 | User Profile & Analytics | pending | PHASE-13 |
| PHASE-15 | Admin Analytics Dashboard | pending | PHASE-14 |
| PHASE-16 | Cloudflare Deployment | pending | PHASE-03, PHASE-08 |
| PHASE-17 | Internationalization & Accessibility | pending | PHASE-05 |
| PHASE-18 | Web Performance Enhancement | pending | PHASE-16 |
| PHASE-19 | Test Automation & E2E Testing | pending | PHASE-12 |

---

## ADR Registry

| # | Title | Status |
|---|---|---|
| *(none yet — populated from PHASE-01)* | — | — |

---

## RFC Registry

| # | Title | Status | Outcome |
|---|---|---|---|
| *(none yet)* | — | — | — |

---

## PATTERN Registry

| Title | Category | Status |
|---|---|---|
| *(emerge from Sprint 1+ implementation)* | — | — |

---

## STANDARD Registry

| Title | Applies To | Status |
|---|---|---|
| *(populated from PHASE-01 and PHASE-03)* | — | — |

---

## GUIDE Registry

| Title | Audience | Status |
|---|---|---|
| *(populated as processes are established)* | — | — |

---

## Maintenance

- **Remy (Producer)** updates the phase, ticket, and document registries after every sprint
- **Architect** reviews for gaps before each phase begins
- **All agents** read this file before creating any architecture or ticket document
- When a PATTERN is first created, add it to the registry; Architect marks it `Established` after code review confirms it works
- When an ADR is accepted, update this registry immediately
