---
title: "ADR-009: Questionnaire and Survey as separate domain types"
status: "Accepted"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["architecture", "decision", "domain-model"]
supersedes: ""
superseded_by: ""
---

# ADR-009: Questionnaire and Survey as separate domain types

## Context

Questify supports two root content types. During domain modeling (2026-06-30), the following distinctions were established:

| Property | Questionnaire | Survey |
|---|---|---|
| Scoring | Yes — uniform (1 pt/question) | No |
| Records all answer values | No (for now) | Yes |
| Result screen | Message or show results | Message only |
| Time limit | Optional | No |
| Non-linear navigation (QuestionJumpGrid) | Optional | No |
| Sections | Optional | Optional |
| Visibility | Public or private | Public or private |
| Access control | Anonymous / authenticated / cover screen | Same |
| Multiple attempts | Configurable | Configurable |

Three content types were initially considered (quiz, exam, survey). Quiz and exam were collapsed into a single **Questionnaire** type after establishing that all behavioral differences between them (sections, time limits, non-linear navigation, privacy) are configuration options, not structural differences. Survey remains a separate type because it has a fundamentally different answer model (records every value, no correct/incorrect) and a different result screen contract.

## Decision

`Questionnaire` and `Survey` are modeled as separate tables in the database. They share a common supporting infrastructure (Sections, Questions, QuestionOptions, Attempts, Answers) via a `parent_type` discriminator column.

The schema:

```
users
questionnaires        (creator_id → users.id)
surveys               (creator_id → users.id)
sections              (parent_type: 'questionnaire'|'survey', parent_id)
questions             (parent_type, parent_id, section_id nullable)
question_options      (question_id → questions.id)
attempts              (parent_type, parent_id, user_id nullable)
answers               (attempt_id → attempts.id, question_id → questions.id)
```

## Consequences

### Positive

- **POS-001**: Each type has its own table with only the columns it needs — no nullable columns carrying questionnaire-only fields on survey rows.
- **POS-002**: Separate tables make type-specific queries (e.g., "all published questionnaires by user") straightforward without a `WHERE type = 'questionnaire'` guard on every query.
- **POS-003**: The behavioral contract for each type is explicit in the schema — adding a `time_limit_seconds` column to `questionnaires` does not affect `surveys`.
- **POS-004**: The polymorphic supporting tables (sections, questions, attempts, answers) are shared, avoiding duplication of the question and attempt models.

### Negative

- **NEG-001**: The `parent_type` + `parent_id` pattern on shared tables is a polymorphic foreign key — the database cannot enforce referential integrity on it natively (D1/SQLite does not support conditional foreign keys). This must be enforced at the application layer.
- **NEG-002**: Queries that need to show a mixed list (e.g., "all content by this creator") require a UNION across both tables or a separate view.

## Alternatives Considered

### Single unified table with a type discriminator (rejected)

- **ALT-001**: One `content` table with `type: 'questionnaire' | 'survey'`. Survey-only and questionnaire-only columns are nullable.
- **ALT-001**: **Rejection reason**: As the two types diverge (questionnaire gets time limits, exam-style navigation config; survey gets response aggregation), the nullable column count grows and the table becomes a union of two different shapes. Separate tables keep the schema honest.

### Three tables: quiz, exam, survey (rejected)

- **ALT-002**: Original design with quiz, exam, and survey as distinct tables.
- **ALT-002**: **Rejection reason**: Quiz and exam share every behavioral property — all differences are configuration options (sections on/off, time limit on/off, navigation mode). Keeping them as separate tables would require duplicating the question and attempt models twice with no meaningful schema difference.

## Implementation Notes

- **IMP-001**: `questions.parent_type` + `questions.parent_id` reference either `questionnaires.id` or `surveys.id`. Application code must validate this before insert.
- **IMP-002**: `attempts.user_id` is nullable — anonymous takers are allowed when `questionnaire.access_mode = 'anonymous'` or `survey.access_mode = 'anonymous'`. Anonymous attempts must still have a valid `parent_id`.
- **IMP-003**: `answers.is_correct` is nullable. It is set on questionnaire attempts only. Survey answers always leave it null.
- **IMP-004**: `questions.show_correct_answer` and `questions.acceptable_answers` / `questions.case_sensitive` are questionnaire-only semantics stored on the shared `questions` table. They are ignored when the parent is a survey.
- **IMP-005**: Cascade delete is applied: deleting a questionnaire or survey deletes its sections, questions, question options, attempts, and answers.

## Question Types

Both Questionnaire and Survey support the same four question types:

| Type | Description |
|---|---|
| `single_choice` | Pick one option. True/False is this type with two pre-filled options. |
| `multiple_choice` | Pick all that apply. |
| `short_answer` | Free text. Questionnaire: graded by `acceptable_answers[]` + `case_sensitive`. Survey: captured as-is. |
| `long_answer` | Rich text (TipTap). Not auto-graded. Captured as-is. |

## Cover Screen

Both types support an optional pre-submission form (`access_mode: 'cover_screen'`). Fields are stored as a JSON array on the parent record:

```ts
type CoverScreenField = {
  label: string
  type: 'text' | 'email' | 'phone' | 'dropdown' | 'checkbox'
  required: boolean
  options?: string[]  // dropdown only
}
```

Submitted values are stored as JSON in `attempts.cover_screen_data`.

## Deferred

| Feature | Notes |
|---|---|
| Questionnaire versioning | Editing blocked at launch. No attempt-integrity problem to solve yet. |
| Weighted scoring / partial credit | Uniform scoring (1 pt/question) at launch. |
| Answer recording for questionnaires | Not needed at launch. Revisit when analytics features are built. |
| Organization / team ownership | Solo creator model only at launch. |
| Export of results | Out of scope v1. |

## References

- **REF-001**: [GLOSSARY.md](GLOSSARY.md) — canonical definitions for all domain terms.
- **REF-002**: [ADR-007-tiptap-v3-rich-text-editor.md](ADR-007-tiptap-v3-rich-text-editor.md) — long answer questions use TipTap for rich text input.
- **REF-003**: [ADR-006-file-based-theme-engine.md](ADR-006-file-based-theme-engine.md) — design system tokens used in builder and taker UIs.
