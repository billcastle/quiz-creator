---
phase: 05
title: "Custom UI Components"
status: pending
depends_on: ["PHASE-04"]
estimated_tickets: 8
---

# PHASE-05: Custom UI Components

## Overview

This phase builds all quiz-domain-specific components that live in `packages/ui/src/components/quiz/`. These are the application-specific components not covered by shadcn/ui — derived directly from the wireframes. They have no business logic: no API calls, no Zustand stores, no TanStack Query. Every component accepts typed props and is fully reusable across any page or feature that needs it.

The guiding principle is a **pure presentational layer**: these components are dumb by design. All data fetching, mutation, and state orchestration happens in a separate app layer (PHASE-08 onwards). Keeping this boundary strict means the components can be developed, tested, and iterated on entirely in isolation — no backend required.

---

## Technical Architecture

### Component Architecture Rules

All components in this phase adhere to a strict set of conventions to ensure consistency, type safety, and reusability:

- **Location**: All components live under `packages/ui/src/components/quiz/`. No quiz-domain component lives anywhere else in the UI package.
- **File structure**: Simple single-file components use a flat file — `quiz-card.tsx`. Complex components with sub-parts use a folder — `quiz-card/index.tsx`. Both approaches are acceptable; use folders only when a component has internal helper sub-components that should not be exported.
- **Barrel exports**: Every component is exported by name from `packages/ui/src/index.ts`. No default exports anywhere in this package. Consumers import as `import { QuestionCard, TypeBadge } from '@questify/ui'`.
- **Props interfaces**: Every component defines a TypeScript `interface` (not `type`) named `[ComponentName]Props`. This interface is also exported so consumers can reference it for type composition.
- **className passthrough**: Every component accepts an optional `className?: string` prop. This is always merged using the `cn()` utility (from `@questify/ui/lib/utils`) so that consumer-provided classes override defaults correctly via Tailwind Merge.
- **No React.FC**: Components are declared as plain functions with a typed parameter: `function ComponentName({ prop }: ComponentNameProps)`. The return type is inferred.
- **No side effects**: No `fetch`, no `axios`, no store subscriptions, no `useEffect` for data fetching. The only hooks permitted are `useState` for purely local UI state (e.g., a dropdown open/close toggle, a countdown interval).
- **Children**: When a component accepts children, the prop is typed as `children: React.ReactNode`.
- **Accessibility**: All interactive elements use semantic HTML and include appropriate ARIA attributes. Buttons have `aria-label` where icon-only. Form controls are associated with labels via `htmlFor`/`id`.
- **Styling**: Tailwind CSS utility classes only. No inline styles except for truly dynamic values (e.g., SVG arc calculations). CSS variables from the design token layer (defined in PHASE-04) are used for brand colors.

---

### Group 1 — Navigation & Layout Components

These components form the outer shell of the application. They are structural and appear on nearly every page.

#### `AppShell` (`app-shell.tsx`)

**Purpose**: The top-level layout wrapper. Renders the fixed top navigation bar and provides a slot for page content.

**Props interface**:
```ts
interface AppShellProps {
  children: React.ReactNode;
  user?: {
    username: string;
    avatarUrl?: string;
  };
  onSignIn?: () => void;
  className?: string;
}
```

**Layout specification**:
- Fixed top navigation bar, height 64px, `z-index: 50` (above all content, below modals)
- Left zone: Questify wordmark/logo, links to home
- Center zone: Search input (`Input` from shadcn, placeholder "Search quizzes…"), full-width on md+, hidden on mobile (shown via icon trigger)
- Right zone: If `user` is provided, render a dropdown `Avatar` + username with sign-out option. If `user` is undefined, render a "Sign In" `Button` that calls `onSignIn`
- Content area below the nav: `<main>` element with `pt-16` (64px offset) wrapping `children`
- The component does not control sidebar state — that is handled by `PageLayout`

#### `SideNav` (`side-nav.tsx`)

**Purpose**: Vertical navigation menu. Used inside `PageLayout` as the sidebar slot.

**Props interface**:
```ts
interface SideNavProps {
  activeItem?: string;
  onNavigate?: (item: string) => void;
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  className?: string;
}
```

**Layout specification**:
- Width: 240px (fixed)
- Static nav items (top section): Explore (`slug: 'explore'`), My Quizzes (`slug: 'my-quizzes'`), Drafts (`slug: 'drafts'`)
- Visual separator (`<hr>` or `Separator` from shadcn) between static items and dynamic categories
- Dynamic categories section: renders each item from `categories` prop as a nav link. If `categories` is undefined or empty, the section is omitted
- Active item: highlighted with primary brand color left border accent + background tint. Determined by comparing each item's slug against `activeItem`
- Collapsible on mobile: on `lg` breakpoint and below, the sidebar is hidden by default and shown only when triggered externally (via `PageLayout`'s Sheet integration)
- Each nav item calls `onNavigate(slug)` on click — the consumer handles actual routing

#### `PageLayout` (`page-layout.tsx`)

**Purpose**: Composes `SideNav` + content area into a responsive two-column layout.

**Props interface**:
```ts
interface PageLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}
```

**Layout specification**:
- On `lg+`: Two-column grid. Left column: `sidebar` slot (240px fixed), right column: `children` (flex-1)
- On `< lg`: Single column. Sidebar is hidden. A hamburger/menu button in the `header` slot (or in `AppShell`) triggers a `Sheet` (shadcn) from the left that renders the `sidebar` slot
- Optional `header` slot rendered above the two-column area (useful for breadcrumbs, page titles)
- Main content area: `max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8` padding

---

### Group 2 — Discovery / Feed Components

These components populate the Explore/Home pages. They present questionnaire metadata and enable browsing.

#### `QuestionnaireCard` (`questionnaire-card.tsx`)

**Purpose**: The primary discovery unit. Represents a single questionnaire in a grid or list.

**Props interface**:
```ts
interface QuestionnaireCardProps {
  id: string;
  title: string;
  type: 'quiz' | 'survey' | 'exam';
  category?: string;
  takeCount: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  creatorUsername: string;
  onClick?: () => void;
  className?: string;
}
```

**Layout specification**:
- Uses shadcn `Card` as the root element with `cursor-pointer` and `hover:shadow-md transition-shadow`
- Top-right corner: `TypeBadge` component (see below) showing the questionnaire type
- Title: bold, 2-line clamp with `line-clamp-2`
- Creator line: `@{creatorUsername}` in muted text
- Footer row (flex space-between): left = `{takeCount} takes` with a play icon; right = `{category}` chip (if present) using shadcn `Badge` variant outline
- Difficulty indicator: small colored dot (green/yellow/red) before the take count if `difficulty` is provided
- Entire card is wrapped in a `button` element (or `role="button"`) that calls `onClick`

#### `FeaturedBanner` (`featured-banner.tsx`)

**Purpose**: Hero-style full-width promotional banner for a featured questionnaire.

**Props interface**:
```ts
interface FeaturedBannerProps {
  title: string;
  description?: string;
  type: 'quiz' | 'survey' | 'exam';
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}
```

**Layout specification**:
- Full-width container, height approximately 200px, rounded-xl
- Background: gradient from primary brand color to a darker variant (e.g., `from-blue-600 to-blue-900`), overridable via CSS variable
- `TypeBadge` in top-left (white/inverted variant)
- Large title (`text-3xl font-bold text-white`), one-line clamp
- Optional description beneath title in `text-white/80`
- CTA `Button` in the bottom-right area; defaults to `ctaLabel ?? 'Take Now'`. Calls `onCta` on click. Uses white outline variant on dark background.

#### `CategoryRail` (`category-rail.tsx`)

**Purpose**: Horizontally scrollable strip of category filter pills.

**Props interface**:
```ts
interface CategoryRailProps {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    icon?: string;
  }>;
  activeCategory?: string;
  onSelect?: (slug: string) => void;
  className?: string;
}
```

**Layout specification**:
- Outer container: `overflow-x-auto` with hidden scrollbar (`scrollbar-hide` utility or CSS)
- Inner flex row: `flex gap-2 pb-2` (pb for scrollbar clearance)
- Each category: a `Button` variant ghost or outline, pill-shaped (`rounded-full`), with optional emoji/icon prefix from `icon` field
- Active state: solid primary background, white text. Inactive: border + muted text
- "All" pill always prepended (slug `''` or `'all'`)
- No wrapping — single horizontal scroll line

#### `TypeBadge` (`type-badge.tsx`)

**Purpose**: A small colored badge indicating questionnaire type. Used inside cards, banners, and builder tabs.

**Props interface**:
```ts
interface TypeBadgeProps {
  type: 'quiz' | 'survey' | 'exam';
  size?: 'sm' | 'md';
  className?: string;
}
```

**Styling specification**:
- Uses shadcn `Badge` internally
- quiz: Blue palette — `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`
- survey: Green palette — `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
- exam: Orange palette — `bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`
- `size='sm'`: `text-xs px-1.5 py-0.5`; `size='md'` (default): `text-sm px-2 py-0.5`
- Label text: capitalize the `type` value (Quiz, Survey, Exam)

---

### Group 3 — Builder Components

These components form the quiz/survey/exam creation interface. They render the editing experience without managing any persistence.

#### `BuilderToolbar` (`builder-toolbar.tsx`)

**Purpose**: A sticky bottom toolbar providing one-click question type insertion buttons.

**Props interface**:
```ts
interface BuilderToolbarProps {
  onAddQuestion: (type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'select') => void;
  disabled?: boolean;
  className?: string;
}
```

**Layout specification**:
- Position: sticky bottom, full-width, height 56px, white background with top border
- Five icon+label buttons in a horizontal row, evenly spaced:
  - Radio (`CircleDot` icon) — "Single Choice"
  - Checkbox (`CheckSquare` icon) — "Multiple Choice"
  - Text (`Type` icon) — "Short Text"
  - Textarea (`AlignLeft` icon) — "Long Text"
  - Select (`ChevronDown` icon) — "Dropdown"
- All buttons disabled (greyed, no pointer) when `disabled={true}`
- Each button calls `onAddQuestion(type)` with the corresponding type string

#### `QuestionCard` (`question-card.tsx`)

**Purpose**: Represents a single question within the builder canvas. Supports inline display of question content and answer options.

**Props interface**:
```ts
interface QuestionCardProps {
  id: string;
  order: number;
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  isActive?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  className?: string;
}
```

*(Where `QuestionType` and `QuestionOption` are imported from `@questify/shared`)*

**Layout specification**:
- White card with border. Active state (`isActive=true`): 2px solid primary color border + subtle box shadow
- Left edge: `order` number in a small circle badge
- Top area: `TypeBadge` for `type`, aligned right
- Content area: renders `content` text in medium weight. Placeholder text ("Click to edit question…") shown if `content` is empty
- Options area: for `radio`, `checkbox`, and `select` types — renders each option from `options[]` as a labeled row with a disabled input control (for visual reference only). Text/textarea types show a disabled input/textarea placeholder instead
- Action row (bottom-right): icon buttons for Edit (pencil), Duplicate (copy), Delete (trash). Each calls the respective handler with `id`. Delete button is red on hover.
- Drag handle (left edge, optional visual): a `GripVertical` icon to indicate drag-and-drop is available (actual DnD wired in the builder page layer, not here)

#### `SettingsRail` (`settings-rail.tsx`)

**Purpose**: Right-side settings panel for configuring questionnaire-level properties during building.

**Props interface**:
```ts
interface SettingsRailProps {
  type: QuestionnaireType;
  category?: string;
  visibility: 'public' | 'private' | 'unlisted';
  difficulty: 'easy' | 'medium' | 'hard';
  isScoreBased: boolean;
  timeLimit?: number;
  showResultsImmediately?: boolean;
  categories: Category[];
  onChange: (field: string, value: unknown) => void;
  className?: string;
}
```

**Layout specification**:
- Width: 280px (fixed), right side panel, scrollable vertically
- Section: **Visibility** — shadcn `Select` with options Public, Private, Unlisted
- Section: **Category** — shadcn `Select` populated from `categories` prop
- Section: **Difficulty** — shadcn `Select` with Easy, Medium, Hard options
- Section: **Score-based** — shadcn `Switch` toggle. Disabled (with tooltip "Not available for surveys") when `type === 'survey'`
- Section: **Exam Settings** — only rendered when `type === 'exam'`:
  - Time Limit: `Input` (number, min 60, step 60) with a "seconds" label. Rendered as MM format hint
  - Show Results Immediately: `Switch` toggle
- Each field calls `onChange(fieldName, newValue)` on change. The parent is responsible for state management.

#### `BuilderTypeTab` (`builder-type-tab.tsx`)

**Purpose**: A three-tab selector for switching the questionnaire type within the builder header.

**Props interface**:
```ts
interface BuilderTypeTabProps {
  activeType: 'quiz' | 'survey' | 'exam';
  onTypeChange: (type: QuestionnaireType) => void;
  hasQuestions?: boolean;
  onConfirmTypeChange?: (type: QuestionnaireType) => void;
  className?: string;
}
```

**Layout specification**:
- Three tabs using shadcn `Tabs` component: Quiz | Survey | Exam
- Each tab has the corresponding `TypeBadge` color dot as a prefix indicator
- When `hasQuestions` is `true` and user clicks a different type: the component does NOT call `onTypeChange` directly. Instead, it calls `onConfirmTypeChange(newType)` — the parent is responsible for showing a confirmation dialog. This keeps the component pure.
- When `hasQuestions` is `false` (or undefined): clicking a tab calls `onTypeChange(newType)` immediately

---

### Group 4 — Taking Flow Components

These components power the questionnaire-taking experience across all three types.

#### `QuizProgressBar` (`quiz-progress-bar.tsx`)

**Props interface**:
```ts
interface QuizProgressBarProps {
  current: number;
  total: number;
  className?: string;
}
```

Renders "Question {current} of {total}" label above a shadcn `Progress` bar. Progress value is `(current / total) * 100`. The bar fills left-to-right with primary brand color.

#### `QuestionDisplay` (`question-display.tsx`)

**Purpose**: The core rendering engine for a single question during a take session. Renders the correct input control based on type.

**Props interface**:
```ts
interface QuestionDisplayProps {
  question: {
    id: string;
    type: QuestionType;
    content: string;
    options?: QuestionOption[];
    required?: boolean;
  };
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  disabled?: boolean;
  className?: string;
}
```

**Rendering rules by type**:
- `radio`: shadcn `RadioGroup` with one `RadioGroupItem` per option. Selected value is a single string option ID.
- `checkbox`: A vertical list of shadcn `Checkbox` items. Value is `string[]` of selected option IDs.
- `text`: shadcn `Input` (type="text"). Value is a single string.
- `textarea`: shadcn `Textarea`. Value is a single string.
- `select`: shadcn `Select` with `SelectItem` per option. Value is a single string option ID.
- `disabled={true}` disables all inputs (used in review mode).
- `required` shown with a red asterisk (*) next to the question content label.

#### `AnswerOption` (`answer-option.tsx`)

**Purpose**: A single selectable answer option in taking or review mode.

**Props interface**:
```ts
interface AnswerOptionProps {
  id: string;
  label: string;
  isSelected?: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  onSelect?: () => void;
  showResult?: boolean;
  className?: string;
}
```

When `showResult` is false (default): renders a styled selectable row — highlighted with primary color border/background when `isSelected`. When `showResult` is true: green background + checkmark icon if `isCorrect`; red background + X icon if `isIncorrect` and `isSelected`; neutral if unselected and not correct.

#### `QuizNavigation` (`quiz-navigation.tsx`)

**Props interface**:
```ts
interface QuizNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  isSubmitting?: boolean;
  className?: string;
}
```

- Back button: hidden when `isFirst={true}`, otherwise visible on left
- Next button: hidden when `isLast={true}`
- Submit button: shown when `isLast={true}` with a loading spinner when `isSubmitting={true}`
- Layout: flex row, space-between

#### `ExamJumpNav` (`exam-jump-nav.tsx`)

**Purpose**: A numbered question grid allowing non-linear navigation during an exam.

**Props interface**:
```ts
interface ExamJumpNavProps {
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: number[];
  flaggedQuestions: number[];
  onJump: (questionIndex: number) => void;
  className?: string;
}
```

Renders a grid of numbered buttons (1 through `totalQuestions`). Visual states:
- Default (unanswered): outlined, muted
- Answered (index in `answeredQuestions`): filled primary background
- Flagged (index in `flaggedQuestions`): flag emoji or icon overlay
- Current (`index === currentQuestion`): bold border, ring

#### `ExamTimer` (`exam-timer.tsx`)

**Purpose**: Countdown clock for timed exams. Manages its own interval via `useState` + `useEffect`.

**Props interface**:
```ts
interface ExamTimerProps {
  totalSeconds: number;
  onExpire?: () => void;
  className?: string;
}
```

- Displays `MM:SS` format
- At < 10% of `totalSeconds` remaining: text turns red, bold, with pulse animation
- At 0: calls `onExpire()` once and stops the interval
- The component owns its own countdown state internally — this is the one exception to "no local state" because timer state is purely presentational with no business impact

#### `SectionHeader` (`section-header.tsx`)

**Props interface**:
```ts
interface SectionHeaderProps {
  title: string;
  description?: string;
  questionCount?: number;
  order?: number;
  className?: string;
}
```

Exam section divider. Renders a visually distinct horizontal band with `order` (e.g., "Section 1"), `title` in large text, optional `description` in smaller muted text, and optional `questionCount` ("N questions") aligned right.

#### `SurveyForm` (`survey-form.tsx`)

**Purpose**: Wraps all questions for single-page survey layout (surveys show all questions at once, unlike quizzes).

**Props interface**:
```ts
interface SurveyFormProps {
  questions: Question[];
  values: Record<string, string | string[]>;
  onChange: (questionId: string, value: string | string[]) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  className?: string;
}
```

Renders a vertical stack of `QuestionDisplay` components, one per question. Each `QuestionDisplay` receives the corresponding value from `values[question.id]` and calls `onChange(question.id, newValue)` on change. Submit button at the bottom; shows loading state when `isSubmitting={true}`.

---

### Group 5 — Results Components

Displayed after a questionnaire is completed. No editing controls — purely informational.

#### `ScoreCircle` (`score-circle.tsx`)

**Props interface**:
```ts
interface ScoreCircleProps {
  score: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

SVG-based circular progress indicator. Renders an arc from 0 to `(score/total) * 360` degrees. Center text shows `{score}/{total}`. Color: green (`#22c55e`) if percentage >= 70%, yellow (`#eab308`) if >= 50%, red (`#ef4444`) if < 50%. Size variants: sm=80px, md=120px (default), lg=160px.

#### `AnswerReviewItem` (`answer-review-item.tsx`)

**Props interface**:
```ts
interface AnswerReviewItemProps {
  question: string;
  userAnswer: string | string[];
  correctAnswer?: string | string[];
  isCorrect?: boolean;
  type: QuestionType;
  className?: string;
}
```

Single question review row. Shows: question text (muted, smaller), user's answer(s), correct answer(s) only if `isCorrect === false` and `correctAnswer` is provided, and a checkmark (green) or X (red) icon based on `isCorrect`. Arrays are displayed as comma-separated lists.

#### `SectionScoreBar` (`section-score-bar.tsx`)

**Props interface**:
```ts
interface SectionScoreBarProps {
  sectionTitle: string;
  score: number;
  total: number;
  className?: string;
}
```

Exam section score row. Label on left (`{sectionTitle}`), percentage text on right, shadcn `Progress` bar below spanning full width. Color follows the same green/yellow/red thresholds as `ScoreCircle`.

#### `ResultActions` (`result-actions.tsx`)

**Purpose**: Renders the correct set of post-result action buttons based on questionnaire variant.

**Props interface**:
```ts
interface ResultActionsProps {
  onTryAgain?: () => void;
  onReviewAnswers?: () => void;
  onBackToHome?: () => void;
  onShare?: () => void;
  variant: 'quiz' | 'survey' | 'exam-immediate' | 'exam-deferred';
  className?: string;
}
```

Button sets by variant:
- `quiz`: "Review Answers" (outline) + "Try Again" (primary)
- `survey`: "Back to Home" (outline) + "Share Survey" (primary)
- `exam-immediate`: "Review Answers" (primary)
- `exam-deferred`: "Back to Home" (primary)

#### `ThankYouCard` (`thank-you-card.tsx`)

**Props interface**:
```ts
interface ThankYouCardProps {
  message?: string;
  releaseDate?: string;
  instructorMessage?: string;
  variant: 'survey' | 'exam-deferred';
  className?: string;
}
```

- `survey` variant: large checkmark icon (green), "Thank you for completing!" heading, custom `message` below if provided
- `exam-deferred` variant: submission icon, "Exam Submitted" heading, `instructorMessage` below if provided, "Results available: {releaseDate}" line if `releaseDate` is provided

---

## Directory Structure

```
packages/ui/src/components/quiz/
├── app-shell.tsx
├── side-nav.tsx
├── page-layout.tsx
├── questionnaire-card.tsx
├── featured-banner.tsx
├── category-rail.tsx
├── type-badge.tsx
├── builder-toolbar.tsx
├── question-card.tsx
├── settings-rail.tsx
├── builder-type-tab.tsx
├── quiz-progress-bar.tsx
├── question-display.tsx
├── answer-option.tsx
├── quiz-navigation.tsx
├── exam-jump-nav.tsx
├── exam-timer.tsx
├── section-header.tsx
├── survey-form.tsx
├── score-circle.tsx
├── answer-review-item.tsx
├── section-score-bar.tsx
├── result-actions.tsx
└── thank-you-card.tsx
```

All of the above are re-exported from `packages/ui/src/index.ts`:

```ts
// packages/ui/src/index.ts (quiz components section)
export { AppShell } from './components/quiz/app-shell';
export type { AppShellProps } from './components/quiz/app-shell';
export { SideNav } from './components/quiz/side-nav';
export type { SideNavProps } from './components/quiz/side-nav';
// ... (one export + type export per component)
```

---

## Implementation Steps

### Step 1 — Group 1: Navigation & Layout (Ticket UI-501)
Implement `AppShell`, `SideNav`, and `PageLayout`. These are the structural foundation — all other components render inside them. Wire up shadcn `Sheet` for mobile sidebar in `PageLayout`. Verify responsive breakpoint behavior.

### Step 2 — Group 2: TypeBadge (Ticket UI-502)
Implement `TypeBadge` first as it is a dependency of several Group 2 and Group 3 components. Confirm color palette against design tokens. Export and validate in isolation.

### Step 3 — Group 2: Discovery Components (Ticket UI-503)
Implement `QuestionnaireCard`, `FeaturedBanner`, and `CategoryRail` using the already-available `TypeBadge`. Build against representative mock data. Confirm card hover states and CategoryRail scroll behavior on mobile viewport.

### Step 4 — Group 3: BuilderToolbar and BuilderTypeTab (Ticket UI-504)
Implement `BuilderToolbar` with sticky positioning and `BuilderTypeTab` with the type-change confirmation callback pattern. These are used in the builder page header/footer and have no internal state beyond the tab highlight.

### Step 5 — Group 3: QuestionCard and SettingsRail (Ticket UI-505)
Implement `QuestionCard` with options rendering and action buttons. Implement `SettingsRail` with all conditional field logic (score toggle disabled for survey, exam-only fields). Test `SettingsRail` with all three `type` values to confirm correct conditional rendering.

### Step 6 — Group 4: Core Taking Components (Ticket UI-506)
Implement `QuizProgressBar`, `QuestionDisplay`, `AnswerOption`, `QuizNavigation`, and `SurveyForm`. Focus on `QuestionDisplay`'s type-switching logic — this is the most branchy component and should be tested with all five question types. Ensure disabled state works correctly for review mode.

### Step 7 — Group 4: Exam-Specific Components (Ticket UI-507)
Implement `ExamJumpNav`, `ExamTimer`, and `SectionHeader`. The `ExamTimer`'s interval cleanup in `useEffect` return function must be verified to prevent memory leaks. Test `ExamJumpNav` with large question counts (50+) for grid overflow behavior.

### Step 8 — Group 5: Results Components (Ticket UI-508)
Implement `ScoreCircle` (SVG arc math), `AnswerReviewItem`, `SectionScoreBar`, `ResultActions`, and `ThankYouCard`. Validate `ScoreCircle` SVG rendering at all three sizes and all three color thresholds (0/10, 5/10, 8/10).

---

## Tickets

| Ticket | Component Group | Primary | Secondary | Effort |
|--------|----------------|---------|-----------|--------|
| UI-501 | Navigation & Layout (`AppShell`, `SideNav`, `PageLayout`) | Milo | Nova | M |
| UI-502 | TypeBadge (shared dependency) | Milo | Nova | S |
| UI-503 | Discovery Components (`QuestionnaireCard`, `FeaturedBanner`, `CategoryRail`) | Milo | Nova | M |
| UI-504 | Builder Controls (`BuilderToolbar`, `BuilderTypeTab`) | Milo | Nova | S |
| UI-505 | Builder Canvas (`QuestionCard`, `SettingsRail`) | Milo | Nova | L |
| UI-506 | Taking Flow — Core (`QuizProgressBar`, `QuestionDisplay`, `AnswerOption`, `QuizNavigation`, `SurveyForm`) | Milo | Nova | L |
| UI-507 | Taking Flow — Exam (`ExamJumpNav`, `ExamTimer`, `SectionHeader`) | Milo | Nova | M |
| UI-508 | Results (`ScoreCircle`, `AnswerReviewItem`, `SectionScoreBar`, `ResultActions`, `ThankYouCard`) | Milo | Nova | M |

---

## Acceptance Criteria

- All 23 components exist at their specified paths under `packages/ui/src/components/quiz/`
- All components and their `Props` interfaces are exported from `packages/ui/src/index.ts` with named exports
- TypeScript strict mode produces zero errors within the `packages/ui` package (`tsc --noEmit` passes)
- All components render without errors when mounted with valid props in a Storybook story or design-system preview page
- No component file contains any import from an API client, Zustand store, TanStack Query hook, or any fetch/axios call
- `SettingsRail` correctly hides exam-only fields when `type !== 'exam'` and disables score toggle when `type === 'survey'`
- `QuestionDisplay` renders the correct input control for each of the five question types
- `ExamTimer` cleans up its interval on unmount (no memory leak)
- `ScoreCircle` renders the correct color for score percentages below 50%, between 50-69%, and 70%+
- `ResultActions` renders the correct button set for each of the four variant values

---

## Out of Scope

- Business logic of any kind (routing, API calls, form submission, authentication checks)
- Zustand store creation or integration
- TanStack Query hooks
- Drag-and-drop implementation within `QuestionCard` (handled in the builder page layer)
- Storybook configuration (tracked separately in PHASE-04)
- Accessibility auditing beyond basic semantic HTML (tracked as a separate QA phase)

---

## Estimated Effort

**XL** — 23 components across 5 functional groups. The taking-flow and builder groups are the most complex due to multi-type branching in `QuestionDisplay` and conditional field logic in `SettingsRail`.
