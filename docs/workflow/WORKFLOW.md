# Questify (Quiz Creator v3) — Agent Workflow Context

> Load this file at the start of any new session to restore full workflow context.
> It is the single source of truth for how the AI team operates.

---

## Project Overview

**Project:** Quiz Creator v3 — Questify  
**Ticket prefix:** `QZ` (4-digit zero-padded: `QZ-0001`)  
**Repo:** `quiz-creatorv3` (npm workspaces monorepo)

---

## Agent Roster

| Agent file | Persona | Role | Model |
|---|---|---|---|
| `ai-ba.md` | Remy (Producer) | Ticket creation, phase planning, PR merges, doc sync | sonnet |
| `ai-dev.md` | Nova / Sage / Milo | Feature implementation, bug fixes, all source code | sonnet |
| `ai-qa.md` | Ivy (QA) | Testing, Playwright E2E, sign-off documents, bug tickets | sonnet |
| `ai-devops.md` | Axel (DevOps) | CI/CD, Cloudflare deployment, infra config | sonnet |
| `architect.md` | Architect | ADRs, phase blueprints, architectural decisions | opus |
| `adr-generator.md` | Doc Generator | Creates ADR / RFC / PATTERN / STANDARD / GUIDE files | sonnet |
| `docs-updater.md` | Rex (Docs Updater) | Updates ADRs, STANDARDs, TAXONOMY, README after merges | sonnet |

**Main / orchestrating agent:** uses `claude-opus-4-8` model.

---

## The Four-Step Workflow

### Step 1 — Create a Ticket

**Trigger:** User provides requirements for a feature, fix, or change.  
**Owner:** Main agent or Remy (ai-ba).

1. Get the next ticket ID:
   ```bash
   ls docs/tickets/QZ-*.md 2>/dev/null | grep -oE 'QZ-[0-9]+' | sort -t- -k2 -n | tail -1
   # increment by 1; start QZ-0001 if no tickets exist
   ```
2. Copy `docs/tickets/_template.md` → `docs/tickets/QZ-NNNN.md`
3. Fill all frontmatter fields (id, title, type, status: `todo`, priority, phase, assigned, requested_by)
4. Write Description, Acceptance Criteria, Out of Scope, Notes sections
5. Ticket status updates at each lifecycle transition (see lifecycle below)

**Ticket lifecycle:**
```
todo → in-progress → in-review → done
```

**Key rule:** No ticket → no code → no commit → no merge.

---

### Step 2 — Implement the Ticket

**Trigger:** User says "implement QZ-NNNN" or "let's work on [ticket]".  
**Owner:** Dev agent (ai-dev) — Nova / Sage / Milo.

1. Verify `docs/tickets/QZ-NNNN.md` exists — stop if not
2. Read all relevant architecture docs:
   - `architecture/TAXONOMY.md`
   - Phase blueprint in `docs/architecture/PHASE-NN-*.md`
   - Any referenced ADRs and STANDARDs
3. Check existing PRs on the ticket:
   ```bash
   gh pr view {PR_NUMBER} --json state,merged
   ```
4. Create feature branch: `git checkout -b feature/QZ-NNNN`
5. Implement in small, committed increments — commit format:
   ```
   QZ-NNNN | type(scope): description
   ```
6. Update ticket status to `in-progress`
7. Push and open PR — title format: `QZ-NNNN | type: brief description`
8. Append real PR URL to `pr_urls` in the ticket file
9. Update ticket status to `in-review`
10. Notify QA (Ivy) for sign-off
11. Do NOT self-merge — Remy merges after QA sign-off

**Branch naming:**
```
feature/QZ-NNNN    ← new feature
fix/QZ-NNNN        ← bug fix
chore/QZ-NNNN      ← tooling, docs, config
```

---

### Step 3 — Update Documentation

**Trigger:** User says "update docs" or "document QZ-NNNN" after being satisfied with implementation.  
**Owner:** Docs Updater agent (docs-updater / Rex) + Architect for ADR review.

Run in order:

1. **ADR** — if the ticket introduced a binding technical decision (new library, infra choice, major pattern):
   - Create `docs/architecture/ADR-NNN-[slug].md` using `architecture/templates/TEMPLATE-ADR.md`
   - Register the new ADR in `architecture/TAXONOMY.md`

2. **STANDARD** — if the ticket established a non-negotiable coding rule or pattern:
   - Create `docs/architecture/STANDARD-[slug].md` using `architecture/templates/TEMPLATE-STANDARD.md`
   - Register in `architecture/TAXONOMY.md`

3. **PATTERN** — if the ticket produced a proven reusable solution:
   - Create `docs/architecture/PATTERN-[slug].md` using `architecture/templates/TEMPLATE-PATTERN.md`
   - Register in `architecture/TAXONOMY.md`

4. **GUIDE** — if the ticket introduced a complex recurring operational task:
   - Create `docs/architecture/GUIDE-[slug].md` using `architecture/templates/TEMPLATE-GUIDE.md`
   - Register in `architecture/TAXONOMY.md`

5. **README.md** — if the ticket changed setup steps, env vars, commands, or project structure:
   - Update the relevant sections of `README.md`

6. **Ticket close-out** — mark ticket `status: done`, ensure `pr_urls` is complete

**Which document type to write:**
```
Binding technical decision?       → ADR
Non-negotiable rule for all code? → STANDARD
Proven reusable solution?         → PATTERN
Step-by-step operational task?    → GUIDE
Needs team review first?          → RFC
```

---

### Step 4 — Push to Repository

**Trigger:** User says "push" or "open PR".  
**Owner:** Dev agent (ai-dev) + Remy (ai-ba) for merge.

Follow `docs/workflow/dev-workflow.md` fully. Key rules:

1. All tests must pass before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
2. Branch must reference the ticket ID
3. PR title: `QZ-NNNN | type: brief description`
4. PR body: ticket reference, summary, deviations, checklist
5. After PR open: append real URL to `pr_urls` in ticket, post URL in chat
6. Remy (ai-ba) merges only after:
   - Owner approval
   - Ivy (QA) sign-off at `docs/qa/QZ-NNNN-qa.md`
   - No open P0 bugs for this ticket

---

## Key File Locations

| What | Where |
|---|---|
| Ticket template | `docs/tickets/_template.md` |
| Tickets | `docs/tickets/QZ-NNNN.md` |
| Architecture docs | `docs/architecture/` |
| Doc templates | `architecture/templates/TEMPLATE-*.md` |
| Doc taxonomy | `architecture/TAXONOMY.md` |
| Dev workflow | `docs/workflow/dev-workflow.md` |
| QA workflow | `docs/workflow/qa-workflow.md` |
| This file | `docs/workflow/WORKFLOW.md` |
| Agent definitions | `.claude/agents/` |
| QA sign-offs | `docs/qa/QZ-NNNN-qa.md` |

---

## Critical Rules (Non-Negotiable)

1. **Ticket-first** — no code without a `QZ-NNNN` ticket
2. **No direct commits to `main`** — always feature/fix/chore branch
3. **No self-merge** — Remy merges after QA sign-off
4. **No doc creation without reading TAXONOMY.md** — prevents duplicates and wrong types
5. **ADRs are immutable once Accepted** — amend via a new superseding ADR
6. **STANDARDs must name an enforcement mechanism** — a rule without enforcement is a wish
7. **Every PR URL goes in the ticket `pr_urls`** — mandatory audit trail

---

## Context Recovery Commands

When starting a new session, run these to restore situational awareness:

```bash
# What tickets are currently in-flight?
grep -l "status: in-progress\|status: in-review" docs/tickets/QZ-*.md 2>/dev/null

# What tickets are blocked?
grep -l "status: blocked" docs/tickets/QZ-*.md 2>/dev/null

# What's the next ticket ID?
ls docs/tickets/QZ-*.md 2>/dev/null | grep -oE 'QZ-[0-9]+' | sort -t- -k2 -n | tail -1

# What architecture docs exist?
ls docs/architecture/ 2>/dev/null

# Recent git activity
git log --oneline -10 2>/dev/null
```

---

## Workflow Improvement Notes

- **Docs-updater agent:** Rex (`docs-updater.md`) handles all Step 3 tasks autonomously — invoke it after user approves implementation
- **Ticket IDs are sequential** — always check existing files before assigning a new ID
- **TAXONOMY.md is the registry** — every new ADR/STANDARD/PATTERN/GUIDE must be registered there before the session ends
- **QA sign-off is the merge gate** — Ivy's `docs/qa/QZ-NNNN-qa.md` is required, not optional
