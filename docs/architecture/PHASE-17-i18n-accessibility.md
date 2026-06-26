---
phase: 17
title: "Internationalization & Accessibility"
status: pending
depends_on: ["PHASE-11", "PHASE-12", "PHASE-13", "PHASE-14", "PHASE-15"]
estimated_tickets: 5
---

# PHASE-17 — Internationalization & Accessibility

## Overview

This phase adds internationalization (i18n) support and performs a comprehensive accessibility pass across all user-facing interfaces. These concerns are addressed together because both require touching nearly every component in the application: i18n replaces every hardcoded string, and accessibility requires reviewing every interactive element, form, and dynamic content region.

The i18n approach uses `react-i18next` with `i18next`, extracting all user-visible English strings into JSON translation files. For v1, only English is shipped as a complete language, but the infrastructure is in place for a second language to be added with minimal friction. An in-app language switcher is included but the switcher only shows once a second locale is configured.

The accessibility work targets WCAG 2.1 Level AA compliance. The focus areas are: proper focus management in the taking flows (where keyboard users navigate between questions), accessible form labeling (all inputs linked to visible labels via `for`/`id` or `aria-labelledby`), focus trapping in modal dialogs, and screen reader announcements for dynamic content (progress bar changes, question navigation). The `@axe-core/react` library is added in development mode to surface violations in the console during development. Playwright accessibility tests using `@axe-core/playwright` are added to the E2E suite (integrated with PHASE-19).

## Goals

- [ ] Configure `react-i18next` in `apps/web` with English base locale
- [ ] Extract all hardcoded user-visible strings in `apps/web/src` to `locales/en/translation.json`
- [ ] Establish key naming convention `namespace.component.key` and enforce via `STANDARD-i18n-strings`
- [ ] Add `@axe-core/react` to dev-only dependency for console violation reporting
- [ ] Fix focus management in Quiz/Exam taking flows: focus moves to question prompt on navigation
- [ ] Fix form accessibility: all inputs have visible labels, errors linked via `aria-describedby`
- [ ] Fix modal accessibility: focus trap in dialogs, Escape closes, focus returns to trigger on close
- [ ] Add `aria-label` to all icon-only buttons (close, flag, navigation arrows)
- [ ] Add `aria-live` regions for dynamic content (timer countdown, score loading states)
- [ ] Ensure all page routes update `document.title`
- [ ] Add keyboard alternative for exam jump-to-question grid (focus navigation)
- [ ] Add `STANDARD-i18n-strings` and `STANDARD-accessibility-baseline` documents

## Architecture Decisions Required

**ADR-023: i18n library selection (react-i18next vs. @lingui/react)** — Compare `react-i18next` (larger ecosystem, JSON-based keys) against `@lingui/react` (compile-time extraction, ICU message format). Recommend `react-i18next` for its lower learning curve and alignment with JSON workflows. Document the trade-offs.

**STANDARD-i18n-strings:** No hardcoded UI strings in JSX. All user-visible text must use `t()` from `useTranslation()`. Exceptions: strings that are always in English regardless of locale (e.g., the app name "Questify"). Key format: `namespace.componentName.elementDescription`.

**STANDARD-accessibility-baseline:** WCAG 2.1 AA is the minimum bar. Defines: all interactive elements must be focusable via Tab, all form inputs must have visible labels (not placeholder-only), all error messages must be linked via `aria-describedby`, all dialogs must trap focus, all images must have `alt` attributes, all dynamic content regions must use `aria-live` appropriately.

## Technical Architecture

### i18n Setup

Install in `apps/web`:
```
react-i18next
i18next
i18next-browser-languagedetector
```

Configuration file `apps/web/src/i18n/config.ts`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from '../locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,   // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

Initialize in `apps/web/src/main.tsx` (import side-effect before React render).

### Translation File Structure

`apps/web/src/locales/en/translation.json`:

```json
{
  "common": {
    "backToHome": "Back to home",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "loading": "Loading...",
    "error": {
      "notFound": "Not found",
      "forbidden": "You do not have permission to view this page",
      "generic": "Something went wrong. Please try again."
    }
  },
  "nav": {
    "explore": "Explore",
    "myQuizzes": "My Quizzes",
    "drafts": "Drafts",
    "createNow": "+ Create now",
    "signIn": "Sign in",
    "categories": {
      "heading": "Categories",
      "education": "Education",
      "triviaFun": "Trivia & Fun",
      "health": "Health",
      "productResearch": "Product Research",
      "personality": "Personality"
    }
  },
  "taking": {
    "quiz": {
      "questionProgress": "Question {{current}} of {{total}}",
      "back": "Back",
      "next": "Next",
      "submit": "Submit",
      "confirmTitle": "Submit your answers?",
      "confirmDescription": "You cannot change your answers after submitting.",
      "confirmButton": "Submit",
      "requiredError": "This question is required."
    },
    "survey": {
      "submitButton": "Submit Response",
      "confirmTitle": "Submit your response?",
      "confirmButton": "Submit"
    },
    "exam": {
      "flagForReview": "Flag for review",
      "unflagForReview": "Unflag",
      "submitExam": "Submit Exam",
      "confirmTitle": "Submit exam?",
      "confirmAnsweredCount": "{{answered}} of {{total}} questions answered",
      "confirmUnanswered_one": "{{count}} question unanswered",
      "confirmUnanswered_other": "{{count}} questions unanswered",
      "timeUp": "Time's up! Your exam will be submitted.",
      "timeWarning": "5 minutes remaining"
    }
  },
  "results": {
    "quiz": {
      "scoreLabel": "{{correct}} / {{total}}",
      "reviewAnswers": "Review answers",
      "tryAgain": "Try again",
      "shareResult": "Share result",
      "correct": "Correct",
      "incorrect": "Incorrect",
      "performanceNice": "Nice work!",
      "performanceAlmost": "Almost!",
      "performanceKeepGoing": "Keep practicing!"
    },
    "survey": {
      "heading": "Thank you!",
      "backToHome": "Back to home",
      "shareSurvey": "Share survey"
    },
    "exam": {
      "submitted": "Exam submitted",
      "sectionBreakdown": "Section breakdown",
      "reviewPerQuestion": "Review per question",
      "passed": "Passed",
      "failed": "Failed"
    }
  },
  "feed": {
    "searchPlaceholder": "Search questionnaires...",
    "filterType": "All types",
    "sortPopular": "Popular",
    "sortRecent": "Recent",
    "sortTrending": "Trending",
    "emptyTitle": "No questionnaires found",
    "emptyDescription": "Try adjusting your search or filters.",
    "clearFilters": "Clear filters",
    "featuredBadge": "Featured",
    "takes": "{{count}} takes"
  }
}
```

Additional namespaces are added as needed. The `translation.json` file grows over the course of this phase as strings are extracted.

### useTranslation Hook Usage Pattern

Every component that contains user-visible strings must call `useTranslation()`:

```typescript
import { useTranslation } from 'react-i18next';

export function QuizNavigation({ current, total }: Props) {
  const { t } = useTranslation();
  return (
    <p aria-label={t('taking.quiz.questionProgress', { current, total })}>
      {t('taking.quiz.questionProgress', { current, total })}
    </p>
  );
}
```

Interpolation uses double-brace syntax: `{{variableName}}`. Pluralization uses `_one` / `_other` key suffixes with `count` interpolation variable.

### Date and Number Formatting

Never use `new Date().toLocaleDateString()` directly in JSX. Use:

```typescript
// Dates
new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(isoString))

// Numbers (scores, counts)
new Intl.NumberFormat(i18n.language).format(count)

// Percentages
new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(0.76)
```

These can be wrapped in small utility functions in `packages/shared/src/utils/formatters.ts`.

### @axe-core/react Setup

In `apps/web/src/main.tsx`, conditionally initialize axe-core in development:

```typescript
if (import.meta.env.DEV) {
  const { default: React } = await import('react');
  const { default: ReactDOM } = await import('react-dom');
  const axe = await import('@axe-core/react');
  axe.default(React, ReactDOM, 1000);
}
```

This logs accessibility violations to the browser console during development. It is never bundled in production builds due to the `import.meta.env.DEV` guard.

### Focus Management in Taking Flows

**Quiz flow:** When the user navigates to a new question (Next/Back), focus must move to the question heading (`h2`) element. Implement using a `ref` on the heading and `ref.current.focus()` after the index update:

```typescript
const questionHeadingRef = useRef<HTMLHeadingElement>(null);

const handleNext = () => {
  setCurrentIndex(i => i + 1);
  // Focus after state update
  setTimeout(() => questionHeadingRef.current?.focus(), 0);
};
```

The heading must have `tabIndex={-1}` to be programmatically focusable without being in the natural tab order.

**Exam flow:** Same pattern for question navigation and for jump-to-question grid clicks.

**Screen reader announcements:** Add an `aria-live="polite"` region for the progress announcement:
```html
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {t('taking.quiz.questionProgress', { current: currentIndex + 1, total: questions.length })}
</div>
```

### Form Accessibility Requirements

All form inputs must follow this pattern:

```html
<!-- Input with visible label -->
<label for="bio-input">Bio</label>
<textarea id="bio-input" aria-describedby="bio-error bio-help" />
<p id="bio-help">Maximum 500 characters</p>
<p id="bio-error" role="alert">...</p>  <!-- only when error exists -->
```

shadcn form components (`<FormField>`, `<FormLabel>`, `<FormMessage>`) already implement this pattern when used correctly. The audit must verify that all usages in sign-in, sign-up, builder, profile edit forms follow this pattern.

Never use placeholder text as the sole label. Every input must have a visible `<label>` or `aria-label`.

### Modal/Dialog Accessibility

All shadcn `<Dialog>` components automatically implement focus trapping (via Radix UI). The audit must verify:
- Focus moves to the dialog when it opens (shadcn default behavior)
- `Escape` key closes the dialog (shadcn default behavior)
- Focus returns to the trigger element when the dialog closes
- The dialog has a descriptive `aria-labelledby` pointing to the dialog title

For the Confirm dialogs used in taking flows:
```tsx
<Dialog onOpenChange={setOpen}>
  <DialogContent aria-labelledby="confirm-title" aria-describedby="confirm-desc">
    <DialogTitle id="confirm-title">{t('taking.quiz.confirmTitle')}</DialogTitle>
    <DialogDescription id="confirm-desc">
      {t('taking.quiz.confirmDescription')}
    </DialogDescription>
    ...
  </DialogContent>
</Dialog>
```

### Timer Accessibility (Exam)

The exam timer is a dynamic region. Use `aria-live="off"` on the timer display (announcing every second would be disruptive). Instead, announce key thresholds using a separate `aria-live="assertive"` region:

```typescript
useEffect(() => {
  if (secondsRemaining === 300) announce(t('taking.exam.timeWarning'));  // 5 min
  if (secondsRemaining === 0) announce(t('taking.exam.timeUp'));
}, [secondsRemaining]);
```

Where `announce` writes to a visually-hidden `aria-live="assertive"` div.

### Document Title Updates

Each route must update `document.title` using TanStack Router's `head` option:

```typescript
export const Route = createFileRoute('/q/$shareToken')({
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData.questionnaire.title} — Questify` }],
  }),
});
```

Default title (for unauthenticated or pre-load states): `"Questify"`.

Routes that need title updates:
- `/` → "Questify — Discover Questionnaires"
- `/q/:shareToken` → "{Questionnaire Title} — Questify"
- `/results/:responseId` → "Your Results — Questify"
- `/profile/:username` → "{Username}'s Profile — Questify"
- `/my-analytics` → "Analytics — Questify"
- `/analytics/:id` → "{Title} Analytics — Questify"
- `/admin/*` → "Admin — Questify"
- `/sign-in` → "Sign In — Questify"
- `/sign-up` → "Sign Up — Questify"

### Keyboard Navigation Audit Checklist

The accessibility pass must verify:

- [ ] Tab order follows visual order on every page
- [ ] All interactive elements (buttons, links, inputs) are reachable by Tab
- [ ] No focus traps outside of modals
- [ ] Radio groups: Up/Down arrow keys navigate between options
- [ ] Checkbox groups: Space toggles, Tab moves to next option
- [ ] Exam jump-to-question grid: Tab to navigate between question buttons, Enter to jump
- [ ] Dropdown menus (shadcn Select): Up/Down arrow to navigate options, Enter to select, Escape to close
- [ ] Skip navigation link at top of page (visible on focus): "Skip to main content"

### Color Contrast Audit

shadcn with Maia variant handles most color tokens. The audit must verify:
- All body text: minimum 4.5:1 contrast ratio against background
- Large text (18pt+ or 14pt+ bold): minimum 3:1 ratio
- Interactive element focus outlines: visible against background (2px solid with sufficient contrast)
- Type badges (Quiz/Survey/Exam): verify badge text contrast on colored backgrounds
- Timer warning (amber text): verify contrast in both normal and dark mode (if applicable)

Use browser DevTools accessibility panel or `axe-core` violations report to identify failures.

## Monorepo Touch Points

**apps/web:**
- New: `src/i18n/config.ts`
- New: `src/locales/en/translation.json`
- New: `src/hooks/useAnnounce.ts` (aria-live announcement hook)
- Modified: every component containing hardcoded strings → use `t()`
- Modified: `src/main.tsx` (import i18n config, conditional axe-core init)
- Modified: all route files → add `head` config for document.title
- Modified: taking flow components → focus management
- Modified: all form components → verify label/aria-describedby patterns

**packages/shared:**
- New: `src/utils/formatters.ts` (date/number Intl formatters)

**packages/ui:**
- Modified: any components with hardcoded strings → accept string props from consumers (UI library components should not call `t()` directly — strings come in as props)

## Directory Structure

```
apps/web/src/
  i18n/
    config.ts                    ← i18next initialization
  locales/
    en/
      translation.json           ← all English strings
  hooks/
    useAnnounce.ts               ← aria-live announcement helper

packages/shared/src/
  utils/
    formatters.ts                ← Intl date/number formatters

docs/architecture/
  STANDARD-i18n-strings.md      ← i18n string standards
  STANDARD-accessibility-baseline.md  ← accessibility standards
```

## Implementation Steps

1. **Install and configure react-i18next**
   - Install `react-i18next`, `i18next`, `i18next-browser-languagedetector` in `apps/web`
   - Create `apps/web/src/i18n/config.ts`
   - Create empty `apps/web/src/locales/en/translation.json`
   - Import config in `apps/web/src/main.tsx`

2. **Extract strings from taking flow components**
   - Audit `features/taking/QuizTaking.tsx`, `SurveyTaking.tsx`, `ExamTaking.tsx`
   - Replace all hardcoded strings with `t()` calls
   - Add all extracted keys to `translation.json` under `taking.*` namespace

3. **Extract strings from results page components**
   - Audit all files in `features/results/`
   - Replace hardcoded strings, add to `translation.json` under `results.*`

4. **Extract strings from feed and navigation components**
   - Audit `features/feed/`, `TopNav.tsx`, `HomeSidebar.tsx`
   - Replace hardcoded strings, add to `translation.json` under `feed.*` and `nav.*`

5. **Extract strings from auth forms and profile components**
   - Audit sign-in, sign-up forms and profile components
   - Replace hardcoded strings, add to `translation.json` under `auth.*` and `profile.*`

6. **Add Intl formatters to packages/shared and audit date/number usage**
   - Create `packages/shared/src/utils/formatters.ts`
   - Find all raw `toLocaleDateString()`, `.toFixed()`, raw number formatting in JSX
   - Replace with Intl formatter utilities

7. **Add @axe-core/react for development**
   - Install `@axe-core/react` as dev dependency in `apps/web`
   - Add conditional initialization in `apps/web/src/main.tsx`
   - Verify it logs to console in dev mode (does not add to production bundle)

8. **Fix focus management in Quiz and Exam taking flows**
   - Add `tabIndex={-1}` to question heading elements
   - Add `ref` and `focus()` call on question navigation (Next/Back/JumpToQuestion)
   - Add `aria-live="polite"` progress announcement region
   - Test with browser DevTools and keyboard-only navigation

9. **Audit and fix form accessibility**
   - Check all forms: sign-in, sign-up, builder question fields, profile edit
   - Ensure every input has a visible `<label>` (not placeholder-only)
   - Ensure all error messages use `aria-describedby`
   - Fix any cases where shadcn FormField is not wired correctly

10. **Audit and fix modal/dialog accessibility**
    - Check all `<Dialog>` / `<AlertDialog>` usage across the app
    - Verify `aria-labelledby` on DialogContent pointing to DialogTitle
    - Verify focus returns to trigger element on close
    - Test with keyboard: Escape closes, focus traps inside while open

11. **Add document.title updates to all routes**
    - Add `head` configuration to each TanStack Router route file
    - Define title patterns per the spec above

12. **Add skip navigation link**
    - Add "Skip to main content" anchor as first focusable element in root layout
    - Target: `<main id="main-content">` element
    - Visible only on focus (CSS: `sr-only focus:not-sr-only`)

13. **Write STANDARD-i18n-strings and STANDARD-accessibility-baseline documents**
    - Create `docs/architecture/STANDARD-i18n-strings.md`
    - Create `docs/architecture/STANDARD-accessibility-baseline.md`

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1700 | Install and configure react-i18next in apps/web | chore | Nova | P0 |
| QZ-1701 | Extract all hardcoded strings from taking flow and results components | chore | Nova | P0 |
| QZ-1702 | Extract all hardcoded strings from feed, nav, auth, and profile components | chore | Nova | P0 |
| QZ-1703 | Fix focus management in Quiz and Exam taking flows | chore | Nova | P0 |
| QZ-1704 | Audit and fix form accessibility (labels, aria-describedby, error linking) | chore | Milo | P0 |
| QZ-1705 | Audit and fix modal/dialog accessibility (focus trap, return focus) | chore | Milo | P1 |
| QZ-1706 | Add document.title updates to all routes | chore | Nova | P1 |
| QZ-1707 | Add @axe-core/react dev-only initialization | chore | Nova | P1 |
| QZ-1708 | Add skip navigation link and keyboard navigation audit | chore | Milo | P1 |
| QZ-1709 | Write STANDARD-i18n-strings and STANDARD-accessibility-baseline | chore | Nova | P2 |

## Acceptance Criteria

- [ ] All user-visible strings in `apps/web` use `t()` — no hardcoded English strings in JSX (except app name)
- [ ] `apps/web/src/locales/en/translation.json` exists and contains all extracted string keys
- [ ] Adding `?lng=en` or switching language in `localStorage` uses the i18n system (validates wiring)
- [ ] `@axe-core/react` logs accessibility violations in development console (axe warnings visible on known issues before fix)
- [ ] After fixes: `@axe-core/react` reports zero critical or serious violations on all major pages
- [ ] Quiz taking: Tab key navigates through all interactive elements; arrow keys navigate radio options
- [ ] Quiz taking: focus moves to question heading when navigating between questions
- [ ] Screen reader announces "Question N of M" on navigation (aria-live region fires)
- [ ] All form inputs have visible labels (not placeholder-only)
- [ ] All form error messages are linked via `aria-describedby`
- [ ] All dialog/modal components trap focus while open
- [ ] Pressing Escape closes any open dialog
- [ ] Focus returns to the trigger button when a dialog is closed
- [ ] `document.title` updates on each route navigation
- [ ] "Skip to main content" link is visible when focused via keyboard
- [ ] Exam timer announces "5 minutes remaining" and "Time's up!" via aria-live

## Out of Scope

- Second language (non-English) locale — infrastructure is ready but strings not translated for v1
- URL-based locale routing (`/en/...`, `/es/...`) — in-app switcher only for v1
- Right-to-left (RTL) language support — not in v1
- Automated WCAG AA compliance certificate — manual review + axe-core reports only
- Builder accessibility audit — builder UI is complex (drag-and-drop); keyboard alternative for reorder is in scope but full builder keyboard audit is deferred

## Phase Dependencies

- **All feature phases (PHASE-11 through PHASE-15) must be complete** because string extraction and accessibility fixes require all UI components to exist
- **PHASE-05 (Design System) must be complete** because shadcn components' built-in accessibility behavior depends on correct Radix UI setup

## Agent Assignments

- **Architect:** Write ADR-023 (i18n library selection), STANDARD-i18n-strings, STANDARD-accessibility-baseline
- **Dev/Nova (Frontend):** QZ-1700, QZ-1701, QZ-1702, QZ-1703, QZ-1706, QZ-1707, QZ-1709 — i18n setup and string extraction
- **Dev/Milo (Visual/CSS):** QZ-1704, QZ-1705, QZ-1708 — accessibility fixes, focus management, keyboard nav
- **QA/Ivy:** Run axe-core audit against all pages, create bug reports for any violations found, verify all acceptance criteria with keyboard-only navigation
- **DevOps/Axel:** No tasks this phase
- **Remy (Producer):** Review string extraction for UX copy correctness, flag any strings that need copywriter review

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| String extraction is tedious and PRs are large, increasing review risk | High | Medium | Break extraction into per-feature PRs (taking, results, feed, auth) to keep diffs manageable |
| i18n interpolation syntax errors cause runtime crashes | Medium | High | Enable TypeScript type-checking for i18next keys using `i18next-typescript` plugin; catch at build time |
| axe-core identifies violations that cannot be fixed without redesign | Low | Medium | Triage violations by severity; critical/serious must be fixed, moderate can be deferred with documented decision |
| Focus management `setTimeout` approach is fragile under React concurrent mode | Medium | Low | Use `flushSync` or `useEffect` with a flag instead of `setTimeout`; test in React StrictMode |

## Estimated Effort

L
