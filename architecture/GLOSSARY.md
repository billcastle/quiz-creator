# Questify — Domain Glossary

> Canonical definitions for all domain terms used in code, tickets, and architecture documents.
> When a term has a specific meaning in Questify that differs from everyday usage, this file is authoritative.

---

## Core Domain Terms

### Questionnaire
The unified content type for scored knowledge assessments. Replaces the separate "quiz" and "exam" concepts — both are Questionnaires with different configuration. A Questionnaire has a correct/incorrect answer model, optional time limit, optional sections, optional non-linear navigation, and a configurable result screen. Belongs to one creator.

See: [ADR-009](ADR-009-questionnaire-survey-domain-model.md)

---

### Survey
A content type for data collection without scoring. A Survey records every answer submitted by every taker. It has no correct/incorrect answer model and shows only a customizable message on the result screen. Belongs to one creator.

See: [ADR-009](ADR-009-questionnaire-survey-domain-model.md)

---

### Creator
An authenticated user who builds and publishes Questionnaires and Surveys. A Creator owns their content exclusively — no shared or collaborative ownership.

---

### Taker
A person who submits a response to a Questionnaire or Survey. A Taker may be anonymous (no account required), authenticated (must be signed in), or prompted through a Cover Screen before accessing the content. The term "Taker" is preferred over "respondent" or "participant" in code.

---

### Section
An ordered group of Questions within a Questionnaire or Survey. Sections are optional — a flat list of Questions with no Sections is valid. In Questionnaires, Sections enable the QuestionJumpGrid navigation. Both Questionnaires and Surveys support Sections.

---

### Question
A single prompt within a Questionnaire or Survey. Questions have a `type` that determines their answer format:

| Type | Description |
|---|---|
| `single_choice` | Pick exactly one option. True/False questions are this type with two pre-filled options. |
| `multiple_choice` | Pick all that apply. |
| `short_answer` | Free text. In Questionnaires, graded by a list of acceptable answers. |
| `long_answer` | Rich text (TipTap). Not auto-graded. Captured as-is. |

---

### QuestionOption
A selectable answer choice for `single_choice` or `multiple_choice` Questions. In a Questionnaire, each option has an `is_correct` flag. In a Survey, options have no correct/incorrect designation.

---

### Attempt
A single submission session by a Taker for a Questionnaire or Survey. An Attempt contains all Answers submitted in that session, the Cover Screen data (if collected), a score (Questionnaire only), and timestamps for start and completion. A Taker may have multiple Attempts if the creator has enabled them.

---

### Answer
A Taker's response to a single Question within an Attempt. For choice questions, an Answer stores the selected option IDs. For text questions, it stores the text value. For Questionnaire Answers, `is_correct` is computed at submission time. For Survey Answers, `is_correct` is always null.

---

### Cover Screen
An optional pre-submission form shown to Takers before they access a Questionnaire or Survey. The Creator configures which fields to collect (name, email, phone, dropdown, checkbox). All collected values are stored on the Attempt record. The Cover Screen is one of three access modes: `anonymous` (no gate), `authenticated` (sign-in required), `cover_screen` (identity form).

---

### Access Mode
A per-Questionnaire/Survey setting that controls who can take it:

| Mode | Behaviour |
|---|---|
| `anonymous` | Anyone can take it without an account |
| `authenticated` | Taker must be signed in |
| `cover_screen` | Anyone can take it, but must complete a Cover Screen form first |

---

### Result Screen
The screen shown to a Taker after submission. For Questionnaires, the Creator can choose between a custom message or showing the Taker's score and correct/incorrect breakdown. For Surveys, only a custom message is shown.

---

### QuestionJumpGrid
A navigation UI in Questionnaires that lets Takers jump non-linearly between questions. Each cell shows the question number and its state: `unanswered`, `answered`, `flagged`, or `current`. Enabled when a Questionnaire has Sections.

---

### Draft / Published
The lifecycle states of a Questionnaire or Survey. A `draft` is only visible to its Creator. A `published` record is discoverable based on its visibility setting. Published content cannot be edited (versioning is a future feature).

---

### Visibility
Controls discoverability of published Questionnaires and Surveys:

| Value | Behaviour |
|---|---|
| `public` | Appears on the Creator's public profile page; discoverable by anyone |
| `private` | Only accessible via direct link; does not appear on the Creator's profile |

---

## Deprecated / Rejected Terms

| Term | Status | Use instead |
|---|---|---|
| Quiz | Rejected — merged into Questionnaire | Questionnaire |
| Exam | Rejected — merged into Questionnaire | Questionnaire |
| Respondent | Avoid — ambiguous | Taker |
| Participant | Avoid — ambiguous | Taker |
