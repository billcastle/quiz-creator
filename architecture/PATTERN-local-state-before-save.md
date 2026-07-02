---
title: "PATTERN: Local State Before Save"
category: "Data Management"
status: "Established"
date: "2026-07-01"
authors: "Questify Dev Team"
tags: ["pattern"]
related_adrs: ["ADR-010-pathless-layout-route-groups.md"]
related_tickets: ["QZ-0006"]
---

# PATTERN: Local State Before Save

## Intent

Hold all in-progress builder state in local React state and write nothing to the database until the user explicitly saves or publishes.

## Motivation

Builder pages (quiz builder, survey builder) allow creators to add, edit, and reorder multiple related records in a single session. Writing each change to the database immediately — on every keystroke, option add, or drag-drop — would:

1. Create orphaned records if the user abandons the session (pollutes the content list with junk drafts).
2. Generate a flood of API calls for normal interactive actions (typing in a title field, reordering questions).
3. Make rollback on discard impossible: the database already reflects every intermediate state.

Holding all state locally until an explicit save keeps the server state clean and gives the creator a clear mental model: the database reflects only intentional, committed saves.

## Structure

```
/quiz/new (no :id in URL)
  └─ all state in React useState
  └─ isDirty: title !== '' || any question has a prompt
  └─ useBlocker intercepts navigation when isDirty && !id
       └─ AlertDialog → Discard (blocker.proceed) | Stay (blocker.reset)
  └─ Save Draft / Publish → saveNew(status)
       └─ POST /api/questionnaires
       └─ POST each question
       └─ POST each question's options
       └─ navigate to /quiz/:id/edit

/quiz/:id/edit (:id present)
  └─ load from DB on mount
  └─ edits can be persisted incrementally (API calls per-field or on Save)
```

## Implementation

### Step 1 — Temp IDs for unperisted items

Items that haven't been saved yet need a stable React key. Use `nanoid()` to generate a temp ID; real DB IDs are empty strings until after the first save.

```tsx
type LocalQuestion = Question & {
  tempId: string
  options: (QuestionOption & { tempId: string })[]
}

function makeLocalQuestion(position: number): LocalQuestion {
  return {
    id: '',           // empty until saved
    parentId: '',
    position,
    type: 'single_choice',
    prompt: '',
    tempId: nanoid(), // stable React key
    options: [
      { id: '', questionId: '', label: '', isCorrect: false, tempId: nanoid() },
      { id: '', questionId: '', label: '', isCorrect: false, tempId: nanoid() },
    ],
  }
}
```

### Step 2 — isDirty detection

Check only meaningful fields. Empty questions added by default (on first load) should not themselves trigger the dirty state.

```tsx
const isDirty = title !== '' || localQuestions.some((q) => q.prompt !== '')
```

### Step 3 — Navigation blocker

```tsx
const blocker = useBlocker({
  shouldBlockFn: () => !id && isDirty,
  withResolver: true,
})

// In JSX:
{blocker.status === 'blocked' && (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Unsaved questionnaire</AlertDialogTitle>
        <AlertDialogDescription>
          Your changes will be lost if you leave without saving.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => saveNew('draft')}>Save as draft</AlertDialogCancel>
        <AlertDialogAction onClick={() => blocker.proceed?.()}>Discard</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

### Step 4 — Batch save

Sequential save (questionnaire first, then questions, then options) because each step depends on the ID from the previous step.

```tsx
async function saveNew(targetStatus: 'draft' | 'published') {
  const { questionnaire: q } = await api.post('/api/questionnaires', {
    title,
    visibility: localVisibility,
    category: localCategory,
    status: targetStatus,
  })

  for (const lq of localQuestions) {
    const { question: createdQ } = await api.post(
      `/api/questionnaires/${q.id}/questions`,
      { type: lq.type, prompt: lq.prompt, position: lq.position, /* ... */ }
    )
    for (const opt of lq.options) {
      await api.post(`/api/questions/${createdQ.id}/options`, {
        label: opt.label,
        isCorrect: opt.isCorrect,
      })
    }
  }

  navigate({ to: '/quiz/$id/edit', params: { id: q.id } })
}
```

## When to Use

- Any builder page where a user creates multiple related records in a single session before committing.
- When the cost of orphaned records (draft pollution) is higher than the cost of losing in-progress work on browser crash.

## When NOT to Use

- Edit pages (`/quiz/:id/edit`) where a real record already exists — incremental API saves per field are appropriate there.
- Forms with a single root entity and no children — a simple form with a Save button does not need this pattern.

## Known Uses in This Codebase

- [`apps/web/src/pages/QuizBuilderPage.tsx`](../apps/web/src/pages/QuizBuilderPage.tsx) — quiz builder; canonical implementation

## Consequences

### Benefits

- No orphaned records from abandoned sessions.
- All interactive edits (typing, reordering, option changes) are instant with no API round-trips.
- Clean discard: nothing was written; navigation away leaves the database unchanged.
- Navigation blocker provides a safety net against accidental data loss.

### Liabilities

- A browser crash or hard refresh before save loses all in-progress work — no auto-save or crash recovery.
- The batch save is not transactional at the HTTP layer. If a question POST fails mid-batch, the questionnaire row exists without all its questions. A server-side batch endpoint would be safer.
- `isDirty` detection is intentionally coarse: it only checks title and question prompts, not option content. A creator who fills in options but leaves prompts blank will not be blocked on navigation.

## Related Documents

- [ADR-010-pathless-layout-route-groups.md](ADR-010-pathless-layout-route-groups.md) — `BuilderLayout` that isolates builder pages from the app shell
- [STANDARD-ui-package-router-isolation.md](STANDARD-ui-package-router-isolation.md) — why `useBlocker` is wired in the page, not in a `packages/ui` component
