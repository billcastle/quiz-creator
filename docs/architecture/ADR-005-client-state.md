---
title: "ADR-005: Client State Management — Zustand"
status: "Accepted"
date: "2026-06-26"
authors: "Architect"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---

# ADR-005: Client State Management — Zustand

## Context

TanStack Query (ADR-003) handles all server state — data that originates from the API and is cached client-side. Questify also requires client-side state that does not come from the server and must not be mixed with the query cache:

- **Quiz builder**: unsaved draft state, active question index, drag-and-drop order before save, unsaved field values
- **Quiz-taking session**: current question index, selected answers, elapsed time, pause state for timed exams
- **Cross-component UI state**: modal open/closed, sidebar expanded, active tab, toast queue

This state must be accessible from multiple components without prop-drilling, must survive component unmounts (e.g., navigating between builder tabs without losing field values), and in some cases must persist to `localStorage` (draft recovery, anonymous quiz-taker progress).

## Decision

Use Zustand for all client-side global state that does not originate from the server.

Zustand has minimal boilerplate — a single `create()` call defines a store with typed state and actions. It is TypeScript-first without additional type gymnastics. Zustand stores are React-context-free: no `Provider` wrapper is required, and any component can subscribe to a store regardless of its position in the tree. The `persist` middleware enables `localStorage` persistence for draft builder state and anonymous quiz session progress. The `devtools` middleware integrates with the Redux DevTools extension for time-travel debugging of session state.

## Consequences

### Positive

- **POS-001**: No `Provider` wrapper required — stores are accessed via hooks from any component without restructuring the component tree
- **POS-002**: The `persist` middleware enables automatic `localStorage` sync for the quiz builder's unsaved draft state and for anonymous quiz-takers' session progress, with no manual serialization code
- **POS-003**: The `devtools` middleware integrates with the Redux DevTools browser extension, enabling time-travel debugging and state snapshots for the quiz session store during development

### Negative

- **NEG-001**: Zustand stores can become a dumping ground for data that properly belongs in the TanStack Query cache; code review must enforce the boundary — server-originated data stays in the query cache and is never duplicated into a Zustand store
- **NEG-002**: Multiple Zustand stores with cross-dependencies can become difficult to trace; stores must be domain-scoped (one store per feature: `useBuilderStore`, `useQuizSessionStore`, `useExamStore`) and must not import each other
- **NEG-003**: Persisted Zustand state in `localStorage` can become structurally stale after API data model changes; migration logic via Zustand `persist`'s `migrate` option is required when adding or removing persisted fields

## Alternatives Considered

### Redux Toolkit

- **ALT-001**: **Description**: The industry standard for complex client state management in React. Provides slice/reducer/action/selector patterns, Immer-based immutable updates, and the Redux DevTools.
- **ALT-001**: **Rejection reason**: Questify's client state surface area is modest — quiz session progress, UI toggle states, and builder draft state. Redux Toolkit's slice/reducer/action pattern adds significant boilerplate for this use case. RTK Query was also considered for server state (ADR-003) and rejected; using Redux purely for client state introduces a large dependency for a small problem.

### Jotai

- **ALT-002**: **Description**: An atomic state library where each piece of state is a discrete atom. Atoms can derive from other atoms. No `Provider` required in the standard configuration.
- **ALT-002**: **Rejection reason**: Jotai's atom-per-value model becomes difficult to trace when atoms derive from other atoms across a complex domain — for example, a quiz session where `remainingTime` derives from `startTime`, `elapsedPausedMs`, and `isPaused`. Zustand's single-store-per-domain model groups related state and actions in one place, making it easier for agents and developers to reason about and extend a feature's state without hunting across atom files.

### React Context + useReducer

- **ALT-003**: **Description**: React's built-in state primitives. A Context provides a value; `useReducer` manages updates to that value via dispatched actions.
- **ALT-003**: **Rejection reason**: Context triggers a full subtree re-render on every state change. A timer-driven exam session store ticking every second would re-render every component that consumes the Context on every tick. Solving this with context splitting (one Context per slice of state) reproduces Zustand's store model with more ceremony and no performance advantage.

## Implementation Notes

- **IMP-001**: Stores live in `packages/shared/src/stores/` and are named by domain: `builder-store.ts`, `quiz-session-store.ts`, `exam-store.ts`; each store exports a single typed hook (e.g., `useBuilderStore`)
- **IMP-002**: The boundary rule is absolute: any data that originates from the API belongs in the TanStack Query cache — it is never duplicated into a Zustand store; Zustand stores may reference query data by key but must not copy it
- **IMP-003**: Success criterion — the quiz builder Zustand store persists to `localStorage`; refreshing the browser mid-draft fully restores the builder state (active question index, all unsaved field values) without triggering an API call

## References

- **REF-001**: `ADR-003-server-state.md` — TanStack Query holds all server-originated state; Zustand holds client UI state; these two stores must not overlap
- **REF-002**: `ADR-010-toolchain.md` — Biome linting and formatting applies to all store files in `packages/shared/src/stores/`
- **REF-003**: https://zustand.docs.pmnd.rs/
