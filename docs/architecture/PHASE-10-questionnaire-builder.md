---
phase: 10
title: "Questionnaire Builder Feature"
status: pending
depends_on: ["PHASE-09", "PHASE-05"]
estimated_tickets: 8
---

# Phase 10 — Questionnaire Builder Feature

## Overview

This is the core product feature of Questify — the questionnaire creation experience. The builder allows authenticated users to create **Quiz**, **Survey**, or **Exam** questionnaires with full question management, inline editing, type-specific settings, and publishing with a shareable link.

The builder supports two creation modes:
- **Anonymous creation**: autosaves to `localStorage` with a prompt to sign in to save permanently
- **Authenticated creation**: autosaves to `localStorage` every 2 seconds (debounced) as a backup, plus syncs to the backend API every 30 seconds

This phase depends on PHASE-09 (authentication) for protected routes and PHASE-05 (custom UI components) for all builder-specific components (BuilderToolbar, QuestionCard, SettingsRail, BuilderTypeTab). Shared types and Zod schemas come from packages/shared (PHASE-06).

---

## Goals

- [ ] Zustand builder store created with full questionnaire, question, option, and section state management
- [ ] `/create` route renders empty builder (supports anonymous creation)
- [ ] `/builder/$id` route loads existing questionnaire into builder store
- [ ] All five question type editors working: radio, checkbox, text, textarea, select
- [ ] Settings rail wired to builder store (category, visibility, difficulty, score-based, exam settings)
- [ ] Exam sections panel: add/rename/delete sections, assign questions to sections
- [ ] Autosave to localStorage (anonymous and authenticated) implemented
- [ ] 30-second interval autosave to backend API (authenticated only) implemented
- [ ] Publish flow: validation, confirmation dialog, API call, shareable link display
- [ ] Backend API endpoints: `POST /api/questionnaires`, `PUT /api/questionnaires/:id`, `POST /api/questionnaires/:id/publish`, `GET /api/categories`
- [ ] Mobile responsive builder layout (panels collapse to drawers on small screens)

---

## Monorepo Touch Points

| Package / App | Change |
|---|---|
| `apps/web` | New routes `create.tsx`, `builder.$id.tsx`; new store `builder.store.ts`; new `builder-layout.tsx`; new `question-editors/` components; new hooks `use-autosave.ts`, `use-builder-mutations.ts` |
| `apps/api` | Implement `routes/questionnaires.ts`, `routes/questions.ts`, `routes/categories.ts`; new `services/questionnaire.service.ts`, `services/question.service.ts` |
| `packages/shared` | Consumed (no changes): `CreateQuestionnaireSchema`, `CreateQuestionSchema`, `QuestionnaireType`, `QuestionType` |
| `packages/ui` | Consumed (no changes): `BuilderToolbar`, `QuestionCard`, `SettingsRail`, `BuilderTypeTab` from PHASE-05 |

---

## Technical Architecture

### Builder State Management

**File**: `apps/web/src/store/builder.store.ts`

The builder store is the central source of truth for the entire questionnaire creation experience. It uses Zustand with the `immer` middleware for ergonomic nested state mutations.

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import type {
  QuestionnaireType,
  QuestionnaireVisibility,
  QuestionnaireDifficulty,
  QuestionnaireSettings,
  QuestionType,
  QuestionSettings,
} from '@questify/shared'

interface BuilderOption {
  id: string               // client-generated temp ID until saved
  content: string
  order: number
  isCorrect: boolean
}

interface BuilderQuestion {
  id: string               // client-generated temp ID until saved
  questionnaireId?: string
  sectionId?: string | null
  order: number
  type: QuestionType
  content: string
  required: boolean
  settings?: QuestionSettings
  options: BuilderOption[]
}

interface BuilderSection {
  id: string
  title: string
  description?: string
  order: number
}

interface BuilderQuestionnaire {
  id?: string              // undefined for unsaved draft
  title: string
  type: QuestionnaireType
  category?: string
  visibility: QuestionnaireVisibility
  difficulty?: QuestionnaireDifficulty
  isScoreBased: boolean
  settings: QuestionnaireSettings
  sections: BuilderSection[]
  questions: BuilderQuestion[]
}

interface BuilderUI {
  activeQuestionId: string | null
  activeSectionId: string | null
  isDirty: boolean
  isSaving: boolean
  isPublishing: boolean
  saveError: string | null
  publishError: string | null
  shareUrl: string | null
}

interface BuilderStore {
  questionnaire: BuilderQuestionnaire
  ui: BuilderUI
  actions: BuilderActions
}
```

#### Full Actions Interface

```typescript
interface BuilderActions {
  // Questionnaire-level metadata
  setTitle: (title: string) => void
  setType: (type: QuestionnaireType) => void
  setCategory: (category: string) => void
  setVisibility: (visibility: QuestionnaireVisibility) => void
  setDifficulty: (difficulty: QuestionnaireDifficulty) => void
  setScoreBased: (isScoreBased: boolean) => void
  updateSettings: (settings: Partial<QuestionnaireSettings>) => void

  // Question management
  addQuestion: (type: QuestionType, afterId?: string) => void
  updateQuestion: (id: string, updates: Partial<BuilderQuestion>) => void
  deleteQuestion: (id: string) => void
  reorderQuestions: (fromIndex: number, toIndex: number) => void
  setActiveQuestion: (id: string | null) => void

  // Option management
  addOption: (questionId: string) => void
  updateOption: (questionId: string, optionId: string, updates: Partial<BuilderOption>) => void
  deleteOption: (questionId: string, optionId: string) => void
  reorderOptions: (questionId: string, fromIndex: number, toIndex: number) => void
  setCorrectOption: (questionId: string, optionId: string, isCorrect: boolean) => void

  // Section management (exam type only)
  addSection: () => void
  updateSection: (id: string, updates: Partial<BuilderSection>) => void
  deleteSection: (id: string) => void
  assignQuestionToSection: (questionId: string, sectionId: string | null) => void

  // Persistence
  saveDraft: () => Promise<void>
  loadDraft: (id: string) => Promise<void>
  publish: () => Promise<void>

  // Internal
  setId: (id: string) => void
  setShareUrl: (url: string) => void
  markClean: () => void
  reset: () => void
}
```

**Implementation notes**:
- `addQuestion` generates a new `BuilderQuestion` with `id: nanoid()`, empty `options: []` (or 2 default options for radio/checkbox/select), and inserts after `afterId` if provided
- `reorderQuestions` and `reorderOptions` update the `order` fields after reordering
- `deleteSection` reassigns all questions in that section to `sectionId: null`
- `setCorrectOption` for radio questions (single-select): sets the target option's `isCorrect = true` and all others to `false`
- `setCorrectOption` for checkbox questions (multi-select): toggles only the target option

**Initial state**:
```typescript
const initialQuestionnaire: BuilderQuestionnaire = {
  title: '',
  type: 'quiz',
  visibility: 'public',
  isScoreBased: false,
  settings: {},
  sections: [],
  questions: [],
}
```

---

### Autosave Strategy

Autosave is managed by the custom hook `apps/web/src/hooks/use-autosave.ts`.

#### Anonymous Users (No Active Session)

1. Every time `isDirty` becomes `true`, start a 2-second debounce timer
2. On timer expiry: serialize the store's `questionnaire` object and write to `localStorage` under key `qz-draft-{tempId}` where `tempId` is a `nanoid()` generated at store initialization
3. On page load to `/create`: check `localStorage` for any `qz-draft-*` keys. If found, show a non-blocking banner: "You have an unsaved draft. [Continue editing] [Discard]"
4. On sign-in while draft exists in `localStorage`: automatically migrate the draft to the backend with `POST /api/questionnaires`, then clear the `localStorage` key and redirect to `/builder/:newId`

#### Authenticated Users

1. Same 2-second debounced `localStorage` write as a local backup
2. Additionally, a 30-second `setInterval` triggers `saveDraft()` which calls `PUT /api/questionnaires/:id` if `isDirty` is true
3. On interval save: set `ui.isSaving = true`, call API, set `ui.isSaving = false`, call `markClean()`
4. On component unmount (route change): trigger immediate `saveDraft()` if `isDirty` to prevent data loss
5. Show autosave indicator in the builder toolbar:
   - "Saving..." (spinner) when `ui.isSaving`
   - "Saved" (checkmark, fades after 2s) after successful save
   - "Save failed — Retry" (error icon + button) when `ui.saveError` is set

---

### Routes and Pages

#### `/create` Route

**File**: `apps/web/src/routes/create.tsx`

```typescript
export const Route = createFileRoute('/create')({
  beforeLoad: async ({ context }) => {
    const { data: session } = await getSession()
    // Allow anonymous users — they get localStorage autosave
    // Authenticated users get API autosave
    return { user: session?.user ?? null }
  },
  component: CreatePage,
})
```

- Initializes empty builder store state on mount
- If anonymous: shows a dismissible banner "Sign in to save your questionnaire to the cloud"
- If authenticated: shows nothing extra; autosave runs in background
- On first "save draft" action by authenticated user: `POST /api/questionnaires`, then redirect to `/builder/:id`

#### `/builder/$id` Route

**File**: `apps/web/src/routes/builder.$id.tsx`

```typescript
export const Route = createFileRoute('/builder/$id')({
  beforeLoad: async () => {
    const { data: session } = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    return { user: session.user }
  },
  loader: async ({ params }) => {
    // Fetch questionnaire from API and hydrate builder store
    return fetchQuestionnaire(params.id)
  },
  component: BuilderPage,
})
```

Error cases:
- Questionnaire not found (404): Show "This questionnaire doesn't exist or has been deleted."
- Not owner (403): Show "You don't have permission to edit this questionnaire."

---

### Builder Layout

**File**: `apps/web/src/components/builder-layout.tsx`

This component lives in `apps/web` (not `packages/ui`) because it directly imports the builder Zustand store. It cannot be a generic shared component.

```
┌─────────────────────────────────────────────────────────────┐
│                    AppShell (top navigation)                 │
│  [Logo]  [Title input]  [Saving...]  [Settings]  [Publish]  │
├────────────┬─────────────────────────────┬───────────────────┤
│            │   BuilderTypeTab             │                   │
│            │   [Quiz] [Survey] [Exam]     │                   │
│ Question   ├─────────────────────────────┤  Settings Rail    │
│ List       │                             │                   │
│            │   Active Question Editor    │  - Type metadata  │
│ [Q1]       │                             │  - Category       │
│ [Q2] ←sel  │   (content + options)       │  - Visibility     │
│ [Q3]       │                             │  - Difficulty     │
│            │                             │  - Score-based    │
│ [+ Add Q]  │                             │  - Settings       │
│            │                             │                   │
└────────────┴─────────────────────────────┴───────────────────┘
│              BuilderToolbar (add question type buttons)       │
└─────────────────────────────────────────────────────────────┘
```

On mobile (< 768px):
- Left question list collapses to a bottom sheet (triggered by "Questions" button)
- Settings rail collapses to a right-side sheet (triggered by "Settings" button)
- Builder toolbar becomes a horizontally-scrollable pill row

---

### Question Type Editors

Each editor is a standalone component in `apps/web/src/components/question-editors/`.

#### Radio Editor (`radio-editor.tsx`)
- Editable `<Textarea>` for question content (auto-resizes)
- List of options rendered as editable `<Input>` rows with a radio circle on the left (visual only, not interactive)
- If `questionnaire.isScoreBased`: show a green checkmark toggle per option (only one can be correct at a time)
- "Add option" button — disabled when option count = 10
- Per-option delete button (×) — disabled when option count ≤ 2
- Drag handle (⠿) for reordering options

#### Checkbox Editor (`checkbox-editor.tsx`)
- Same layout as radio editor
- Checkbox square instead of radio circle (visual only)
- If `isScoreBased`: multiple options can be toggled as correct simultaneously
- "Partial credit" note: if multiple correct options exist, each carries equal weight (future: weighted scoring)

#### Text Editor (`text-editor.tsx`)
- Editable `<Textarea>` for question content
- If `isScoreBased`:
  - "Accepted answers" field: comma-separated list of accepted strings
  - Toggle: "Case sensitive" (default: off)
  - Toggle: "Accept if answer contains keyword" (default: off)
  - Toggle: "Accept common plural forms" (default: off)
- If not `isScoreBased`: no additional fields; shows note "Responses will be collected but not scored"

#### Textarea Editor (`textarea-editor.tsx`)
- Editable `<Textarea>` for question content
- Preview of a disabled large textarea (to show respondents what they'll see)
- Informational banner: "Long-form text responses cannot be auto-scored"
- No options, no correct answers

#### Select Editor (`select-editor.tsx`)
- Editable `<Textarea>` for question content
- Dropdown preview (non-interactive `<select>` element) showing current options
- Editable option list below the preview (same as radio editor)
- If `isScoreBased`: single option can be marked correct

---

### Settings Rail

**File**: `apps/web/src/components/settings-rail.tsx` (in `apps/web`, not `packages/ui`)

The settings rail is always visible on the right side (desktop) and provides access to questionnaire metadata:

| Setting | Control | Condition |
|---------|---------|-----------|
| Category | `<Select>` populated from `useCategories()` | Always shown |
| Visibility | `<RadioGroup>`: Public / Unlisted / Private | Always shown |
| Difficulty | `<Select>`: Easy / Medium / Hard | Always shown |
| Score-based | `<Switch>` | Quiz and Exam types only |
| Time limit | `<Input type="number">` (minutes) | Optional; shown for Exam |
| Show results | `<Switch>` | Always shown |
| Randomize questions | `<Switch>` | Always shown |
| Randomize options | `<Switch>` | Quiz/Exam with radio/select questions |

All changes in the settings rail dispatch to the builder store immediately (no "save" button in rail).

---

### Exam Sections Panel

**File**: `apps/web/src/components/sections-panel.tsx`

Shown only when `questionnaire.type === 'exam'`. Renders as a collapsible left panel or as a floating drawer on mobile.

Section behavior:
- Each section has an editable title (inline edit on click)
- Sections display a badge with question count
- Questions in the question list show a section tag/label
- Drag-and-drop: questions can be dragged between sections
- "Unassigned" is a virtual section (not stored) for questions with `sectionId: null`
- Minimum 1 section required when type is exam; creating the first section is automatic

Drag-and-drop library: `@hello-pangea/dnd` (maintained fork of `react-beautiful-dnd`)

```typescript
// DragDropContext wraps the entire builder layout when type=exam
// Two Droppable areas: sections list and question-within-section lists
// onDragEnd dispatches reorderQuestions or assignQuestionToSection
```

---

### Publish Flow

1. User clicks "Publish" button in the builder toolbar (`ui.isPublishing` → `true`)
2. Validate locally:
   - `questionnaire.title` is non-empty (error: "Please add a title before publishing")
   - `questionnaire.questions.length >= 1` (error: "Add at least one question before publishing")
3. Show `<AlertDialog>` confirmation:
   - Title: "Publish questionnaire?"
   - Body: "This will make your questionnaire visible to [visibility] viewers. You can unpublish at any time."
   - Actions: "Cancel" | "Publish"
4. On confirm: call `POST /api/questionnaires/:id/publish`
5. Backend returns `{ shareToken, shareUrl }` (or frontend constructs: `${window.location.origin}/q/${shareToken}`)
6. Show success `<Dialog>`:
   - "Your questionnaire is live!"
   - Share URL display with copy-to-clipboard button
   - "View questionnaire" link
   - "Share on…" social buttons (out of scope, placeholder)
7. Store `shareUrl` in `ui.shareUrl`; the toolbar now shows a "View" link

---

### TanStack Query Integration

**File**: `apps/web/src/hooks/use-builder-mutations.ts`

```typescript
// Create questionnaire (called on first save for authenticated users)
export const useCreateQuestionnaire = () =>
  useMutation({
    mutationFn: (data: CreateQuestionnaireInput) =>
      apiClient.post('/api/questionnaires', data),
    onSuccess: ({ data }) => {
      builderStore.getState().actions.setId(data.id)
      router.navigate({ to: '/builder/$id', params: { id: data.id } })
    },
  })

// Autosave (called by 30s interval and on unmount)
export const useUpdateQuestionnaire = (id: string) =>
  useMutation({
    mutationFn: (data: UpdateQuestionnaireInput) =>
      apiClient.put(`/api/questionnaires/${id}`, data),
    onSuccess: () => builderStore.getState().actions.markClean(),
    onError: (err) => builderStore.getState().actions.setError(err.message),
  })

// Publish
export const usePublishQuestionnaire = (id: string) =>
  useMutation({
    mutationFn: () => apiClient.post(`/api/questionnaires/${id}/publish`),
    onSuccess: ({ data }) =>
      builderStore.getState().actions.setShareUrl(data.shareUrl),
  })

// Categories for settings rail
export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/api/categories'),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
```

---

### Backend API Implementation

#### `POST /api/questionnaires`

**File**: `apps/api/src/routes/questionnaires.ts`

```
1. Validate request body with CreateQuestionnaireSchema
2. Extract user from context (requireAuth applied)
3. Generate: id = nanoid(12), slug = slugify(title) + '-' + nanoid(6), shareToken = uuidv4()
4. Insert into questionnaires table with status = 'draft'
5. Return { data: { id, slug, shareToken } }
```

#### `PUT /api/questionnaires/:id`

```
1. Validate ownership: SELECT questionnaire WHERE id = :id, check creatorId === user.id
2. Validate request body with UpdateQuestionnaireSchema
3. Begin Drizzle transaction:
   a. UPDATE questionnaires SET ...metadata WHERE id = :id
   b. Upsert each question (INSERT ... ON CONFLICT DO UPDATE)
   c. Upsert each option within each question
   d. Delete questions that exist in DB but NOT in request payload (by comparing IDs)
   e. Delete options that exist in DB but NOT in request payload
4. Return { data: updatedQuestionnaire }
```

Transaction note: the upsert-then-delete pattern is necessary because the frontend uses client-generated nanoid IDs before the first server save. After the first save, IDs are stable.

#### `POST /api/questionnaires/:id/publish`

```
1. Validate ownership
2. Fetch questionnaire with questions
3. Validate: title non-empty AND questions.length >= 1
4. UPDATE questionnaires SET status = 'published', publishedAt = NOW() WHERE id = :id
5. Return { data: { shareToken, shareUrl: `${env.FRONTEND_URL}/q/${shareToken}` } }
```

#### `GET /api/categories`

```
1. Check Cloudflare KV for key 'categories:all'
2. If cache hit: return cached data
3. If cache miss: SELECT * FROM categories ORDER BY name
4. Write to KV with TTL 300 seconds (5 minutes)
5. Return { data: categories }
```

First use of Cloudflare KV caching in the project. The `kv` binding must be declared in `wrangler.toml`.

**Service layer** (`apps/api/src/services/questionnaire.service.ts`):
- Separate business logic from route handlers
- `QuestionnaireService.create(userId, input)`
- `QuestionnaireService.update(id, userId, input)`
- `QuestionnaireService.publish(id, userId)`
- `QuestionnaireService.findById(id, userId)`

---

### Error States and User Feedback

| State | UI Treatment |
|-------|-------------|
| Save failed (network) | Yellow banner: "Failed to save. Retrying in 30s." with manual Retry button |
| Save failed (auth expired) | Red banner: "Session expired. Sign in again to save." with Sign in button |
| Publish validation fail | Inline error messages above Publish button |
| Offline detected | Orange banner: "You appear to be offline. Changes are saved locally." (uses `navigator.onLine` + `offline` event) |
| Load failed | Full-page error state: "Could not load this questionnaire." with Back to dashboard link |
| Questionnaire not found | 404 state with illustration and link back |
| Not owner | 403 state: "You don't have permission to edit this questionnaire." |

---

### Mobile Responsiveness

The builder is a desktop-primary experience but must be functional on tablet/mobile:

- **>= 1024px (desktop)**: 3-column layout (question list | editor | settings rail)
- **768px–1023px (tablet)**: 2-column layout (question list collapsed to icon sidebar | editor + settings rail stacked)
- **< 768px (mobile)**:
  - Full-width editor
  - Question list accessible via floating action button or bottom sheet
  - Settings rail accessible via "Settings" button (Sheet component from shadcn)
  - Builder toolbar becomes a horizontally-scrollable row of icon buttons

Use Tailwind breakpoint classes throughout: `hidden lg:block`, `sm:flex-col`, etc.

---

### Directory Structure

```
apps/web/src/
  routes/
    create.tsx                        ← New questionnaire builder (anonymous + auth)
    builder.$id.tsx                   ← Edit existing questionnaire (auth required)
  components/
    builder-layout.tsx                ← Main 3-column layout (imports builder store)
    settings-rail.tsx                 ← Right panel: questionnaire metadata controls
    sections-panel.tsx                ← Exam sections sidebar
    question-editors/
      radio-editor.tsx
      checkbox-editor.tsx
      text-editor.tsx
      textarea-editor.tsx
      select-editor.tsx
  store/
    builder.store.ts                  ← Central Zustand store for all builder state
  hooks/
    use-autosave.ts                   ← localStorage + API interval autosave logic
    use-builder-mutations.ts          ← TanStack Query mutations for CRUD

apps/api/src/
  routes/
    questionnaires.ts                 ← POST, GET, PUT, DELETE /api/questionnaires
    questions.ts                      ← Sub-resource question management (optional split)
    categories.ts                     ← GET /api/categories with KV cache
  services/
    questionnaire.service.ts          ← Business logic: create, update, publish, findById
    question.service.ts               ← Question upsert, delete, reorder logic
```

---

## Implementation Steps

| Step | Description | Assignee |
|------|-------------|----------|
| 1 | Create Zustand builder store with all state, actions, and initial state. No API calls yet — test store logic in isolation with unit tests. | Nova (Frontend) |
| 2 | Build builder layout and routing: `/create` and `/builder/$id` with TanStack Router file-based routes, `beforeLoad` auth guard on `/builder/$id`, and builder layout shell (empty panels). | Nova (Frontend) |
| 3 | Implement question type editors: radio, checkbox, text, textarea, select. Wire each to builder store via `updateQuestion` and `updateOption` actions. | Nova (Frontend) |
| 4 | Implement settings rail: all metadata controls wired to builder store. Integrate `useCategories()` query for category select. | Nova (Frontend) |
| 5 | Implement exam sections panel: section CRUD, drag-and-drop question assignment using `@hello-pangea/dnd`. | Nova (Frontend) |
| 6 | Implement autosave logic: `use-autosave.ts` hook with `localStorage` debounce + API 30s interval. Autosave indicator in toolbar. Anonymous draft persistence and sign-in migration. | Nova (Frontend) |
| 7 | Implement publish flow: validation, confirmation dialog, API call, share URL display and clipboard copy. | Nova (Frontend) |
| 8 | Implement backend API: `POST/PUT/GET /api/questionnaires` with ownership validation and transaction-based upsert. `POST /api/questionnaires/:id/publish`. `GET /api/categories` with KV caching. Service layer extraction. | Sage (Backend) |

---

## Tickets

| # | Title | Assignee | Effort |
|---|-------|----------|--------|
| 10-01 | Zustand builder store: complete state shape and all actions | Nova | M |
| 10-02 | Builder routing: /create and /builder/$id routes, layout shell | Nova | M |
| 10-03 | Question type editors: radio, checkbox, text, textarea, select | Nova | L |
| 10-04 | Settings rail: all metadata controls + useCategories query | Nova | S |
| 10-05 | Exam sections panel: section CRUD + drag-and-drop question assignment | Nova | M |
| 10-06 | Autosave: localStorage debounce, API interval, anonymous draft migration | Nova | M |
| 10-07 | Publish flow: validation, dialog, API call, share URL + clipboard | Nova | S |
| 10-08 | Backend API: questionnaire CRUD with transaction upsert, publish endpoint, KV-cached categories | Sage | L |

---

## Acceptance Criteria

- Authenticated user can create a new questionnaire at `/create` and it persists to the API
- Anonymous user can start creating at `/create`; state is saved to `localStorage`; sign-in migrates the draft to the backend
- Builder store correctly manages questionnaire metadata, questions, options, and sections
- Adding a Radio question shows 2 default options; user can add up to 10 and delete down to 2
- Marking a Radio option as correct clears all other correct flags (single correct answer)
- Marking a Checkbox option as correct allows multiple simultaneous correct options
- Text question editor shows accepted-answers configuration when `isScoreBased` is true
- Settings rail changes (visibility, difficulty, category, etc.) update the store and autosave
- Exam type shows sections panel; questions can be dragged into different sections
- Autosave indicator cycles through "Saving…" and "Saved" during the 30-second interval
- Offline state shows a banner and continues saving to `localStorage`
- Publish flow validates title and minimum 1 question before showing confirmation dialog
- After publish, the share URL is displayed and the copy-to-clipboard button works
- Navigating away from `/builder/$id` with unsaved changes triggers an immediate save
- `POST /api/questionnaires` creates a draft record and returns `{ id, slug, shareToken }`
- `PUT /api/questionnaires/:id` performs transactional upsert of questions and options
- `POST /api/questionnaires/:id/publish` sets `status = 'published'` and returns `shareToken`
- `GET /api/categories` returns categories from KV cache (populated on first request)
- TypeScript strict mode: zero errors across all builder-related files

---

## Out of Scope (Future Phases)

- Taking / responding to a questionnaire (separate "take" flow — later phase)
- Viewing questionnaire results and individual responses (later phase)
- Analytics dashboard (response rates, score distributions) (later phase)
- Questionnaire duplication / templates (later enhancement)
- Question import from CSV or AI generation (later enhancement)
- Collaborator access (multi-user editing) (later enhancement)
- Version history / undo-redo beyond browser session (later enhancement)
- Rich text formatting in question content (later enhancement)
- Media attachments (images per question) (later enhancement)

---

## Phase Dependencies

- **PHASE-09 must be complete** because the builder routes require auth session (anonymous flow falls back to localStorage, but the sign-in redirect and session detection depend on the auth client being configured).
- **PHASE-05 must be complete** because the builder uses BuilderToolbar, QuestionCard, SettingsRail, BuilderTypeTab, and other components from packages/ui.
- **PHASE-08 must be complete** because the Hono API skeleton (routes/questionnaires.ts scaffold, middleware, response helpers) is the foundation for the business logic implemented in this phase.

---

## Agent Assignments

- **Architect:** Reviews builder store design (especially reorder logic and section assignment). Approves the anonymous → authenticated migration strategy. Reviews transactional upsert pattern on backend.
- **Dev/Nova (Frontend):** Implements builder store, routes, question editors, autosave hooks, publish flow, and TanStack Query mutations (steps 1–7).
- **Dev/Sage (Backend):** Implements POST/PUT questionnaires, questionnaire/question services, categories endpoint with KV cache (step 8).
- **Dev/Milo (Visual/CSS):** Reviews builder layout responsiveness. Ensures question editors and settings rail match wireframe specifications. Reviews publish success dialog.
- **QA/Ivy:** Tests full creation flow: create quiz, add all question types, set settings, publish, copy share link. Tests autosave (close tab, reopen). Tests exam sections drag-and-drop. Tests anonymous creation + sign-in migration.
- **DevOps/Axel:** Ensures KV namespace is configured for categories caching. Verifies Wrangler dev picks up D1 and KV bindings locally.
- **Remy (Producer):** Creates 8 tickets from implementation steps. Coordinates Nova/Sage work streams (frontend-first, backend caught up by step 8 end).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Builder store reorder logic bugs (question ordering, section assignment) | High | High | Thorough unit-level testing of store actions in isolation before UI integration |
| Race condition between localStorage autosave and API autosave | Med | Med | Use a single debounce tick; always write localStorage first, then fire API call |
| `@hello-pangea/dnd` incompatibility with React 19 | Med | Med | Test early in isolation; fallback to HTML5 native drag if needed |
| Transactional upsert on D1 loses questions on concurrent saves | Med | High | Use D1 batch transactions; compare by ID sets server-side before deleting |
| Anonymous draft migration loses data on sign-in if API errors | Low | High | Migrate localStorage draft only after API confirms save; keep localStorage until confirmed |
| Type change (Quiz → Exam) with existing questions causes data loss | Med | Med | Warn user in BuilderTypeTab before switching types; preserve questions, just hide section UI |

---

## Estimated Effort

**Overall Phase Effort**: XL (Extra Large)

This is the largest phase in the project. The builder store alone requires careful design to avoid bugs in question/option ordering and section assignment. Key complexity areas:

1. **Builder store correctness**: reorder logic, correct-option exclusivity for radio, section assignment edge cases
2. **Transaction upsert on backend**: comparing frontend state to DB state to correctly delete removed questions/options
3. **Autosave reliability**: handling race conditions between localStorage writes and API calls; immediate save on unmount
4. **Drag-and-drop UX**: cross-section question reordering with `@hello-pangea/dnd` requires careful Droppable nesting
5. **Anonymous → authenticated migration**: the localStorage draft must be cleanly migrated without data loss on sign-in
