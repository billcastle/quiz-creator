---
phase: 12
title: "Results Pages"
status: pending
depends_on: ["PHASE-11"]
estimated_tickets: 5
---

# PHASE-12 — Results Pages

## Overview

This phase implements the post-submission result pages that respondents see after completing a questionnaire. The results experience varies significantly by questionnaire type: Quiz respondents see their score and a per-question answer review; Survey respondents see a thank-you message configured by the creator; Exam respondents see either an immediate score with section breakdowns (Option A) or a custom message from the creator (Option B).

The results page is the emotional payoff of the taking experience. For Quiz and Exam types with immediate results, it must clearly communicate performance at a glance — a circular score indicator, performance message, and actionable options (try again, review answers). For Survey and Exam custom-message types, it reinforces the respondent's contribution and provides clear next steps.

Score calculation is performed server-side in the results API endpoint, not at submission time. This is a deliberate design choice: it keeps submission fast, allows correct answers to be updated by the creator without invalidating existing responses, and ensures scoring logic lives in one place. The results fetch applies text matching rules (caseSensitive, acceptSubstring, acceptPlural) at read time.

## Goals

- [ ] Implement Quiz Results page: circular score, performance message, per-question review list, Try Again and Share actions
- [ ] Implement Survey Results page: checkmark hero, custom thank-you message, Back to home and Share survey actions
- [ ] Implement Exam Results — Option A (immediate): percentage score, section breakdown bars, per-question review
- [ ] Implement Exam Results — Option B (custom message): submitted confirmation, creator message, back to home
- [ ] Implement server-side score calculation in `GET /api/questionnaires/:id/results/:responseId`
- [ ] Implement text answer matching rules: caseSensitive, acceptSubstring, acceptPlural
- [ ] Implement result share link (copy shareable URL to clipboard)

## Architecture Decisions Required

**ADR-013: Score calculation timing** — Document the decision to calculate scores at result-fetch time (not submission time), including the trade-offs: slightly slower results fetch, but simpler submission and flexibility to update correct answers post-publish.

**ADR-014: Text answer matching implementation** — Define the canonical algorithm for acceptSubstring, caseSensitive, and acceptPlural matching. acceptPlural must handle common English plural forms (suffix rules: -s, -es, -ies). Document that irregular plurals are out of scope for v1.

**STANDARD-results-api-contracts:** Define the shape of `GET /api/questionnaires/:id/results/:responseId` including which fields are returned for each result mode (immediate vs. custom_message for exam).

## Technical Architecture

### Route Structure

```
/results/:responseId    → loads result data, dispatches to type + mode component
```

TanStack Router file:
```
apps/web/src/routes/
  results/
    $responseId.tsx     ← route loader, type/mode dispatcher
```

The route loader calls `GET /api/questionnaires/:id/results/:responseId`. The `questionnaireId` is returned within the response payload (the loader must either store it during submission or derive it from the responseId lookup).

**Implementation note:** The POST response endpoint (PHASE-11) returns a `redirectUrl` of the form `/results/:responseId`. The results API endpoint looks up the questionnaire via the response record, so the frontend only needs the `responseId` — it does not need to pass `questionnaireId` separately.

### Results API Endpoint

`GET /api/results/:responseId`

This endpoint is public (no auth required) but scoped to the response owner via the `respondentId` stored at submission time. To prevent result-scraping, the server may optionally validate that the `X-Respondent-Id` header matches the stored respondentId (soft validation — not hard security for v1).

Response shape:

```typescript
{
  responseId: string;
  questionnaireId: string;
  questionnaireType: "quiz" | "survey" | "exam";
  questionnaireTitle: string;
  shareToken: string;            // for "try again" and "share" actions
  submittedAt: string;           // ISO timestamp

  // Quiz + Exam Option A only:
  score?: {
    correct: number;
    total: number;
    percentage: number;          // 0-100, rounded to 1 decimal
    passed: boolean | null;      // null if no passing threshold set
    performanceMessage: string;  // "Nice work!" | "Almost!" | "Keep practicing!"
    sections?: Array<{           // exam only
      sectionId: string;
      sectionTitle: string;
      correct: number;
      total: number;
      percentage: number;
    }>;
  };

  // Survey + Exam Option B only:
  thankYouMessage?: string;
  creatorMessage?: string;
  resultReleaseNote?: string;    // e.g. "Results will be released on July 1"

  // Review (quiz + exam Option A):
  review?: Array<{
    questionId: string;
    sectionId: string;
    prompt: string;
    questionType: string;
    respondentAnswer: string | string[];
    correctAnswer: string | string[] | null;   // null for text_area (no correct answer)
    isCorrect: boolean | null;                 // null for survey questions / text_area
    options: Array<{ id: string; label: string }> | null;
  }>;
}
```

### Score Calculation Logic (Server-Side)

Implemented in `apps/api/src/services/scoring.service.ts`:

**Scored question types:** radio, checkbox, text_input, select
**Non-scored:** textarea (never has a correct answer)

Per-question scoring:

- **radio / select:** Compare answer value to `correctOptionId`. Exact match = correct.
- **checkbox:** Compare sorted answer array to sorted `correctOptionIds` array. All must match (no partial credit in v1).
- **text_input:** Apply matching rules from question `validation` field:
  1. Start with respondent's answer string
  2. If `caseSensitive = false`: normalize both to lowercase before comparison
  3. Compare respondent answer to each accepted answer in `correctAnswers` array
  4. If `acceptSubstring = true`: correct if respondent answer contains the correct answer as a substring (or vice versa — check both directions)
  5. If `acceptPlural = true`: generate plural form of correct answer using suffix rules and check against that as well

**Plural generation (acceptPlural):**
- Word ends in `s`, `x`, `z`, `ch`, `sh` → add `es`
- Word ends in consonant + `y` → replace `y` with `ies`
- Otherwise → add `s`
- Check both: `correctAnswer → plural` and `respondentAnswer → plural` against each other

**Performance message thresholds:**
- `percentage >= 80` → "Nice work!"
- `percentage >= 50` → "Almost!"
- `percentage < 50` → "Keep practicing!"

**Section scores (exam):** Aggregate correct/total counts per sectionId from the question review array.

### Frontend Components

#### QuizResults

Visual layout:
1. Circular score indicator: SVG-based ring, shows "N / M" with large numerals. Ring color: green for ≥80%, amber for ≥50%, red for <50%.
2. Performance message heading (h1): one of the three messages
3. Action row: "Review answers" button (scrolls to review list), "Try again" button (navigates to `/q/:shareToken`), "Share result" button (copy URL)
4. Answer review list: for each question in `review` array:
   - Question number + prompt
   - Respondent's answer displayed
   - Correct answer displayed (with "Correct answer:" label)
   - Indicator: green checkmark icon (correct) or red X icon (incorrect)
   - For text_input: show the matched rule if applicable ("Accepted as: partial match")

#### SurveyResults

Visual layout:
1. Large checkmark icon (shadcn CheckCircle or Lucide CheckCircle2, green)
2. "Thank you!" heading (h1)
3. Custom message paragraph (from `thankYouMessage` — render as plain text, no markdown for v1)
4. Action row: "Back to home" button (navigates to `/`), "Share survey" button (copies `/q/:shareToken` URL)

#### ExamResults — Option A (immediate)

Visual layout:
1. Score percentage large text (e.g., "76%")
2. Pass/fail badge (if `passed` is not null)
3. Performance message
4. Section breakdown: one horizontal progress bar per section showing section percentage, labeled with section title and "N / M correct"
5. "Review per question" button → expands an accordion or navigates to full review (same review list as QuizResults)
6. "Back to home" button

#### ExamResults — Option B (custom message)

Visual layout:
1. Checkmark icon
2. "Exam submitted" heading (h1)
3. Creator's custom message paragraph
4. Release note if present (italic text, e.g., "Results will be released on July 1")
5. "Back to home" button

#### Share Result Feature

"Share result" button uses the Clipboard API: `navigator.clipboard.writeText(window.location.href)`. Show a transient toast notification "Link copied!" using sonner or shadcn Toast. For quiz type, the shared link is `/results/:responseId` (shows the score). For survey, shared link is `/q/:shareToken` (the questionnaire itself).

### TanStack Query Integration

The results route loader uses TanStack Router's `loader` function to prefetch result data:

```typescript
// In $responseId.tsx route
export const Route = createFileRoute('/results/$responseId')({
  loader: async ({ params }) => {
    return queryClient.ensureQueryData({
      queryKey: ['results', params.responseId],
      queryFn: () => fetchResults(params.responseId),
    });
  },
});
```

The query key is `['results', responseId]`. `staleTime: Infinity` — result data is immutable once calculated.

## Monorepo Touch Points

**packages/ui:**
- New: `CircularScore` component (SVG ring score display)
- New: `SectionBreakdownBar` component (horizontal progress bar with label)
- New: `AnswerReviewItem` component (per-question result row)
- Reuse: existing `ConfirmDialog`, `Progress` from PHASE-11

**packages/shared:**
- New: `ResultsResponse` Zod schema + inferred type
- New: scoring types: `ScoreResult`, `SectionScore`, `QuestionReview`

**apps/api:**
- New: `GET /api/results/:responseId` route
- New: `apps/api/src/services/scoring.service.ts`
- New: `apps/api/src/routes/results.ts`

**apps/web:**
- New: `routes/results/$responseId.tsx`
- New: `features/results/` directory with QuizResults, SurveyResults, ExamResultsImmediate, ExamResultsCustom components

**packages/db:**
- No schema changes — reads from existing `responses`, `answers`, `questions`, `sections`, `questionnaires` tables

## Directory Structure

```
apps/web/src/
  routes/
    results/
      $responseId.tsx            ← route loader + type/mode dispatcher
  features/
    results/
      QuizResults.tsx
      SurveyResults.tsx
      ExamResultsImmediate.tsx
      ExamResultsCustom.tsx
      AnswerReviewList.tsx        ← shared review list (quiz + exam)
      ResultsPage.tsx            ← wrapper with shared layout

packages/ui/src/
  components/
    circular-score/
      CircularScore.tsx
      CircularScore.stories.tsx
    section-breakdown-bar/
      SectionBreakdownBar.tsx
    answer-review-item/
      AnswerReviewItem.tsx

packages/shared/src/
  schemas/
    results.ts                   ← Zod schemas for results API

apps/api/src/
  routes/
    results.ts                   ← GET /api/results/:responseId
  services/
    scoring.service.ts           ← score calculation logic
    scoring.service.test.ts      ← unit tests for scoring logic
```

## Implementation Steps

1. **Define Zod schemas for results API in packages/shared**
   - Add `ResultsResponse`, `ScoreResult`, `SectionScore`, `QuestionReview` schemas to `packages/shared/src/schemas/results.ts`
   - Export from `packages/shared/src/index.ts`

2. **Implement server-side scoring service**
   - Create `apps/api/src/services/scoring.service.ts`
   - Implement `calculateScore(response, questionnaire)` function
   - Implement text_input matching with caseSensitive, acceptSubstring, acceptPlural rules
   - Implement plural generation using suffix rules
   - Implement performance message threshold logic
   - Write unit tests in `scoring.service.test.ts` covering all edge cases

3. **Implement Results API endpoint**
   - Create `apps/api/src/routes/results.ts` with `GET /api/results/:responseId`
   - Load response + answers from D1
   - Load questionnaire + sections + questions (with correct answers — these are not stripped for this endpoint)
   - Call `calculateScore()` from scoring service
   - Shape response per `ResultsResponse` schema
   - Handle 404 for missing responseId

4. **Build CircularScore and SectionBreakdownBar UI components**
   - `CircularScore`: SVG ring indicator, color thresholds (green/amber/red), shows fraction "N / M"
   - `SectionBreakdownBar`: horizontal progress bar labeled with section title + N/M correct
   - Write Storybook stories for both components

5. **Build AnswerReviewItem and AnswerReviewList components**
   - `AnswerReviewItem`: question prompt, respondent answer, correct answer, correct/incorrect icon
   - `AnswerReviewList`: renders ordered list of `AnswerReviewItem` for all review questions
   - Handle text_input with match note ("Accepted as: partial match")

6. **Implement QuizResults component**
   - Circular score, performance message, action row (Review / Try Again / Share)
   - Scroll-to behavior for "Review answers"
   - Share result link copy

7. **Implement SurveyResults component**
   - Checkmark hero, thank-you heading, custom message, action row

8. **Implement ExamResultsImmediate and ExamResultsCustom components**
   - ExamResultsImmediate: score percentage, pass/fail badge, section breakdown bars, expandable review
   - ExamResultsCustom: submitted icon, heading, creator message, release note, back to home

9. **Implement TanStack Router route for /results/:responseId**
   - Create `apps/web/src/routes/results/$responseId.tsx`
   - Route loader prefetches results data using `queryClient.ensureQueryData`
   - Dispatch to correct component based on `questionnaireType` and `score` vs `creatorMessage` presence
   - Handle loading and error states

10. **Implement share result clipboard action**
    - Use `navigator.clipboard.writeText()`
    - Show toast notification on success
    - Fallback for browsers without clipboard API (select+copy text)

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1200 | Define Zod schemas for results API contracts | chore | Sage | P0 |
| QZ-1201 | Implement server-side scoring service with text matching rules | feature | Sage | P0 |
| QZ-1202 | Implement Results API endpoint (GET /api/results/:responseId) | feature | Sage | P0 |
| QZ-1203 | Build CircularScore and SectionBreakdownBar UI components | feature | Milo | P1 |
| QZ-1204 | Build AnswerReviewItem and AnswerReviewList components | feature | Nova | P1 |
| QZ-1205 | Implement QuizResults page component | feature | Nova | P0 |
| QZ-1206 | Implement SurveyResults page component | feature | Nova | P0 |
| QZ-1207 | Implement ExamResultsImmediate and ExamResultsCustom page components | feature | Nova | P1 |
| QZ-1208 | Implement TanStack Router route /results/:responseId with dispatcher | feature | Nova | P0 |
| QZ-1209 | Implement share result clipboard action with toast feedback | chore | Nova | P2 |

## Acceptance Criteria

- [ ] After submitting a quiz, `/results/:responseId` shows the correct score (N / M)
- [ ] Quiz score ring color matches threshold (green ≥80%, amber ≥50%, red <50%)
- [ ] Performance message matches score percentage ("Nice work!", "Almost!", "Keep practicing!")
- [ ] "Review answers" button scrolls to the per-question review list
- [ ] Each review item shows the respondent's answer, the correct answer, and a correct/incorrect icon
- [ ] "Try again" button navigates back to `/q/:shareToken` for the same questionnaire
- [ ] After submitting a survey, `/results/:responseId` shows the creator's custom thank-you message
- [ ] Survey results "Share survey" button copies `/q/:shareToken` to clipboard and shows toast
- [ ] After submitting an exam with immediate results, section breakdown bars show per-section scores
- [ ] After submitting an exam with custom message, creator's message is displayed (not a score)
- [ ] Text input correct answer with `acceptSubstring=true`: "Paris" matches "The capital is Paris"
- [ ] Text input with `caseSensitive=false`: "paris" matches "Paris"
- [ ] Text input with `acceptPlural=true`: "cat" matches "cats" and vice versa
- [ ] Visiting `/results/:invalidId` shows a 404 error state
- [ ] Results data is loaded via TanStack Query and shows skeleton while loading

## Out of Scope

- Leaderboards or social comparison between respondents — not in v1
- PDF export of results — not in v1
- Creator viewing individual response details — addressed in PHASE-14 (analytics)
- Email result delivery — not in v1
- Markdown rendering in custom thank-you messages — plain text only for v1
- Partial credit for checkbox questions — all-or-nothing scoring only

## Phase Dependencies

- **PHASE-11 (Taking Flows) must be complete** because results pages consume the `responseId` generated during submission, and the API endpoint reads from the same `responses` and `answers` tables populated in PHASE-11
- **PHASE-02 (Database Schema) must be complete** because results API reads `questions.correctAnswer`, `questions.correctOptionIds` fields that must be in the schema

## Agent Assignments

- **Architect:** Write ADR-013 (score calculation timing), ADR-014 (text matching algorithm), STANDARD-results-api-contracts
- **Dev/Sage (Backend):** QZ-1200, QZ-1201, QZ-1202 — API endpoint and scoring service
- **Dev/Nova (Frontend):** QZ-1204, QZ-1205, QZ-1206, QZ-1207, QZ-1208, QZ-1209 — all results page components and route
- **Dev/Milo (Visual/CSS):** QZ-1203 — CircularScore and SectionBreakdownBar design-heavy components
- **QA/Ivy:** Test all scoring edge cases (text matching variations), verify all four result modes render correctly, verify share link behavior
- **DevOps/Axel:** No specific tasks this phase
- **Remy (Producer):** Confirm UX copy for performance messages, confirm wireframe fidelity for all four result modes

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| acceptPlural matching produces false positives for irregular plurals | Medium | Low | Document limitation in ADR-014; irregular plurals out of scope for v1 |
| Score calculation query is slow for large exams (many questions/answers) | Low | Medium | Use D1 batch reads; add index on (responseId) in answers table |
| CircularScore SVG rendering inconsistency across browsers | Low | Medium | Use SVG strokeDasharray/strokeDashoffset technique (well-supported); test in CI with Playwright screenshot |
| Clipboard API not available in all browser contexts (HTTP, older browsers) | Medium | Low | Implement fallback using document.execCommand('copy') or display URL in a selectable text field |

## Estimated Effort

M
