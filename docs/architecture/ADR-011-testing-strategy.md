---
title: "ADR-011: Testing Strategy — Playwright E2E Only (Phase 1 Scope)"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-011: Testing Strategy — Playwright E2E Only (Phase 1 Scope)

## Context

The Questify codebase is in active construction. Component APIs, route shapes, and data model schemas will change frequently through Phase 10. A test suite written too early against unstable contracts will require constant rewriting, costing more time than it saves. A decision is needed on when to introduce tests and at what level of granularity.

The options range from full TDD from day one (unit + integration + E2E) to deferring all testing until the core feature set stabilises. The chosen approach must balance coverage confidence against the cost of maintaining tests during rapid iteration.

## Decision

Playwright for end-to-end browser tests only. Unit and integration tests are deferred until Phase 19 (Test Automation).

E2E tests validate complete user flows (sign in → create questionnaire → publish → take quiz → view results) rather than isolated units. They provide the most coverage per test for an early-stage application and catch integration issues that unit tests miss. Playwright runs headless tests against the actual deployed frontend and backend — if the UI works in the browser, the test passes.

The Playwright config is set up in Phase 19, after core features stabilise, to ensure test scenarios are written against stable feature contracts. This defers the test infrastructure setup cost until the codebase is mature enough to justify it.

## Consequences

### Positive

- **POS-001**: E2E tests validate user-visible behaviour, not implementation details — tests survive refactors without rewriting
- **POS-002**: No mocking layer required — Playwright tests run against real Workers + D1, catching edge runtime issues that a mocked unit test would miss
- **POS-003**: Deferring unit tests keeps Phase 1–18 velocity high; the team is not blocked on test infrastructure decisions before the feature set is stable

### Negative

- **NEG-001**: No unit tests through Phase 18 means complex business logic (quiz scoring, exam timer, text-answer validation) is not tested in isolation — bugs in these areas may be harder to reproduce and diagnose without fine-grained tests
- **NEG-002**: Playwright E2E tests are slower than unit tests (seconds per test vs. milliseconds) — CI run time grows as the test suite grows
- **NEG-003**: If a critical bug is found in Phase 5 business logic, the team has no unit test harness to write a regression test against — the fix must be validated manually until Phase 19

## Alternatives Considered

### Vitest (unit) + Playwright (E2E) from Phase 1

- **ALT-001**: **Description**: Full test pyramid from the start — Vitest for unit and component tests, Playwright for E2E
- **ALT-001**: **Rejection reason**: Adding Vitest from the start introduces Worker mocking complexity (`miniflare`, `cloudflare:test` API), React component test utilities, and Hono handler mock strategies. These setup costs are justified after the architecture stabilises but not before. Planned for Phase 19 for critical utility functions.

### Cypress

- **ALT-002**: **Description**: A browser automation tool with component testing support as an alternative to Playwright
- **ALT-002**: **Rejection reason**: Playwright has better multi-browser support (Chromium, Firefox, WebKit in parallel), faster test execution, and superior TypeScript integration. Playwright's `page.waitForSelector` is more expressive than Cypress's implicit waiting model for async quiz flows.

### Storybook + Chromatic

- **ALT-003**: **Description**: Visual regression testing for the component library in `packages/ui`
- **ALT-003**: **Rejection reason**: Useful addition for `packages/ui` but represents significant setup overhead not justified in Phase 1. Deferred; not in scope for Phase 1.

## Implementation Notes

- **IMP-001**: Playwright config (`playwright.config.ts`) lives at the monorepo root; test files live in `tests/e2e/` grouped by feature: `auth/`, `builder/`, `taking/`, `results/`
- **IMP-002**: Test data strategy: fixed test users (`test_user`, `test_admin`) created via seed script; per-test questionnaires created via API helper to avoid test interdependencies
- **IMP-003**: Success criterion — `npm run test:e2e` in CI runs all tests in headless mode against `wrangler dev --local`; all Phase 19 acceptance criteria pass on 3 consecutive runs before merge

## References

- **REF-001**: `ADR-012-deployment-platform.md` — Playwright tests run against `wrangler dev --local` in CI
- **REF-002**: https://playwright.dev/docs/test-configuration
