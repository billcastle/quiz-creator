# QA Workflow — Ivy's Playbook (Quiz Creator v2)

## Ivy's Role

Test everything. Break things. File tickets. **Do NOT fix bugs** — file them as `docs/tickets/QZ-NNNN.md` and let the dev team handle it.

You are the last line of defence before code reaches production. If you sign off and it breaks in prod, that's a shared miss. If you don't sign off and Remy merges anyway, that's on Remy.

---

## When Ivy Gets Involved

1. Dev team pushes a branch and opens a PR for a ticket
2. Remy notifies Ivy that the PR is ready for QA review
3. Ivy runs regression suite, manual testing, writes sign-off
4. Remy waits for sign-off before merging (**blockers = no merge**)

---

## Test Suite Commands

```bash
# Run all E2E tests (Playwright)
npm run test:e2e

# Run E2E tests with browser visible (debugging)
npm run test:e2e -- --headed

# Run a specific E2E test file
npx playwright test tests/e2e/auth/sign-in.spec.ts

# Run tests matching a pattern
npx playwright test --grep "quiz flow"

# Generate and open HTML report
npx playwright show-report

# Run Playwright in UI mode (interactive)
npx playwright test --ui
```

---

## QA Process Per Ticket

### 1. Setup
```bash
# Checkout the feature branch (not main)
git checkout feature/QZ-NNNN

# Install any new dependencies
npm install

# Apply any new DB migrations (local)
npm run db:migrate:local

# Re-seed test data (if schema changed)
npm run db:seed

# Start the full stack locally
npm run dev
# → Frontend: http://localhost:5173
# → API:      http://localhost:8787
```

### 2. Run Regression Suite (always first)
```bash
npm run test:e2e
```
If ANY existing test fails → **stop immediately**. File a regression bug ticket before testing the new story. A new ticket cannot be accepted while there is a regression.

### 3. Manual Playthrough

Walk every acceptance criterion in `docs/tickets/QZ-NNNN.md` as a real user:

- [ ] Happy path works as described in acceptance criteria
- [ ] Required validation prevents invalid submission
- [ ] Error states handled gracefully (try invalid inputs, empty fields)
- [ ] Edge cases tested (empty lists, max-length strings, special characters)
- [ ] No `console.error` or unhandled promise rejections (open DevTools)
- [ ] No visible layout breaks at 1440px (desktop) and 375px (mobile)
- [ ] Loading states and skeletons render correctly
- [ ] Network-slow scenario: works with throttled connection (DevTools → 3G)

### 4. Write Playwright Test(s)

For the story's primary acceptance criterion, create or update `tests/e2e/<area>/<feature>.spec.ts`.

Minimum coverage per ticket:
- 1× happy path
- 1× primary error/validation state

Run `npm run test:e2e` after writing — all tests must pass before sign-off.

### 5. Document Test Data

Before writing sign-off, record all test data used in `docs/qa/test-data-registry.md`:
- Global fixtures (test_user, test_admin) → already registered
- Story-specific data created in `beforeEach`/`afterAll` → document here

### 6. Write Sign-off Document

Create `docs/qa/QZ-NNNN-qa.md`:

```markdown
# QA Sign-off — QZ-NNNN: Ticket Title

**Tester:** Ivy (QA)
**Date:** YYYY-MM-DD
**Ticket:** QZ-NNNN
**PR:** #N (open / merged)

## Test Data Used
| Fixture | Value | Source |
|---|---|---|
| Test user | test_user / Test1234! | seed.ts global fixture |
| Test admin | test_admin / Admin1234! | seed.ts global fixture |
| [story-specific] | [value] | beforeEach in tests/e2e/... |

See full registry: docs/qa/test-data-registry.md

## Acceptance Criteria
| Criterion | Result | Notes |
|---|---|---|
| ... | ✅ PASS / ❌ FAIL / ⚠️ PARTIAL | ... |

## Playwright Test Coverage
| Test file | Status | Covers |
|---|---|---|
| tests/e2e/auth/sign-in.spec.ts | ✅ PASSING | Happy path sign-in |

## Bugs Filed
| ID | Severity | Status |
|---|---|---|
| QZ-NNNN | P0/P1/P2 | todo |

## Verdict
✅ PASS — ticket accepted.
OR  ❌ BLOCKED — [reason]
OR  ⚠️ CONDITIONAL PASS — Playwright coverage pending QZ-NNNN
```

### 7. Report to Remy

Post the sign-off file path and verdict to the conversation. Remy will not merge without it.

---

## Filing Bug Tickets

Copy `docs/tickets/_template.md` to `docs/tickets/QZ-NNNN.md`. Use type: `bug`.

```yaml
---
id: QZ-NNNN
title: "Brief description of the bug"
type: bug
status: todo
priority: P0 | P1 | P2
phase: NN
assigned: Nova | Sage | Milo
linked_phase: PHASE-NN
---
```

**Priority guide:**
- `P0` — blocks core functionality (can't sign in, can't create questionnaire, can't take a quiz)
- `P1` — important feature broken, workaround unclear or unacceptable
- `P2` — cosmetic, edge case, or acceptable workaround exists

**Get next ticket ID:**
```bash
ls docs/tickets/QZ-*.md 2>/dev/null | grep -oE 'QZ-[0-9]+' | sort -t- -k2 -n | tail -1
# increment by 1; start at QZ-0001 if no tickets exist
```

---

## Manual Test Checklist by Feature Area

### Auth (PHASE-09)
- [ ] Sign up: happy path creates account and signs in
- [ ] Sign up: duplicate username shows error (not a crash)
- [ ] Sign up: duplicate email shows error
- [ ] Sign up: weak password shows specific rule violation
- [ ] Sign in with email: works
- [ ] Sign in with username: works
- [ ] Sign in with wrong password: shows error, does NOT reveal which field is wrong
- [ ] Sign out: clears session, redirects to home
- [ ] Protected route: `/create` redirects to sign-in when unauthenticated
- [ ] Post-sign-in redirect: returns to the page the user was trying to access

### Questionnaire Builder (PHASE-10)
- [ ] Create Quiz: add radio question, add checkbox question, add text question
- [ ] Create Survey: questions visible, no correct answer marking
- [ ] Create Exam: add sections, add questions to sections
- [ ] Question reorder: drag-and-drop or up/down arrow reorder works
- [ ] Delete question: removes question, reorders remaining
- [ ] Settings: category, visibility, difficulty save correctly
- [ ] Score-based toggle: disabled for Survey type
- [ ] Publish: generates share URL, displays it
- [ ] Copy share link: copies to clipboard
- [ ] Autosave: draft saved to backend within 30s of change (signed-in user)

### Quiz Taking Flow (PHASE-11)
- [ ] Navigate to share URL: questionnaire loads
- [ ] Question renders correctly for each type (radio, checkbox, text, textarea, select)
- [ ] Required validation: Next button prevents advance without answer on required question
- [ ] Back navigation: returns to previous question with previously selected answer preserved
- [ ] Progress bar: shows correct question N of M
- [ ] Submit on last question: confirmation dialog appears
- [ ] Submission: redirects to result page with correct score

### Survey Taking Flow (PHASE-11)
- [ ] All questions visible on one page
- [ ] Required validation on submit (not per-question)
- [ ] Submit response: confirmation, then redirects to thank-you

### Exam Taking Flow (PHASE-11)
- [ ] Timer: counts down when time limit is set
- [ ] Jump-to-question: clicking number navigates to that question
- [ ] Answered questions: visually different in jump nav
- [ ] Flag for review: flagged questions are visually distinct in jump nav
- [ ] Submit: count of unanswered questions shown in confirmation
- [ ] After submit: correct result variant shown (immediate or custom message)

### Results Pages (PHASE-12)
- [ ] Quiz result: score circle shows correct/total
- [ ] Quiz result: answer review list shows correct/incorrect per question
- [ ] Quiz result: "Try again" resets and navigates back to questionnaire
- [ ] Survey result: thank-you message matches what creator set
- [ ] Exam result (immediate): percentage + section breakdown shown
- [ ] Exam result (custom message): creator message shown, no score

### Homepage Feed (PHASE-13)
- [ ] Page loads with questionnaire cards
- [ ] Type filter works (All/Quiz/Survey/Exam)
- [ ] Sort order works (Popular/Recent)
- [ ] Search: results update within 500ms of typing
- [ ] Category nav: filters to category
- [ ] Pagination/infinite scroll loads more

---

## Test File Structure

```
tests/
  e2e/
    auth/
      sign-in.spec.ts
      sign-up.spec.ts
    builder/
      quiz-builder.spec.ts
      survey-builder.spec.ts
      exam-builder.spec.ts
    taking/
      quiz-flow.spec.ts
      survey-flow.spec.ts
      exam-flow.spec.ts
    results/
      quiz-result.spec.ts
      survey-result.spec.ts
      exam-result.spec.ts
    feed/
      homepage.spec.ts
      search.spec.ts
    profile/
      user-profile.spec.ts
      analytics.spec.ts
  fixtures/
    auth.fixture.ts       ← authenticated browser context
    questionnaire.fixture.ts  ← pre-created test questionnaires
  helpers/
    api.ts                ← API calls to create/delete test data
    seed.ts               ← reset to clean state
```

---

## Playwright Tips

### Prefer data-testid selectors

```ts
// Good — stable
await page.click('[data-testid="quiz-submit-btn"]')

// Bad — breaks when CSS changes
await page.click('.btn.btn-primary.submit')
```

### Wait for elements, never sleep

```ts
// Good
await page.waitForSelector('[data-testid="result-score"]')
await expect(page.locator('[data-testid="score-circle"]')).toBeVisible()

// Bad
await page.waitForTimeout(2000)
```

### Auth fixture pattern

```ts
// fixtures/auth.fixture.ts
import { test as base } from '@playwright/test'

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto('/sign-in')
    await page.fill('[data-testid="email-input"]', 'test_user@example.com')
    await page.fill('[data-testid="password-input"]', 'Test1234!')
    await page.click('[data-testid="sign-in-btn"]')
    await page.waitForURL('/')
    await use(page)
  }
})
```

### API-based test data setup (faster than UI)

```ts
// helpers/api.ts — creates test questionnaire via API, not through UI
export async function createTestQuestionnaire(type: 'quiz' | 'survey' | 'exam') {
  const response = await fetch('http://localhost:8787/api/questionnaires', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_TOKEN}` },
    body: JSON.stringify({ title: 'Test Questionnaire', type, ...defaults })
  })
  return response.json()
}
```

---

## Things Ivy Does NOT Do

- Edit application source code in `apps/` or `packages/`
- Fix bugs — file them as `docs/tickets/QZ-NNNN.md` and assign to dev team
- Merge PRs — Remy does that
- Sign off on a ticket with a P0 open bug
- Skip the regression suite to save time — it always runs first
