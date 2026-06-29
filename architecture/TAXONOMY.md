# Architecture Documentation Taxonomy

> The single reference for what kind of document to write, how to name it, and when to use it.  
> Every agent and developer reads this before creating or updating any architecture document.

---

## The Five Document Types

### ADR — Architecture Decision Record

**When to create:** A binding technical decision has been made that constrains future work.  
**Who creates:** Architect, with input from team. Remy merges after review.  
**Lifecycle:** `Proposed` → `Accepted` | `Rejected` | `Superseded`  
**Key rule:** Once `Accepted`, an ADR is immutable. Amend it only by creating a new ADR that supersedes it.  
**File:** `docs/architecture/ADR-NNN-[slug].md`  
**Template:** [`templates/TEMPLATE-ADR.md`](templates/TEMPLATE-ADR.md)

---

### RFC — Request for Comments

**When to create:** A significant design needs team input and review *before* a decision is locked. An RFC is a conversation starter, not a commitment.  
**Who creates:** Any team member. Architect or Remy promotes or closes it.  
**Lifecycle:** `Open` → `In Review` → `Accepted` (promotes to ADR) | `Rejected` | `Withdrawn`  
**Key rule:** Every accepted RFC must reference the ADR it produced. RFCs are never deleted — they are the paper trail.  
**File:** `docs/architecture/RFC-NNN-[slug].md`  
**Template:** [`templates/TEMPLATE-RFC.md`](templates/TEMPLATE-RFC.md)

```
RFC lifecycle:
  Open ──► In Review ──► Accepted ──► creates ADR-NNN
                    └──► Rejected
                    └──► Withdrawn
```

---

### PATTERN — Engineering Pattern

**When to create:** A reusable solution to a *recurring class of problem* has been proven in the codebase. Do not write a PATTERN for something untested — patterns emerge from implementation, not wishful thinking.  
**Who creates:** Dev team. Sage/Nova write the first draft; Architect marks `Established`.  
**Lifecycle:** `Draft` → `Established` → `Deprecated`  
**Key rule:** A PATTERN must include at least one real code example from this codebase — no pseudo-only patterns.  
**File:** `docs/architecture/PATTERN-[slug].md`  
**Template:** [`templates/TEMPLATE-PATTERN.md`](templates/TEMPLATE-PATTERN.md)

---

### STANDARD — Engineering Standard

**When to create:** A non-negotiable rule that all code must follow. If you find yourself writing the same rule in three different ADRs or code review comments, extract it as a STANDARD.  
**Who creates:** Architect, backed by an ADR or team agreement. Remy publishes.  
**Lifecycle:** `Active` → `Deprecated` | `Superseded`  
**Key rule:** Every STANDARD must name its enforcement mechanism (ESLint rule, CI check, code review checklist). A rule that isn't enforceable is a wish, not a standard.  
**File:** `docs/architecture/STANDARD-[slug].md`  
**Template:** [`templates/TEMPLATE-STANDARD.md`](templates/TEMPLATE-STANDARD.md)

---

### GUIDE — Engineering Guide

**When to create:** Step-by-step instructions for a complex, recurring task that an agent or developer needs to execute correctly without rediscovering the steps.  
**Who creates:** Whoever knows the process best — dev team, DevOps, or QA.  
**Lifecycle:** `Current` → `Outdated` | `Draft`  
**Key rule:** Guides describe *how*, not *why*. If the document is mostly rationale, it's an RFC or ADR.  
**File:** `docs/architecture/GUIDE-[slug].md`  
**Template:** [`templates/TEMPLATE-GUIDE.md`](templates/TEMPLATE-GUIDE.md)

---

## Decision: Which Type Do I Need?

```
Is this a binding technical decision?
  YES → ADR

Is this a proposal you want feedback on before deciding?
  YES → RFC

Is this a proven reusable solution pattern?
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
| ADR | `ADR-` | Yes — 3-digit | `ADR-007-offline-first-pwa.md` |
| RFC | `RFC-` | Yes — 3-digit | `RFC-001-offline-first.md` |
| PATTERN | `PATTERN-` | No | `PATTERN-offline-operation-queue.md` |
| STANDARD | `STANDARD-` | No | `STANDARD-money-integer-cents.md` |
| GUIDE | `GUIDE-` | No | `GUIDE-adding-db-migration.md` |

**Slug rules:** lowercase · hyphen-separated · 3–5 words · no special characters

---

## Current Document Registry

### ADRs

| # | Title | Status |
|---|---|---|
| ADR-001 | npm Workspaces Monorepo | Accepted |
| ADR-002 | Hono on Cloudflare Workers API | Accepted |
| ADR-003 | Drizzle ORM with Cloudflare D1 | Accepted |
| ADR-004 | Cloudflare KV for Session Storage | Accepted |
| ADR-005 | Biome for Linting and Formatting | Accepted |

### RFCs

| # | Title | Status | Outcome |
|---|---|---|---|
| *(none yet)* | — | — | — |

### PATTERNs

| Title | Category | Status |
|---|---|---|
| *(none yet)* | — | — |

### STANDARDs

| Title | Applies To | Status |
|---|---|---|
| *(none yet)* | — | — |

### GUIDEs

| Title | Audience | Status |
|---|---|---|
| *(none yet)* | — | — |

---

## Maintenance

- **Remy (Producer)** updates this registry after every sprint
- **Architect** reviews for gaps before each sprint planning
- **All agents** read this file before creating any architecture document
- When a PATTERN is first created, add it to the registry; Architect marks it `Established` after code review confirms it works
