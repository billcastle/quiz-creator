---
phase: 19
title: "Test Automation & E2E Testing"
status: pending
depends_on: ["PHASE-11", "PHASE-12", "PHASE-13", "PHASE-14", "PHASE-15", "PHASE-16", "PHASE-17", "PHASE-18"]
estimated_tickets: 8
---

# PHASE-19 — Test Automation & E2E Testing

## Overview

This phase establishes comprehensive Playwright E2E test coverage across all critical user flows. These tests are the final quality gate before the application is considered production-ready. They run on every pull request in CI, providing automated verification that core functionality works end-to-end — from the browser through the API to the database and back.

The test suite is built on Playwright with a structured approach to test data management: a seed script creates well-known test fixtures (test users, published questionnaires of each type), and Playwright fixtures provide per-test setup/teardown. Tests are written against a locally running application stack (`wrangler dev` for the API, `vite dev` for the frontend) — not production — to ensure isolation and repeatability.

The scope covers all major feature areas: authentication flows, the builder (creating each questionnaire type), all three taking flows, all result page variants, the homepage feed and search, and user profile/analytics. The admin dashboard is covered with access control tests. Accessibility violations are caught via `@axe-core/playwright` integration run as a separate CI job.

Tests must be reliable: each test must pass 3/3 consecutive runs before it is merged (flakiness gate). Test artifacts (screenshots, videos, traces on failure) are uploaded to GitHub Actions artifacts for debugging.

## Goals

- [ ] Set up Playwright with TypeScript, configure for local Hono + D1 dev server
- [ ] Create test data seed script (`packages/db/src/seed-test.ts`)
- [ ] Create Playwright fixtures for authentication and questionnaire test data
- [ ] Write auth flow tests: sign up, sign in (email + username), sign out, protected route redirect
- [ ] Write builder tests: create quiz/survey/exam, autosave draft, publish, share link
- [ ] Write taking flow tests: take quiz, take survey, take exam (with sections, timer, flag)
- [ ] Write results page tests: all four result variants
- [ ] Write homepage/feed tests: load, filter, search, category navigation
- [ ] Write user profile and analytics tests
- [ ] Write admin access control tests (unauthenticated, wrong role, correct role)
- [ ] Add `@axe-core/playwright` accessibility tests for major pages
- [ ] Integrate Playwright into CI: parallel workers, failure artifacts, flakiness gate
- [ ] Verify tests pass 3/3 consecutive runs for each test file before merge

## Architecture Decisions Required

**ADR-026: Test environment setup** — Define how the full stack is run for E2E tests in CI: whether to use `wrangler dev` + `vite dev` as separate processes, or a combined `concurrently` setup. Define how the preview D1 database is used (or a fresh SQLite DB per CI run). Recommend: fresh SQLite DB per CI run (wrangler dev uses `--local` flag which creates a local SQLite file — perfect for CI isolation).

**ADR-027: Test user and data strategy** — Define the fixture approach: fixed well-known test users (not randomly generated per test) vs. dynamically created per test. Recommend: fixed test users created by seed script (`test_user`, `test_admin`) for auth tests; dynamically created questionnaires per test for builder/taking tests to prevent test interdependence.

**STANDARD-playwright-test-conventions:** Define test file naming (`*.spec.ts`), describe block structure, assertion style (prefer `toBeVisible()` over `toHaveText()` where possible), and the rule that no test should depend on another test's state.

## Technical Architecture

### Playwright Configuration

`playwright.config.ts` at monorepo root:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:8787/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

The `webServer` config automatically starts both servers before tests and shuts them down after.

### Test Data Seed Script

`packages/db/src/seed-test.ts`:

Creates the minimum necessary test fixtures:

```typescript
// Test users
const TEST_USER = {
  username: 'test_user',
  email: 'test@questify.test',
  password: 'TestPassword123!',
};

const TEST_ADMIN = {
  username: 'test_admin',
  email: 'admin@questify.test',
  password: 'AdminPassword123!',
  role: 'admin',
};

// Test questionnaires (one of each type, published)
const TEST_QUIZ = {
  title: 'Test Quiz',
  type: 'quiz',
  status: 'published',
  // 3 questions: 1 radio, 1 checkbox, 1 text_input
};

const TEST_SURVEY = {
  title: 'Test Survey',
  type: 'survey',
  status: 'published',
  settings: { thankYouMessage: 'Thank you for completing the survey!' },
  // 2 questions: 1 radio, 1 textarea
};

const TEST_EXAM = {
  title: 'Test Exam',
  type: 'exam',
  status: 'published',
  settings: { timeLimitMinutes: 30, resultMode: 'immediate' },
  // 2 sections: each with 2 questions
};
```

The seed script is run as a `globalSetup` in Playwright config:

```typescript
// playwright.config.ts
globalSetup: './tests/setup/global-setup.ts',
```

```typescript
// tests/setup/global-setup.ts
import { seedTestData } from '../../packages/db/src/seed-test';

export default async function globalSetup() {
  await seedTestData();
}
```

### Playwright Fixtures

`tests/fixtures/auth.fixture.ts`:

Provides `authenticatedPage` — a page that is already logged in as `test_user`:

```typescript
import { test as base } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email or username').fill('test@questify.test');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/');
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email or username').fill('admin@questify.test');
    await page.getByLabel('Password').fill('AdminPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/');
    await use(page);
  },
});
```

`tests/fixtures/questionnaire.fixture.ts`:

Provides `createdQuiz`, `createdSurvey`, `createdExam` — questionnaires created via API helper and cleaned up after each test:

```typescript
type QuestionnaireFixtures = {
  createdQuizShareToken: string;
  createdSurveyShareToken: string;
};

export const test = base.extend<QuestionnaireFixtures>({
  createdQuizShareToken: async ({ request }, use) => {
    const shareToken = await createTestQuestionnaire(request, 'quiz');
    await use(shareToken);
    await deleteTestQuestionnaire(request, shareToken);
  },
});
```

### API Helpers

`tests/helpers/api.ts`:

Direct API calls for test setup (not through UI):

```typescript
export async function createTestQuestionnaire(
  request: APIRequestContext,
  type: 'quiz' | 'survey' | 'exam'
): Promise<string> {
  // Sign in as test_user, get session cookie
  // POST /api/questionnaires with minimal valid payload
  // Publish the questionnaire
  // Return shareToken
}

export async function deleteTestQuestionnaire(
  request: APIRequestContext,
  shareToken: string
): Promise<void> {
  // DELETE /api/questionnaires/:id (find by shareToken first)
}
```

### Test File Structure

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
    admin/
      access-control.spec.ts
    accessibility/
      axe-audit.spec.ts
  fixtures/
    auth.fixture.ts
    questionnaire.fixture.ts
    index.ts                   ← re-exports combined test object
  helpers/
    api.ts
    seed.ts
  setup/
    global-setup.ts
```

### Detailed Test Plans

#### `auth/sign-in.spec.ts`

```typescript
describe('Sign in', () => {
  test('sign in with valid email and password → redirects to homepage');
  test('sign in with valid username and password → redirects to homepage');
  test('sign in with invalid credentials → shows error message');
  test('sign in with non-existent email → shows error message');
  test('visiting /my-quizzes when signed out → redirects to /sign-in');
  test('after redirect sign in → returns to original destination');
});
```

#### `auth/sign-up.spec.ts`

```typescript
describe('Sign up', () => {
  test('sign up with valid unique username and email → creates account, redirects to homepage');
  test('sign up with duplicate username → shows "username already taken" error');
  test('sign up with duplicate email → shows "email already registered" error');
  test('sign up with weak password (< 8 chars) → shows password requirement error');
  test('sign out from avatar menu → clears session, redirects to homepage as anonymous');
});
```

#### `builder/quiz-builder.spec.ts`

```typescript
describe('Quiz Builder', () => {
  test('create quiz with radio question → publishes and generates share link');
  test('create quiz with checkbox question → publishes and generates share link');
  test('create quiz with text_input question → publishes and generates share link');
  test('quiz builder autosaves draft on question edit (wait 3s → verify draft in /my-drafts)');
  test('add correct answer to radio question → saves correctly in database');
  test('delete a question → removes from builder');
  test('reorder questions via drag-and-drop');
});
```

#### `builder/exam-builder.spec.ts`

```typescript
describe('Exam Builder', () => {
  test('create exam with two sections and questions in each section → publishes');
  test('set time limit → visible in exam settings');
  test('set result mode to custom message → custom message field appears');
  test('add sub-section heading');
});
```

#### `taking/quiz-flow.spec.ts`

```typescript
describe('Quiz taking flow', () => {
  test('visit share link → shows first question and progress bar (Question 1 of N)');
  test('click Next without answering required question → shows inline error');
  test('navigate Back from second question → returns to first question');
  test('Back button is disabled on first question');
  test('answer all questions and Submit → shows confirmation dialog');
  test('confirm submission → navigates to results page');
  test('visit invalid share token → shows 404 error page');
});
```

#### `taking/exam-flow.spec.ts`

```typescript
describe('Exam taking flow', () => {
  test('visit exam share link → shows timer, section header, and jump-to-question grid');
  test('flag a question for review → button turns amber in jump grid');
  test('jump to question 3 via grid → navigates to that question');
  test('answer exam question → shows as filled in jump grid');
  test('Submit Exam button shows confirmation with answered/unanswered counts');
  test('confirm exam submission → navigates to results page');
});
```

#### `results/quiz-result.spec.ts`

```typescript
describe('Quiz results', () => {
  test('quiz results page shows correct score after perfect submission');
  test('quiz results page shows "Nice work!" for score >= 80%');
  test('quiz results page shows "Keep practicing!" for score < 50%');
  test('Review answers list shows correct/incorrect indicator per question');
  test('Try again button navigates back to /q/:shareToken');
  test('Share result button copies URL to clipboard (toast visible)');
});
```

#### `results/survey-result.spec.ts`

```typescript
describe('Survey results', () => {
  test('survey results shows "Thank you!" heading and custom thank-you message');
  test('Back to home button navigates to /');
  test('Share survey button copies questionnaire URL to clipboard');
});
```

#### `feed/homepage.spec.ts`

```typescript
describe('Homepage feed', () => {
  test('homepage loads with questionnaire grid');
  test('type filter "Quiz" → shows only quiz-type questionnaire cards');
  test('type filter "Survey" → shows only survey cards');
  test('clicking category in sidebar → navigates to /category/:slug');
  test('questionnaire card click → navigates to /q/:shareToken');
  test('infinite scroll loads more questionnaires when scrolling to bottom');
  test('skeleton cards shown while data loads');
});
```

#### `feed/search.spec.ts`

```typescript
describe('Search', () => {
  test('typing in search bar (300ms debounce) → filters grid by title');
  test('search with no results → shows empty state with "No questionnaires found"');
  test('clear search → restores full grid');
  test('search term persists in URL (query param)');
});
```

#### `admin/access-control.spec.ts`

```typescript
describe('Admin access control', () => {
  test('visiting /admin as unauthenticated user → redirects to /');
  test('visiting /admin as regular user → redirects to /');
  test('visiting /admin as admin user → shows admin dashboard');
  test('GET /api/admin/stats as unauthenticated → 401');
  test('GET /api/admin/stats as regular user → 403');
  test('GET /api/admin/stats as admin → 200 with stats data');
});
```

#### `accessibility/axe-audit.spec.ts`

```typescript
import AxeBuilder from '@axe-core/playwright';

describe('Accessibility audits', () => {
  test('homepage has no critical/serious axe violations');
  test('sign-in page has no critical/serious axe violations');
  test('sign-up page has no critical/serious axe violations');
  test('quiz taking flow has no critical/serious axe violations');
  test('survey taking flow has no critical/serious axe violations');
  test('quiz results page has no critical/serious axe violations');
  test('user profile page has no critical/serious axe violations');
});
```

Each test:
```typescript
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();
expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact))).toHaveLength(0);
```

### CI Integration

Add to `.github/workflows/ci.yml` (after biome and typecheck):

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps

- name: Seed test database
  run: npm run db:seed-test

- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true

- name: Upload Playwright artifacts
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 7
```

**Flakiness gate:** Configured via `retries: 2` in `playwright.config.ts` — a test must fail 3 times in a row to be reported as a failure. This gives some tolerance for intermittent timing issues. Consistently flaky tests must be fixed before merge; retries are not an excuse for non-deterministic tests.

**Parallelism:** `workers: 4` in CI. Tests within a `describe` block run sequentially; `describe` blocks across files run in parallel. The global seed runs once before all tests.

**Test runtime budget:** The full test suite should complete in under 8 minutes in CI with 4 workers. If it exceeds this, split into faster/slower test tiers.

## Monorepo Touch Points

**Root:**
- New: `playwright.config.ts`
- New: `tests/` directory with all spec and fixture files
- Modified: `.github/workflows/ci.yml` — add Playwright test step

**packages/db:**
- New: `src/seed-test.ts` — test data seeding function

**apps/web:**
- No production code changes — only test files in `tests/`

**apps/api:**
- Verify `GET /api/health` endpoint exists (used by webServer wait condition in Playwright config)

## Directory Structure

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
    admin/
      access-control.spec.ts
    accessibility/
      axe-audit.spec.ts
  fixtures/
    auth.fixture.ts
    questionnaire.fixture.ts
    index.ts
  helpers/
    api.ts
    seed.ts
  setup/
    global-setup.ts

playwright.config.ts

packages/db/src/
  seed-test.ts
```

## Implementation Steps

1. **Install Playwright and configure playwright.config.ts**
   - Install `@playwright/test`, `@axe-core/playwright` as dev dependencies in root
   - Create `playwright.config.ts` with webServer, projects, and retry config
   - Verify Playwright can start both dev servers and run a smoke test

2. **Create test data seed script**
   - Create `packages/db/src/seed-test.ts`
   - Implement seeding for test_user, test_admin, one published quiz, one survey, one exam
   - Create `tests/setup/global-setup.ts` calling seed script
   - Verify seed runs cleanly against wrangler dev local SQLite

3. **Create Playwright fixtures (auth + questionnaire)**
   - Create `tests/fixtures/auth.fixture.ts` with `authenticatedPage` and `adminPage` fixtures
   - Create `tests/fixtures/questionnaire.fixture.ts` with questionnaire creation/cleanup fixtures
   - Create `tests/helpers/api.ts` with `createTestQuestionnaire` and `deleteTestQuestionnaire`
   - Create `tests/fixtures/index.ts` re-exporting the combined test object

4. **Write authentication flow tests**
   - Create `tests/e2e/auth/sign-in.spec.ts` — all sign-in scenarios
   - Create `tests/e2e/auth/sign-up.spec.ts` — all sign-up scenarios including validation errors

5. **Write builder tests**
   - Create `tests/e2e/builder/quiz-builder.spec.ts` — quiz creation, question types, publish
   - Create `tests/e2e/builder/survey-builder.spec.ts` — survey creation, thank-you message
   - Create `tests/e2e/builder/exam-builder.spec.ts` — exam creation, sections, settings

6. **Write taking flow tests**
   - Create `tests/e2e/taking/quiz-flow.spec.ts` — navigation, validation, submission
   - Create `tests/e2e/taking/survey-flow.spec.ts` — single page, validation, submission
   - Create `tests/e2e/taking/exam-flow.spec.ts` — timer display, flag, jump grid, submission

7. **Write results page tests**
   - Create `tests/e2e/results/quiz-result.spec.ts` — score, review, try again, share
   - Create `tests/e2e/results/survey-result.spec.ts` — thank you message, share
   - Create `tests/e2e/results/exam-result.spec.ts` — immediate score + custom message variants

8. **Write homepage feed and search tests**
   - Create `tests/e2e/feed/homepage.spec.ts` — grid load, filters, card click
   - Create `tests/e2e/feed/search.spec.ts` — search debounce, empty state, clear

9. **Write profile and analytics tests**
   - Create `tests/e2e/profile/user-profile.spec.ts` — public profile view, edit own profile
   - Create `tests/e2e/profile/analytics.spec.ts` — summary cards, questionnaire table, detail page

10. **Write admin access control tests**
    - Create `tests/e2e/admin/access-control.spec.ts` — unauthenticated redirect, wrong role redirect, admin access

11. **Write @axe-core/playwright accessibility tests**
    - Create `tests/e2e/accessibility/axe-audit.spec.ts`
    - Run axe analysis on all major pages
    - Assert zero critical/serious violations

12. **Integrate Playwright into CI workflow**
    - Update `.github/workflows/ci.yml` with Playwright install, seed, run, and artifact upload steps
    - Verify full CI pipeline completes in under 8 minutes with 4 workers
    - Document flakiness gate: tests must pass 3/3 in code review before merge

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1900 | Install Playwright and configure playwright.config.ts | chore | Ivy | P0 |
| QZ-1901 | Create test data seed script (packages/db/src/seed-test.ts) | chore | Sage | P0 |
| QZ-1902 | Create Playwright fixtures and API helpers for test setup | chore | Ivy | P0 |
| QZ-1903 | Write authentication flow E2E tests (sign-in, sign-up) | feature | Ivy | P0 |
| QZ-1904 | Write builder E2E tests (quiz, survey, exam creation and publish) | feature | Ivy | P0 |
| QZ-1905 | Write taking flow E2E tests (quiz, survey, exam flows) | feature | Ivy | P0 |
| QZ-1906 | Write results page E2E tests (all four result variants) | feature | Ivy | P1 |
| QZ-1907 | Write homepage feed and search E2E tests | feature | Ivy | P1 |
| QZ-1908 | Write user profile and analytics E2E tests | feature | Ivy | P1 |
| QZ-1909 | Write admin access control E2E tests | feature | Ivy | P1 |
| QZ-1910 | Write @axe-core/playwright accessibility audit tests | feature | Ivy | P1 |
| QZ-1911 | Integrate Playwright tests into CI workflow with artifact upload | chore | Axel | P0 |

## Acceptance Criteria

- [ ] `npx playwright test` runs without configuration errors against local dev servers
- [ ] Global seed creates test_user, test_admin, and all three published test questionnaires
- [ ] Auth tests: all sign-in and sign-up scenarios pass including error cases
- [ ] Builder tests: creating and publishing a quiz, survey, and exam all pass
- [ ] Taking tests: full quiz, survey, and exam taking flows all pass end-to-end
- [ ] Results tests: all four result variants (quiz, survey, exam-immediate, exam-custom) render correctly
- [ ] Feed tests: homepage loads, type filter works, search filters grid
- [ ] Admin access control: unauthenticated and non-admin users are blocked at route and API level
- [ ] Axe audit tests: zero critical or serious WCAG 2.1 AA violations on all audited pages
- [ ] CI: Playwright tests run on every PR and report pass/fail
- [ ] CI: Playwright HTML report and videos uploaded as artifacts on failure
- [ ] CI: Full test suite completes in under 8 minutes with 4 parallel workers
- [ ] Each test file passes 3 consecutive runs (flakiness verification before merge)

## Out of Scope

- Visual regression testing (screenshot diffs) — not in v1; Playwright screenshots are for failure debugging only
- Performance testing (load testing, stress testing) — addressed separately if needed
- Mobile app testing — Questify is web-only
- Cross-browser testing beyond Chromium + mobile Chrome — v1 targets Chromium; Safari/Firefox testing is a follow-up
- Unit tests and component tests — out of scope for this phase; component tests with Vitest may be added in a follow-up engineering sprint
- Contract testing (API schema validation tests) — the E2E tests implicitly validate API contracts through real usage

## Phase Dependencies

- **All feature phases (PHASE-11 through PHASE-15) must be complete** because tests cover all features; incomplete features cannot be tested
- **PHASE-16 (Cloudflare Deployment) must be complete** because the CI workflow must exist to integrate Playwright into it
- **PHASE-17 (i18n & Accessibility) must be complete** because the axe accessibility tests check the final state of the application including all accessibility fixes
- **PHASE-18 (Performance) must be complete** because tests should run against the optimized application to ensure performance changes did not break functionality

## Agent Assignments

- **Architect:** Write ADR-026 (test environment setup), ADR-027 (test user and data strategy), STANDARD-playwright-test-conventions
- **Dev/Sage (Backend):** QZ-1901 — seed script (requires database access)
- **Dev/Nova (Frontend):** Support Ivy with any test selectors that are hard to target; add `data-testid` attributes to components that lack accessible selectors
- **Dev/Milo (Visual/CSS):** No tasks this phase
- **QA/Ivy:** QZ-1900, QZ-1902, QZ-1903, QZ-1904, QZ-1905, QZ-1906, QZ-1907, QZ-1908, QZ-1909, QZ-1910 — all test writing
- **DevOps/Axel:** QZ-1911 — CI integration
- **Remy (Producer):** Review test coverage plan against feature requirements, confirm all critical user journeys are covered, sign off on 8-minute CI budget

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| wrangler dev startup time in CI causes test timeouts | Medium | High | Set `timeout: 60000` in webServer config; use `waitForPort` before tests start |
| Seed script creates duplicate data on re-run (CI reruns) | Medium | Medium | Add upsert logic or truncate-and-reseed approach in global-setup; test idempotency |
| Flaky timer tests in exam flow (timing-sensitive) | High | Medium | Mock the timer in exam tests using Playwright clock API (`page.clock.setFixedTime()`); do not rely on real-time countdown |
| Test database has leftover state between test files | Medium | Medium | Each test that creates questionnaires must clean up via fixture teardown; seed only runs once in globalSetup |
| @axe-core/playwright violations from third-party libraries | Low | Low | Use `.exclude()` to skip third-party widgets that cannot be fixed; document exceptions |
| CI cost: 4 parallel workers × Playwright Chrome = significant memory use | Low | Medium | Monitor GitHub Actions runner memory; reduce workers to 2 if memory issues arise |

## Estimated Effort

XL
