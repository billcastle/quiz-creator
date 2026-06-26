---
phase: 11
title: "Quiz/Survey/Exam Taking Flows"
status: pending
depends_on: ["PHASE-01", "PHASE-02", "PHASE-03", "PHASE-04", "PHASE-05", "PHASE-06", "PHASE-07", "PHASE-08", "PHASE-09", "PHASE-10"]
estimated_tickets: 6
---

# PHASE-11 — Quiz/Survey/Exam Taking Flows

## Overview

This phase implements the respondent-facing experience: the three distinct taking flows (Quiz, Survey, Exam) that are accessed via a public share link. These are the highest-traffic routes in the application — every published questionnaire is taken from here. Because no authentication is required, the UX must be frictionless: a respondent visits a URL, answers questions, and submits.

Each questionnaire type presents a fundamentally different interaction model. A Quiz steps through one question at a time with forward/back navigation, building a sense of progress. A Survey shows all questions on a single scrollable page, optimized for quick completion. An Exam adds a timer, section awareness, jump-to-question navigation, and the ability to flag questions for review — making it suitable for formal assessment contexts. All three converge on a shared POST endpoint for response submission, then redirect to type-specific result pages implemented in PHASE-12.

The taking flows must work reliably on mobile, support keyboard navigation throughout, and gracefully handle edge cases such as expired tokens, unpublished questionnaires, and mid-session network failures. Answer state is ephemeral (local component state / Zustand slice) and is intentionally not persisted between browser sessions.

## Goals

- [ ] Implement Quiz taking flow: single-question pagination, progress bar, Back/Next/Submit with confirmation dialog
- [ ] Implement Survey taking flow: all questions on one scrollable page, submit-time validation
- [ ] Implement Exam taking flow: timer, section header, jump-to-question grid, flag for review, paginated questions
- [ ] Implement ShareToken API route: `GET /api/questionnaires/:shareToken/take` returning questionnaire + questions (no answer keys)
- [ ] Implement response submission: `POST /api/questionnaires/:id/responses` with anonymous respondent UUID
- [ ] Implement shared `QuestionDisplay` component in `packages/ui` handling all five question field types
- [ ] Implement keyboard navigation: Tab to next option, Enter to select, arrow keys for navigation within question
- [ ] Generate and persist anonymous respondent UUID in localStorage

## Architecture Decisions Required

**ADR-011: Client-side answer state management for taking flows** — Decide between local component state (useState/useReducer) versus a dedicated Zustand slice for tracking current answers across quiz navigation. Zustand slice is preferred for testability and to support the exam flag-for-review feature.

**ADR-012: Anonymous respondent identity strategy** — Define how anonymous respondents are identified: localStorage UUID (preferred), sessionStorage, or fingerprinting. Document collision risk and privacy implications.

**STANDARD-taking-flow-routing:** Define the canonical URL structure for the taking experience (`/q/:shareToken`), how the type is determined after the share token resolves, and the redirect behavior for invalid/unpublished tokens.

## Technical Architecture

### Route Structure

All three taking types share the entry route `/q/:shareToken`. After the share token resolves via `GET /api/questionnaires/:shareToken/take`, the frontend dispatches to the appropriate taking component based on `questionnaire.type`. This avoids type-specific URLs that would leak information before the respondent starts.

```
/q/:shareToken          → resolves type → Quiz | Survey | Exam taking view
/results/:responseId    → result page (PHASE-12)
```

TanStack Router file layout:
```
apps/web/src/routes/
  q/
    $shareToken.tsx     ← loader fetches questionnaire via share token, dispatches to type component
  results/
    $responseId.tsx     ← PHASE-12
```

### ShareToken API Endpoint

`GET /api/questionnaires/:shareToken/take`

- Looks up questionnaire by `shareToken` (UUID column on questionnaires table)
- Returns 404 if not found, 403 if status is `draft` or `archived`
- Response shape (no correct answers, no scoring data):

```typescript
{
  id: string;
  type: "quiz" | "survey" | "exam";
  title: string;
  description: string | null;
  settings: {
    // Quiz
    showScoreAtEnd?: boolean;
    // Survey
    thankYouMessage?: string;
    // Exam
    timeLimitMinutes?: number | null;
    resultMode?: "immediate" | "custom_message";
    customResultMessage?: string;
    passingThreshold?: number | null;
  };
  sections: Array<{
    id: string;
    title: string;
    order: number;
    questions: Array<{
      id: string;
      sectionId: string;
      type: "radio" | "checkbox" | "text_input" | "textarea" | "select";
      prompt: string;
      order: number;
      required: boolean;
      options: Array<{ id: string; label: string }> | null; // null for text types
      validation: {
        caseSensitive?: boolean;
        acceptSubstring?: boolean;
        acceptPlural?: boolean;
      } | null;
    }>;
  }>;
}
```

For non-exam questionnaires, sections will always contain exactly one section with all questions. The exam type may have multiple sections.

### Response Submission Endpoint

`POST /api/questionnaires/:id/responses`

Request body:
```typescript
{
  respondentId: string;          // anonymous UUID from localStorage
  answers: Array<{
    questionId: string;
    value: string | string[];    // string for text/radio/select, string[] for checkbox
  }>;
  startedAt: string;             // ISO timestamp
  submittedAt: string;           // ISO timestamp
}
```

Response:
```typescript
{
  responseId: string;
  redirectUrl: string;           // /results/:responseId
}
```

Server-side: stores response + all answers. Score calculation is deferred to the results fetch (PHASE-12).

### Anonymous Respondent UUID

On first visit to any `/q/:shareToken` route, check localStorage for `questify_respondent_id`. If absent, generate a UUID v4 with `crypto.randomUUID()` and store it. Include this in all response submission payloads. This allows the server to prevent duplicate submissions from the same browser (soft deduplication — not a hard enforcement for v1).

### Zustand Taking Store

A dedicated Zustand slice (`useTakingStore`) manages the in-progress taking session:

```typescript
interface TakingStore {
  questionnaireId: string | null;
  shareToken: string | null;
  currentQuestionIndex: number;      // for quiz
  currentSectionIndex: number;       // for exam
  currentQuestionInSectionIndex: number; // for exam
  answers: Record<string, string | string[]>;  // keyed by questionId
  flaggedQuestions: Set<string>;     // exam only
  visitedQuestions: Set<string>;     // exam jump-to-question grid state
  startedAt: string | null;
  // Actions
  setAnswer: (questionId: string, value: string | string[]) => void;
  toggleFlag: (questionId: string) => void;
  markVisited: (questionId: string) => void;
  navigateToQuestion: (index: number) => void;
  reset: () => void;
}
```

Store is reset on mount of each taking session to prevent stale state between sessions.

### QuestionDisplay Component (packages/ui)

A shared component that renders the appropriate input for each question type:

```typescript
interface QuestionDisplayProps {
  question: TakingQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
  showError?: boolean;
}
```

Internal rendering by type:
- `radio` → `<RadioGroup>` with shadcn RadioGroupItem per option, selected option visually highlighted
- `checkbox` → `<Checkbox>` per option, multi-select allowed
- `text_input` → `<Input>` with appropriate keyboard type
- `textarea` → `<Textarea>` with auto-resize
- `select` → `<Select>` with shadcn Select component

Keyboard behavior: within a radio/checkbox group, Up/Down arrow keys move focus between options. Enter or Space selects/deselects the focused option.

### Quiz Taking Flow

Component: `QuizTaking`

State driven by `useTakingStore`:
- `currentQuestionIndex`: 0-based index into the flat question array
- Questions are pre-flattened from sections on load (quiz has one section)

Layout:
1. Progress bar: `<Progress value={(currentIndex + 1) / totalQuestions * 100} />` + label "Question N of M"
2. Question prompt (heading level h2)
3. `<QuestionDisplay>` for current question
4. Navigation row: Back button (disabled when index=0), Next button (advances index, validates if required), Submit button (visible on last question only)

Back/Next behavior:
- Next: if question is `required` and has no answer, show inline error message. Do not advance.
- Back: always allowed, no validation.
- Submit: opens a `<ConfirmDialog>` ("Submit your answers?"). On confirm, calls POST response endpoint, on success navigates to `/results/:responseId`.

### Survey Taking Flow

Component: `SurveyTaking`

Layout:
1. Questionnaire title (h1) and optional description
2. All questions rendered in order, each in a `<section>` with question number label
3. Each question uses `<QuestionDisplay>`
4. Required field indicators (asterisk) shown on question labels
5. "Submit Response" button at bottom of page

Validation:
- On Submit click, validate all `required` questions have an answer
- Show inline error messages beneath each failing question
- Scroll to first error
- If all valid, open confirmation dialog, then POST

### Exam Taking Flow

Component: `ExamTaking`

Top bar (sticky):
- Left: section name + overall progress ("Q 3 of 24")
- Center: timer countdown `MM:SS` (if `timeLimitMinutes` is set). Timer stored in Zustand. On expiry: auto-submit.
- Right: "Submit Exam" button

Jump-to-question grid (below top bar):
- Numbered buttons, one per question across all sections
- Visual states: default (unvisited), outline (visited but unanswered), filled/primary (answered), amber (flagged for review)
- Clicking a number navigates directly to that question (updates both section and question-in-section index)
- Section dividers in the grid indicate section boundaries

Question area:
- Section header: section title, section description if present
- Single question rendered with `<QuestionDisplay>`
- "Flag for review" toggle button (bookmark icon) below question

Navigation:
- Previous button: goes to previous question (or last question of previous section)
- Next button: goes to next question (or first question of next section). No validation on Next for exam — respondents can leave questions blank and return.
- On reaching last question, Next becomes disabled.

Submit exam flow:
- "Submit Exam" button always visible
- Opens confirmation dialog showing: total questions, answered count, unanswered count, flagged count
- "Submit anyway" or "Go back and review" options
- On confirm: POST response, navigate to `/results/:responseId`

Timer:
- Initialized from `settings.timeLimitMinutes * 60` seconds
- Counts down using `setInterval` (1-second tick)
- Displayed as MM:SS
- At 5 minutes remaining: timer text turns amber
- At 1 minute remaining: timer text turns red, pulse animation
- At 0: dialog "Time's up! Your exam will be submitted." → auto-POST

## Monorepo Touch Points

**packages/ui:**
- New: `QuestionDisplay` component
- New: `ProgressBar` wrapper (may reuse shadcn Progress)
- New: `ConfirmDialog` component (reusable modal for submit confirmations)
- New: `TimerDisplay` component (exam countdown)
- New: `JumpToQuestionGrid` component (exam navigation grid)

**packages/shared:**
- New: `TakingQuestion`, `TakingQuestionnaire`, `SubmitResponsePayload`, `SubmitResponseResult` Zod schemas + inferred types
- New: `generateRespondentId()` utility function

**apps/api:**
- New: `GET /api/questionnaires/:shareToken/take` route in Hono
- New: `POST /api/questionnaires/:id/responses` route in Hono
- New: Hono middleware to validate share token and return 404/403 appropriately

**apps/web:**
- New: `routes/q/$shareToken.tsx` (TanStack Router)
- New: `features/taking/` directory with Quiz, Survey, Exam components
- New: `stores/takingStore.ts` (Zustand slice)

**packages/db:**
- No schema changes required (responses table should exist from earlier phases)
- Verify: `questionnaires.shareToken` column, `responses` table, `answers` table

## Directory Structure

```
apps/web/src/
  routes/
    q/
      $shareToken.tsx          ← route loader + type dispatcher
  features/
    taking/
      QuizTaking.tsx           ← quiz flow component
      SurveyTaking.tsx         ← survey flow component
      ExamTaking.tsx           ← exam flow component
      QuizTaking.test.tsx
      SurveyTaking.test.tsx
      ExamTaking.test.tsx
  stores/
    takingStore.ts             ← Zustand store for in-progress session

packages/ui/src/
  components/
    question-display/
      QuestionDisplay.tsx
      QuestionDisplay.stories.tsx
    confirm-dialog/
      ConfirmDialog.tsx
    timer-display/
      TimerDisplay.tsx
    jump-to-question-grid/
      JumpToQuestionGrid.tsx

packages/shared/src/
  schemas/
    taking.ts                  ← Zod schemas for taking API contracts

apps/api/src/
  routes/
    taking.ts                  ← /questionnaires/:shareToken/take
    responses.ts               ← /questionnaires/:id/responses
  services/
    taking.service.ts          ← business logic for share token lookup
    response.service.ts        ← response storage logic
```

## Implementation Steps

1. **Define shared Zod schemas for taking API contracts**
   - Add `TakingQuestionnaire`, `TakingSection`, `TakingQuestion` schemas to `packages/shared/src/schemas/taking.ts`
   - Add `SubmitResponsePayload` and `SubmitResponseResult` schemas
   - Export all types from `packages/shared/src/index.ts`

2. **Implement ShareToken API endpoint**
   - Create `apps/api/src/routes/taking.ts` with `GET /questionnaires/:shareToken/take`
   - Query questionnaires table by shareToken column
   - Return 404 for missing, 403 for draft/archived status
   - Join sections and questions, strip correct answer fields from response
   - Write `apps/api/src/services/taking.service.ts`

3. **Implement Response Submission API endpoint**
   - Create `apps/api/src/routes/responses.ts` with `POST /questionnaires/:id/responses`
   - Validate payload with Zod against `SubmitResponsePayload`
   - Store response record and all answer records in D1 using a D1 batch transaction
   - Return `responseId` and computed `redirectUrl`
   - Write `apps/api/src/services/response.service.ts`

4. **Build QuestionDisplay component in packages/ui**
   - Implement `QuestionDisplay` handling all 5 question types
   - Use shadcn RadioGroup, Checkbox, Input, Textarea, Select primitives
   - Implement keyboard navigation within radio/checkbox groups
   - Write Storybook stories for each question type
   - Export from `@quiz/ui`

5. **Build ConfirmDialog, TimerDisplay, and JumpToQuestionGrid components**
   - `ConfirmDialog`: accessible modal using shadcn Dialog, accepts title/description/confirm label/cancel label props
   - `TimerDisplay`: formats seconds to MM:SS, accepts color variant (normal/warning/danger)
   - `JumpToQuestionGrid`: renders numbered grid with 4 visual states (unvisited/visited/answered/flagged)

6. **Implement Zustand taking store**
   - Create `apps/web/src/stores/takingStore.ts`
   - Implement all state fields and actions per spec
   - Include `reset()` action called on store unmount (useEffect cleanup in route component)

7. **Implement TanStack Router route for `/q/:shareToken`**
   - Create `apps/web/src/routes/q/$shareToken.tsx`
   - Route loader: calls `GET /api/questionnaires/:shareToken/take`, handles 404/403 with error boundaries
   - On load success: dispatch to `<QuizTaking>`, `<SurveyTaking>`, or `<ExamTaking>` based on `questionnaire.type`
   - Initialize Zustand store with loaded questionnaire data

8. **Implement Quiz Taking flow component**
   - Create `apps/web/src/features/taking/QuizTaking.tsx`
   - Single question display, progress bar, Back/Next/Submit navigation
   - Required field validation on Next
   - Submit confirmation dialog
   - On confirm: POST to responses endpoint, navigate to results

9. **Implement Survey Taking flow component**
   - Create `apps/web/src/features/taking/SurveyTaking.tsx`
   - All questions on single page
   - Submit-time required field validation
   - Error scroll behavior
   - Submit confirmation dialog + POST

10. **Implement Exam Taking flow component**
    - Create `apps/web/src/features/taking/ExamTaking.tsx`
    - Sticky top bar with timer, section info, submit button
    - Jump-to-question grid with visual states
    - Single question per page with section context
    - Flag for review toggle
    - Auto-submit on timer expiry
    - Submit confirmation dialog showing answer count summary

11. **Implement anonymous respondent UUID generation**
    - Add `generateRespondentId()` to `packages/shared/src/utils/respondent.ts`
    - Call from taking route on mount, store/retrieve from localStorage key `questify_respondent_id`

12. **Keyboard navigation and accessibility pass**
    - Ensure all interactive elements in taking flows are reachable by keyboard
    - Tab order follows visual order
    - Arrow key navigation within radio/checkbox groups
    - Screen reader labels for progress bar, timer, jump grid buttons
    - Focus management between questions on navigation (focus the question prompt h2)

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1100 | Define Zod schemas for taking API contracts in packages/shared | chore | Sage | P0 |
| QZ-1101 | Implement ShareToken API endpoint (GET /questionnaires/:shareToken/take) | feature | Sage | P0 |
| QZ-1102 | Implement Response Submission API endpoint (POST /questionnaires/:id/responses) | feature | Sage | P0 |
| QZ-1103 | Build QuestionDisplay component in packages/ui for all 5 field types | feature | Nova | P0 |
| QZ-1104 | Build ConfirmDialog, TimerDisplay, JumpToQuestionGrid UI components | feature | Milo | P1 |
| QZ-1105 | Implement Zustand taking store | chore | Nova | P0 |
| QZ-1106 | Implement TanStack Router route /q/:shareToken with type dispatcher | feature | Nova | P0 |
| QZ-1107 | Implement Quiz Taking flow component | feature | Nova | P0 |
| QZ-1108 | Implement Survey Taking flow component | feature | Nova | P0 |
| QZ-1109 | Implement Exam Taking flow component | feature | Nova | P1 |
| QZ-1110 | Implement anonymous respondent UUID (localStorage) | chore | Nova | P1 |
| QZ-1111 | Keyboard navigation and accessibility pass for all taking flows | chore | Milo | P1 |

## Acceptance Criteria

- [ ] Visiting `/q/:validShareToken` for a quiz-type questionnaire shows the first question and a progress bar
- [ ] Quiz Back button is disabled on the first question
- [ ] Quiz Next button shows inline error if question is required and unanswered
- [ ] Quiz Submit button on last question opens a confirmation dialog before submitting
- [ ] Visiting `/q/:validShareToken` for a survey shows all questions on one page
- [ ] Survey Submit validates all required questions before POSTing
- [ ] Visiting `/q/:validShareToken` for an exam shows the timer, section header, and jump grid
- [ ] Exam flag-for-review toggle marks the question with the amber visual state in the jump grid
- [ ] Exam auto-submits when timer reaches 0
- [ ] Exam submit confirmation dialog shows unanswered/flagged question counts
- [ ] All three flows POST to `/api/questionnaires/:id/responses` on submit
- [ ] After successful submission, browser navigates to `/results/:responseId`
- [ ] Visiting `/q/:invalidToken` shows a 404 error state
- [ ] Visiting `/q/:draftToken` shows a 403 / "not available" error state
- [ ] All question types render correctly in `<QuestionDisplay>`
- [ ] Keyboard: radio options navigable with arrow keys, selectable with Enter/Space
- [ ] Anonymous respondent UUID is generated and stored in localStorage on first visit

## Out of Scope

- Score calculation on submit — handled in PHASE-12 (results page loads score separately)
- Authenticated-only access to questionnaires — v1 is fully public share links
- Saving progress mid-session (resumable sessions) — not in v1
- File upload question type — not a planned field type
- Real-time collaboration or multi-device sync
- Rich text in question prompts — plain text only for v1

## Phase Dependencies

- **PHASE-01 (Monorepo Setup) must be complete** because the package workspace structure is required for `@quiz/ui` and `@quiz/shared` imports
- **PHASE-02 (Database Schema) must be complete** because `questionnaires`, `sections`, `questions`, `responses`, `answers` tables must exist
- **PHASE-03 (API Foundation) must be complete** because the Hono app structure and D1 bindings are prerequisites for new routes
- **PHASE-04 (Authentication) must be complete** because the responses POST endpoint needs to handle the authenticated vs. anonymous respondent distinction
- **PHASE-05 (Design System) must be complete** because `QuestionDisplay` depends on shadcn primitives being configured in `packages/ui`
- **PHASE-09 (Questionnaire Builder) must be complete** because taking flows require published questionnaires with share tokens to exist

## Agent Assignments

- **Architect:** Write ADR-011 (answer state management), ADR-012 (anonymous respondent identity), STANDARD-taking-flow-routing
- **Dev/Sage (Backend):** QZ-1100, QZ-1101, QZ-1102 — API endpoints and shared schemas
- **Dev/Nova (Frontend):** QZ-1103, QZ-1105, QZ-1106, QZ-1107, QZ-1108, QZ-1109, QZ-1110 — all taking flow components and route
- **Dev/Milo (Visual/CSS):** QZ-1104, QZ-1111 — UI primitives and accessibility/keyboard pass
- **QA/Ivy:** Write test cases for all three taking flows, verify edge cases (expired token, required field validation, timer expiry)
- **DevOps/Axel:** No specific tasks this phase
- **Remy (Producer):** Triage tickets, confirm wireframe fidelity for each flow type before sign-off

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Timer drift in exam flow (setInterval is not precise) | Medium | Medium | Use Date-based elapsed time calculation instead of tick counting; reconcile on each tick |
| Zustand state persisting between sessions (browser back/forward) | Medium | High | Call `reset()` in route unmount; check stale state on route load |
| ShareToken UUID collision | Low | High | Use UUID v4 (128-bit); collision probability negligible at scale |
| D1 batch write for response + answers fails partially | Low | High | Wrap in D1 batch transaction; return error to client if any write fails |
| QuestionDisplay accessibility non-compliance for checkbox groups | Medium | Medium | Follow WAI-ARIA 1.1 group + checkbox pattern; test with axe-core before merge |

## Estimated Effort

L
