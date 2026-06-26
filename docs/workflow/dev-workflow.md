# Developer Workflow — Quiz Creator v2 (Questify)

## Golden Rules (Non-Negotiable)

### 1. Ticket-First — No Code Without a Reference

**Every code change must reference a ticket before work begins. No exceptions.**

| Source | Ticket type | Who creates it |
|---|---|---|
| Phase plan story | Phase story — create ticket at phase kick-off | Remy at phase kick-off |
| Bug found during QA | Ticket (`docs/tickets/QZ-NNNN.md`) | Ivy immediately on discovery |
| User ad-hoc request | Ticket (`docs/tickets/QZ-NNNN.md`) | Remy before dev starts |
| Architectural change | Ticket + ADR | Architect + Remy |

**If a user prompt requests something not in the current phase plan:**
1. Remy creates `docs/tickets/QZ-NNNN.md` immediately (use `_template.md`)
2. Get the next ticket ID:
   ```bash
   ls docs/tickets/QZ-*.md 2>/dev/null | grep -oE 'QZ-[0-9]+' | sort -t- -k2 -n | tail -1
   # increment by 1; start at QZ-0001 if no tickets exist
   ```
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
git checkout -b feature/QZ-0012
git commit -m "QZ-0012 | feat(auth): add Better-auth email/password provider"
git push origin feature/QZ-0012
# → open PR → QA sign-off → Remy merges
```

Only Remy (Producer) merges PRs into `main`. Dev team members do not self-merge.

---

## Branch Naming

The project short code is `QZ` (defined in `.env.template` as `PROJECT_SHORT=QZ`).

```
feature/{PROJECT_SHORT}-{NNNN}   ← new feature or phase story
fix/{PROJECT_SHORT}-{NNNN}       ← bug fix (ticket already created by Ivy)
chore/{PROJECT_SHORT}-{NNNN}     ← tooling, docs, config
```

Examples:
```
feature/QZ-0001    ← new feature or phase story
fix/QZ-0042        ← bug fix
chore/QZ-0007      ← tooling or docs change
```

**When a ticket already has a PR** — check the PR's `state` and `merged` fields via the GitHub API before doing any new work. Do not rely on branch existence — a branch can be deleted independently of PR state.

Get the PR number from the ticket's `pr_urls` (e.g. `pull/3` → PR `3`), then:

```bash
# Preferred — gh CLI (handles auth automatically):
gh pr view 3 --json state,merged

# Fallback — curl with GITHUB_TOKEN (required: this repo is private):
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/billcastle_bose/quiz-creatorv2/pulls/3" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('state:', d['state'], '| merged:', d['merged'])"
# "state": "open"    merged: False  → still open
# "state": "closed"  merged: True   → merged into main
# "state": "closed"  merged: False  → closed without merging
```

`GITHUB_TOKEN` must be set in `.env.local`. See `.env.template` for setup instructions.

| `state` | `merged` | Action |
|---|---|---|
| `open` | `false` | Push new commits to the existing branch — PR updates automatically |
| `closed` | `true` | Create new branch `feature/QZ-NNNN-v2`, open a new PR, append URL to `pr_urls` |
| `closed` | `false` | PR was abandoned — discuss with Remy; re-open on GitHub or create `feature/QZ-NNNN-v2` |

**Re-branch naming for subsequent PRs on the same ticket:**
```
feature/QZ-NNNN-v2   ← second PR for the same ticket
feature/QZ-NNNN-v3   ← third PR, etc.
```

---

## Commit Message Format

```
{PROJECT_SHORT}-{NNNN} | type(scope): description
```

Examples:
```
QZ-0001 | chore(governance): add ticket-first policy and branch naming
QZ-0012 | feat(auth): add Better-auth email/password provider
QZ-0042 | fix(quiz): correct answer validation for multi-select questions
QZ-0042 | fix(quiz): correct answer validation (Closes QZ-0042)
```

**Rules:**
- Ticket ID is always first — no exceptions
- `type` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- Commit after each logical unit of work, not at end of day
- When a bug is fixed, add `(Closes QZ-NNNN)` at the end to auto-update ticket status

---

## PR Title Format

PR titles follow the same pattern as commits:

```
QZ-NNNN | type: brief description
```

Examples:
```
QZ-0001 | chore: ticket system and branch naming governance
QZ-0012 | feat: Better-auth email/password provider
QZ-0042 | fix: quiz answer validation for multi-select questions
```

**Rules:**
- Ticket ID first, pipe separator, then a short human-readable title
- No scope needed in the PR title (scope belongs in individual commits)
- PR body must include: ticket reference, summary of changes, deviation notes (if any), and the checklist

After pushing and opening the PR:
1. **Update the ticket** — append the real PR URL to `pr_urls` in `docs/tickets/QZ-NNNN.md` and commit on the same branch. Use the actual PR number URL (e.g. `https://github.com/billcastle_bose/quiz-creatorv2/pull/3`), not the "new PR" URL. A ticket can accumulate multiple PRs if it is reopened or patched again:
   ```yaml
   pr_urls:
     - https://github.com/billcastle_bose/quiz-creatorv2/pull/3
     - https://github.com/billcastle_bose/quiz-creatorv2/pull/7
   ```
2. **Post the PR URL as a comment in the chat** so the owner can review and approve before Remy merges

No silent merges. The PR link must be visible in the ticket and posted to the owner.

---

## Before You Start a Phase

1. Read `PROJECT_BRIEF.md` for current project state
2. Read the phase blueprint `docs/architecture/PHASE-NN-*.md` for this phase's stories and acceptance criteria
3. Check `docs/tickets/` — fix any `priority: P0` / `status: blocked` tickets before new stories

---

## Ticket Lifecycle

```
docs/tickets/QZ-NNNN.md created (status: todo)
  → Dev picks up, creates branch feature/QZ-NNNN (status: in-progress)
  → Dev pushes, opens PR referencing ticket (status: in-review)
  → Ivy QA verifies acceptance criteria
  → Remy merges PR, updates ticket (status: done)
```

To create a ticket:
1. Copy `docs/tickets/_template.md` to `docs/tickets/QZ-NNNN.md`
2. Fill in all frontmatter fields
3. Commit the ticket file on the feature branch (or on `main` directly if it's a pre-work planning step — this is the one exception to the branch rule)

---

## Code Quality Rules

### TypeScript
- Zero `any` — use `unknown` + type narrowing, or create an explicit type
- Run `npm run typecheck` before pushing

### Data Fetching
- No queries inside `.map()` loops — use `WHERE id IN (...)` bulk queries
- All API inputs validated with Zod at the route boundary (not just in the frontend)
- API responses follow the standard shape: `{ data }` on success, `{ error, code }` on failure

### DB Access
- Use Drizzle ORM for typed queries — no raw SQL strings
- Use D1 bindings from Hono context: `c.env.DB`
- Use Drizzle batch (`db.batch([...])`) for multi-table operations

### Components
- Zustand for quiz/session state and any high-frequency cross-component state; local `useState` for UI-only state
- Always check `packages/ui` before building a new component

### Design System
- All UI primitives (Button, Badge, Input, etc.) live in `packages/ui/src/components/ui/`
- Quiz domain components (QuizCard, QuestionBuilder, etc.) live in `packages/ui/src/components/quiz/`
- `packages/ui` has zero business logic — no API calls, no Zustand stores, no DB imports
- Follow shadcn/Maia patterns — extend via variants, not overrides

---

## Environment Setup (first time)

```bash
# Clone
git clone git@github.com:billcastle_bose/quiz-creatorv2.git
cd quiz-creatorv2

# Install
npm install

# Configure
cp .env.template .env.local
# Edit .env.local — BETTER_AUTH_SECRET is required (generate: openssl rand -base64 32)
# PROJECT_SHORT=QZ is already set

# Apply D1 migrations (local)
npm run db:migrate:local -w @quiz/db

# Seed dev data
npm run db:seed -w @quiz/db

# Start
npm run dev
```

---

## Working with the DB

```bash
# Apply migrations (local)
npm run db:migrate:local -w @quiz/db

# Open Drizzle Studio (local)
npm run db:studio -w @quiz/db

# Execute SQL against local D1
wrangler d1 execute quiz-db --local --command "SELECT COUNT(*) FROM questionnaires"

# Apply migrations (production)
wrangler d1 migrations apply quiz-db --remote
```

---

## Testing Before Pushing

```bash
npm run lint        # Biome check — must pass
npm run typecheck   # TypeScript strict — must pass
npm run build       # must compile without errors
```

---

## Phase Completion Checklist

- [ ] All tickets for this phase marked `status: done`
- [ ] Phase blueprint status updated to `complete`
- [ ] `README.md` updated (trigger Rex)
- [ ] PR opened, reviewed, and merged
- [ ] Ivy (QA) sign-off exists for all tickets in `docs/qa/QZ-NNNN-qa.md`
