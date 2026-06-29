# Developer Workflow — Sahabat POS

## Golden Rules (Non-Negotiable)

### 1. Ticket-First — No Code Without a Reference

**Every code change must reference a ticket before work begins. No exceptions.**

| Source | Ticket type | Who creates it |
|---|---|---|
| Sprint plan story | Sprint story (S{N}-{N}) — already a ticket | Remy at sprint kick-off |
| Bug found during QA | Wiki ticket (`docs/tickets/SAH-NNNN.md`) | Ivy immediately on discovery |
| User ad-hoc request | Wiki ticket (`docs/tickets/SAH-NNNN.md`) | Remy before dev starts |
| Architectural change | Wiki ticket + ADR | Architect + Remy |

**If a user prompt requests something not in the current sprint plan:**
1. Remy creates `docs/tickets/SAH-NNNN.md` immediately (use `_template.md`)
2. Get the next ticket ID: `curl http://localhost:3100/api/next-ticket-id` (wiki dev server) or count existing files manually
3. Dev team starts work only after the ticket file exists
4. All commits and the PR reference the ticket ID

**No ticket → no commit → no merge.**

---

### 2. No Direct Commits to `main`

`main` is a protected branch. **Always work on a feature branch.**

```bash
# WRONG — never do this
git commit -m "..." && git push origin main

# CORRECT
git checkout -b feature/SAH-0012
git commit -m "SAH-0012 | feat(auth): add NextAuth credentials provider"
git push origin feature/SAH-0012
# → open PR → QA sign-off → Remy merges
```

Only Remy (Producer) merges PRs into `main`. Dev team members do not self-merge.

---

## Branch Naming

The project short code is defined in `.env.template` as `PROJECT_SHORT=SAH`.

```
feature/{PROJECT_SHORT}-{NNNN}   ← new feature or sprint story
fix/{PROJECT_SHORT}-{NNNN}       ← bug fix (ticket already created by Ivy)
chore/{PROJECT_SHORT}-{NNNN}     ← tooling, docs, config
```

Examples:
```
feature/SAH-0001    ← new feature or sprint story
fix/SAH-0042        ← bug fix
chore/SAH-0007      ← tooling or docs change
```

**When a ticket already has a PR** — check the PR's `state` and `merged` fields via the GitHub API before doing any new work. Do not rely on branch existence — a branch can be deleted independently of PR state.

Get the PR number from the ticket's `pr_urls` (e.g. `pull/3` → PR `3`), then:

```bash
# Preferred — gh CLI (handles auth automatically):
gh pr view 3 --json state,merged

# Fallback — curl with GITHUB_TOKEN (required: this repo is private):
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/s-winata/ai-monster/pulls/3" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('state:', d['state'], '| merged:', d['merged'])"
# "state": "open"    merged: False  → still open
# "state": "closed"  merged: True   → merged into main
# "state": "closed"  merged: False  → closed without merging
```

`GITHUB_TOKEN` must be set in `.env.local`. See `.env.template` for setup instructions.

| `state` | `merged` | Action |
|---|---|---|
| `open` | `false` | Push new commits to the existing branch — PR updates automatically |
| `closed` | `true` | Create new branch `feature/SAH-NNNN-v2`, open a new PR, append URL to `pr_urls` |
| `closed` | `false` | PR was abandoned — discuss with Remy; re-open on GitHub or create `feature/SAH-NNNN-v2` |

**Re-branch naming for subsequent PRs on the same ticket:**
```
feature/SAH-NNNN-v2   ← second PR for the same ticket
feature/SAH-NNNN-v3   ← third PR, etc.
```

---

## Commit Message Format

```
{PROJECT_SHORT}-{NNNN} | type(scope): description
```

Examples:
```
SAH-0001 | chore(governance): add ticket-first policy and branch naming
SAH-0012 | feat(auth): add NextAuth credentials provider
SAH-0042 | fix(login): correct redirect loop after session expiry
SAH-0042 | fix(login): correct redirect loop (Closes SAH-0042)
```

**Rules:**
- Ticket ID is always first — no exceptions
- Sprint story tickets use the same format: `SAH-NNNN` (sprint stories are also wiki tickets from Sprint 1 onwards)
- `type` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- Commit after each logical unit of work, not at end of day
- When a bug is fixed, add `(Closes SAH-NNNN)` at the end to auto-update ticket status

---

## PR Title Format

PR titles follow the same pattern as commits:

```
SAH-NNNN | type: brief description
```

Examples:
```
SAH-0001 | chore: wiki ticket system and branch naming governance
SAH-0012 | feat: NextAuth credentials provider
SAH-0042 | fix: login redirect loop after session expiry
```

**Rules:**
- Ticket ID first, pipe separator, then a short human-readable title
- No scope needed in the PR title (scope belongs in individual commits)
- PR body must include: ticket reference, summary of changes, deviation notes (if any), and the checklist

After pushing and opening the PR:
1. **Update the ticket** — append the real PR URL to `pr_urls` in `docs/tickets/SAH-NNNN.md` and commit on the same branch. Use the actual PR number URL (e.g. `https://github.com/s-winata/ai-monster/pull/3`), not the "new PR" URL. A ticket can accumulate multiple PRs if it is reopened or patched again:
   ```yaml
   pr_urls:
     - https://github.com/s-winata/ai-monster/pull/3
     - https://github.com/s-winata/ai-monster/pull/7
   ```
2. **Post the PR URL as a comment in the chat** so the owner can review and approve before Remy merges

No silent merges. The PR link must be visible in the ticket and posted to the owner.

---

## Before You Start Any Sprint

1. Read `PROJECT_BRIEF.md` sections 7+8 for current project state
2. Read `docs/sprint-N/plan.md` for this sprint's stories and acceptance criteria
3. Read `_migration/notes/architecture-blueprint.md` if implementing a new domain
4. Check `docs/tickets/` — fix any `priority: P0` / `status: blocked` tickets before new stories

---

## Ticket Lifecycle

```
docs/tickets/SAH-NNNN.md created (status: todo)
  → Dev picks up, creates branch feature/SAH-NNNN (status: in-progress)
  → Dev pushes, opens PR referencing ticket (status: in-review)
  → Ivy QA verifies acceptance criteria
  → Remy merges PR, updates ticket (status: done)
```

To create a ticket:
1. Copy `docs/tickets/_template.md` to `docs/tickets/SAH-NNNN.md`
2. Fill in all frontmatter fields
3. Commit the ticket file on the feature branch (or on `main` directly if it's a pre-work planning step — this is the one exception to the branch rule)

---

## Code Quality Rules

### TypeScript
- Zero `any` — use `unknown` + type narrowing, or create an explicit type
- Run `npm run typecheck` before pushing

### Money
- Always `INTEGER` cents in DB — never `REAL`, `DECIMAL`, or `string`
- Display layer only: `formatCurrency(cents, locale, currency)` from `apps/pos/src/lib/currency.ts`

### Data fetching
- Server Components fetch data — never `useEffect` + fetch for initial page data
- Mutations via Server Actions (`'use server'`) or API Routes
- No queries inside `.map()` loops — use `WHERE id IN (...)` bulk queries

### DB access
- Use Drizzle for typed queries
- Use `db.prepare()` for bulk inserts and FTS5 searches
- Always check `result.changes` on `UPDATE` statements for optimistic lock verification

### Components
- Default to Server Component — add `'use client'` only when browser APIs needed
- Zustand for cart/session state; no Context API for high-frequency state

### Design System — Storybook (mandatory from Sprint 0)
- Every new component in `packages/ui/src/` requires a Storybook story before the PR is opened
- Story must cover: default state, all variants, and edge cases (empty, loading, error, disabled)
- Primitives (Button, Badge, Input, etc.) live in `packages/ui/src/components/ui/`
- POS domain components (CartPanel, TableMap) live in `packages/ui/src/components/pos/`
- Run `npm run storybook -w @sahabat/ui` to view the design system at `localhost:6006`
- **No story = PR not merged.** Remy enforces at merge; Ivy checks at sign-off.

---

## Updating Progress

After completing each story, update `docs/sprint-N/progress.md`:

```markdown
## S1-1 — Auth Foundation ✅ DONE (Sage, 2026-06-25)
Notes: Used bcrypt cost factor 12. registerId passed at login time in request body.
```

If you hit a blocker, document it immediately:

```markdown
## S1-2 — Product Grid ⚠️ BLOCKED
Blocker: FTS5 virtual table not created in migration file — need to regenerate
Ticket: SAH-0042 (filed by Ivy)
```

---

## Environment Setup (first time)

```bash
# Clone
git clone git@github.com:org/sahabat.git
cd sahabat

# Install
npm install

# Configure
cp .env.template .env.local
# Edit .env.local — NEXTAUTH_SECRET is required (generate: openssl rand -base64 32)
# PROJECT_SHORT defaults to SAH — change only if project is renamed

# Create DB
npm run db:migrate

# Seed test data (Sprint 0 only)
npm run db:seed

# Start
npm run dev
```

---

## Working with the DB

```bash
# Apply migrations
npm run db:migrate

# Open DB browser (Drizzle Studio)
npm run db:studio

# Inspect DB directly
sqlite3 data/store.db ".tables"
sqlite3 data/store.db "SELECT COUNT(*) FROM products"
```

---

## Testing Before Pushing

```bash
npm run lint        # must pass
npm run typecheck   # must pass
npm run test        # unit tests must pass
npm run build       # must compile without errors
```

---

## Sprint End Checklist

- [ ] All stories completed (check `docs/sprint-N/plan.md`)
- [ ] All tickets in `docs/tickets/` for this sprint marked `status: done`
- [ ] `docs/sprint-N/progress.md` fully updated
- [ ] PR opened and reviewed
- [ ] Ivy (QA) has been notified to run tests
- [ ] After QA sign-off: write `docs/sprint-N/done.md` with summary of what shipped
- [ ] After Remy merges: update your local `main`
