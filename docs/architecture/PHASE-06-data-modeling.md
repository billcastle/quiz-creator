---
phase: 06
title: "Data Modeling & Domain Design"
status: pending
depends_on: ["PHASE-01"]
estimated_tickets: 3
---

# PHASE-06: Data Modeling & Domain Design

## Overview

Before any database schema is written, this phase defines the complete domain model as TypeScript types and Zod validation schemas in `packages/shared`. This is a design-first approach: the data contracts are agreed upon and validated at the type level before a single SQL table is created. The Drizzle ORM schema produced in PHASE-07 is derived directly from these types — not the other way around.

`packages/shared` is the only package with zero framework dependencies. It imports only `zod`. It is consumed by every other package in the monorepo: the API server uses the Zod schemas for request validation, the UI uses the TypeScript types for prop typing, and the database layer derives its column types from the same interfaces. This makes `packages/shared` the single source of truth for the application's data shape.

The philosophy: **define the domain in pure TypeScript, validate at the boundaries with Zod, derive everything else.**

---

## Technical Architecture

### Domain Entities

All TypeScript domain interfaces live in `packages/shared/src/types/`. Each file corresponds to one aggregate or tightly coupled group of entities.

---

#### `User` (`types/user.ts`)

Represents an authenticated account in the system. Better Auth manages the session layer, but the `User` type is the application-level projection — it is what the API returns and what the UI renders.

```ts
interface User {
  id: string;              // nanoid or cuid2 — URL-safe, short
  username: string;        // unique; 3-20 chars; alphanumeric + underscore only
  email: string;           // unique; validated as email format
  passwordHash: string;    // bcrypt hash; never sent to client
  role: 'user' | 'admin';
  avatarUrl?: string;      // external URL or CDN path
  bio?: string;            // optional profile bio, max 300 chars
  createdAt: Date;
  updatedAt: Date;
}
```

A `PublicUser` projection (omitting `passwordHash` and `email`) is exported separately for client-facing use. The raw `User` interface is only used server-side.

---

#### Questionnaire Type Aliases (`types/questionnaire.ts`)

These narrow union types drive conditional rendering and business rule branching throughout the application. Centralizing them here ensures all packages use the same canonical strings.

```ts
type QuestionnaireType       = 'quiz' | 'survey' | 'exam';
type QuestionnaireStatus     = 'draft' | 'published' | 'archived';
type QuestionnaireVisibility = 'public' | 'private' | 'unlisted';
type QuestionnaireDifficulty = 'easy' | 'medium' | 'hard';
```

---

#### `QuestionnaireSettings` (`types/questionnaire.ts`)

A structured bag of optional configuration that varies by type. Stored as JSONB (TEXT in SQLite) to avoid over-normalization and to allow new settings to be added without schema migrations.

```ts
interface QuestionnaireSettings {
  customThankYouMessage?: string;       // shown on survey completion
  showResultsImmediately?: boolean;     // exam only; default false
  timeLimit?: number;                   // seconds; exam only; undefined = no limit
  releaseDate?: string;                 // ISO 8601 date string; exam deferred results
  instructorMessage?: string;           // shown when exam results are deferred
}
```

---

#### `Questionnaire` (`types/questionnaire.ts`)

The top-level aggregate. Represents a quiz, survey, or exam as created and published by a user.

```ts
interface Questionnaire {
  id: string;
  slug: string;                         // unique, URL-safe; auto-generated from title; overridable
  title: string;
  description?: string;
  type: QuestionnaireType;
  status: QuestionnaireStatus;
  visibility: QuestionnaireVisibility;
  creatorId: string;                    // FK → User.id
  category?: string;                    // FK → Category.slug
  difficulty?: QuestionnaireDifficulty;
  isScoreBased: boolean;                // false for all surveys; optional for quizzes
  settings: QuestionnaireSettings;      // always present; fields inside are optional
  shareToken: string;                   // UUID v4; used for share URLs; decoupled from id
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;                   // set when status transitions to 'published'
}
```

---

#### `Section` (`types/section.ts`)

Sections exist only for `exam` type questionnaires. They allow grouping questions into thematic blocks (e.g., "Part A: Grammar", "Part B: Reading"). Quizzes and surveys have no sections.

```ts
interface Section {
  id: string;
  questionnaireId: string;   // FK → Questionnaire.id
  title: string;
  description?: string;
  order: number;             // 0-indexed; determines display order
}
```

---

#### Question Type Aliases and Settings (`types/question.ts`)

```ts
type QuestionType = 'radio' | 'checkbox' | 'text' | 'textarea' | 'select';
```

`QuestionSettings` applies specifically to `text` and `textarea` question types, where the "correct answer" is open-ended and matching rules are needed.

```ts
interface QuestionSettings {
  caseSensitive?: boolean;              // default false
  acceptSubstring?: boolean;            // "Paris" matches "Paris is beautiful"
  acceptPlural?: boolean;               // "cat" matches "cats"
  customValidation?: string;            // regex string applied to input
  correctAnswers?: string[];            // for text type in scored questionnaires
  acceptableAnswerLevel?: 'exact' | 'partial' | 'lenient';
}
```

---

#### `Question` (`types/question.ts`)

Represents a single question within a questionnaire. The `content` field is plain text (no rich text in v1 scope).

```ts
interface Question {
  id: string;
  questionnaireId: string;   // FK → Questionnaire.id
  sectionId?: string;        // FK → Section.id; only set for exam-type questions
  order: number;             // 0-indexed within section (or questionnaire if no sections)
  type: QuestionType;
  content: string;           // the question text; max 2000 chars
  required: boolean;         // default true
  settings?: QuestionSettings;
  createdAt: Date;
}
```

---

#### `QuestionOption` (`types/question.ts`)

Represents a single selectable answer option for `radio`, `checkbox`, or `select` question types. Text and textarea questions do not have options.

```ts
interface QuestionOption {
  id: string;
  questionId: string;    // FK → Question.id
  content: string;       // the option label; max 500 chars
  order: number;         // display order
  isCorrect: boolean;    // only meaningful for scored questionnaires; default false
}
```

---

#### `Response` and `Answer` (`types/response.ts`)

A `Response` is a single completed submission of a questionnaire. It groups all answers from one session.

```ts
interface Response {
  id: string;
  questionnaireId: string;       // FK → Questionnaire.id
  respondentId?: string;         // FK → User.id; null = anonymous response
  completedAt: Date;
  metadata: {
    timeSpent?: number;          // seconds from first question to submission
    device?: string;             // 'mobile' | 'desktop' | 'tablet' (UA-derived)
  };
}
```

An `Answer` is the stored value for a single question within a response.

```ts
interface Answer {
  id: string;
  responseId: string;     // FK → Response.id
  questionId: string;     // FK → Question.id
  value: string;          // ALL types stored as TEXT; arrays serialized as JSON string
  isCorrect?: boolean;    // computed and stored at submission time for scored questions
}
```

---

#### `Category` (`types/category.ts`)

A curated taxonomy of questionnaire categories. Managed by admins; not user-created in v1.

```ts
interface Category {
  id: string;
  name: string;           // display label, e.g., "Science & Nature"
  slug: string;           // URL-safe, e.g., "science-nature"
  icon?: string;          // emoji or icon name, e.g., "🔬"
}
```

---

### Zod Validation Schemas

All Zod schemas live in `packages/shared/src/schemas/`. Each schema corresponds to a specific API operation — create, update, or submit. Schemas are used for runtime validation at API boundaries. TypeScript types are inferred from schemas where the schema is the source of truth; otherwise types are defined first and schemas mirror them.

---

#### Questionnaire Schemas (`schemas/questionnaire.ts`)

```ts
const QuestionnaireSettingsSchema = z.object({
  customThankYouMessage: z.string().max(500).optional(),
  showResultsImmediately: z.boolean().optional(),
  timeLimit: z.number().int().min(60).optional(),
  releaseDate: z.string().datetime({ offset: true }).optional(),
  instructorMessage: z.string().max(1000).optional(),
});

const CreateQuestionnaireSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['quiz', 'survey', 'exam']),
  visibility: z.enum(['public', 'private', 'unlisted']).default('public'),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  isScoreBased: z.boolean().default(false),
  settings: QuestionnaireSettingsSchema.optional(),
});

const UpdateQuestionnaireSchema = CreateQuestionnaireSchema.partial();

type CreateQuestionnaireInput = z.infer<typeof CreateQuestionnaireSchema>;
type UpdateQuestionnaireInput = z.infer<typeof UpdateQuestionnaireSchema>;
```

---

#### Question Schemas (`schemas/question.ts`)

```ts
const CreateQuestionOptionSchema = z.object({
  content: z.string().min(1, 'Option text is required').max(500),
  order: z.number().int().min(0),
  isCorrect: z.boolean().default(false),
});

const QuestionSettingsSchema = z.object({
  caseSensitive: z.boolean().optional(),
  acceptSubstring: z.boolean().optional(),
  acceptPlural: z.boolean().optional(),
  customValidation: z.string().optional(),
  correctAnswers: z.array(z.string()).optional(),
  acceptableAnswerLevel: z.enum(['exact', 'partial', 'lenient']).optional(),
});

const CreateQuestionSchema = z.object({
  questionnaireId: z.string().min(1),
  sectionId: z.string().optional(),
  order: z.number().int().min(0),
  type: z.enum(['radio', 'checkbox', 'text', 'textarea', 'select']),
  content: z.string().min(1, 'Question content is required').max(2000),
  required: z.boolean().default(true),
  settings: QuestionSettingsSchema.optional(),
  options: z.array(CreateQuestionOptionSchema).optional(),
});

type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
type CreateQuestionOptionInput = z.infer<typeof CreateQuestionOptionSchema>;
```

---

#### Response Schemas (`schemas/response.ts`)

```ts
const AnswerInputSchema = z.object({
  questionId: z.string().min(1),
  value: z.string(),               // caller serializes arrays before submitting
});

const SubmitResponseSchema = z.object({
  questionnaireId: z.string().min(1),
  answers: z.array(AnswerInputSchema).min(1, 'At least one answer is required'),
  metadata: z.object({
    timeSpent: z.number().int().min(0).optional(),
    device: z.string().optional(),
  }).optional(),
});

type SubmitResponseInput = z.infer<typeof SubmitResponseSchema>;
```

---

#### User Schemas (`schemas/user.ts`)

```ts
const UserRegistrationSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Must be a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const UserLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'), // email OR username
  password: z.string().min(1, 'Password is required'),
});

type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;
type UserLoginInput = z.infer<typeof UserLoginSchema>;
```

Note on `UserLoginSchema.identifier`: the field accepts either an email address or a username string. Distinguishing between the two (routing to the correct lookup) is handled at the application layer in the auth service — not inside the Zod schema itself.

---

### Inferred Types

Where a Zod schema is the source of truth (input/form types), the TypeScript type is derived via `z.infer`:

```ts
// Pattern used throughout schemas/
export const SomeSchema = z.object({ ... });
export type SomeInput = z.infer<typeof SomeSchema>;
```

Where the TypeScript interface is the source of truth (domain entities returned from DB), the type is defined in `types/` and the Zod schema mirrors it. Both the schema and the inferred type are exported from each file.

---

### Key Design Decisions

**1. Answer values stored as TEXT regardless of question type.**
Checkbox answers (multiple selected options) are serialized as a JSON string array — e.g., `'["opt-1","opt-3"]'` — before storage. Deserialization happens at the application layer when reading answers back. This avoids a many-to-many join table for answers and keeps the response row self-contained. The tradeoff is that querying individual checkbox selections requires application-side parsing, which is acceptable for v1 query volumes.

**2. Score calculation is never persisted in the `Answer` row — it is computed at read time.**
The `isCorrect` field on `Answer` is computed and stored at submission time (not recomputed on every read), but the derived score (e.g., "8/10") is never stored. Scores are always computed from `COUNT(answers WHERE isCorrect = true)` at display time. This means score logic stays in one place and historical answers are never invalidated by retroactive "correct answer" changes.

**3. Share tokens (`shareToken`) are decoupled from questionnaire IDs.**
A questionnaire's `id` is a stable internal reference. The `shareToken` is a UUID v4 used exclusively for the public share URL (`/q/{shareToken}`). This separation means the share link can be regenerated (e.g., to revoke access) without changing the questionnaire's database identity or breaking any foreign key relationships.

**4. `QuestionnaireSettings` stored as JSONB (TEXT in SQLite).**
New settings fields can be added (e.g., `allowRetake`, `shuffleQuestions`) without altering the database schema. The Zod schema at the application boundary enforces the shape. This is a deliberate tradeoff: slightly less queryable at the DB level, but much more flexible for iterative feature development.

**5. Anonymous responses are fully supported.**
`Response.respondentId` is nullable. An anonymous respondent still generates a `Response` row and a full set of `Answer` rows. Analytics (completion rate, average score) work on all responses regardless of whether they are attributed to a user account.

**6. Slug is auto-generated but manually overridable.**
On creation, `slug` is derived from `title` via the `generateSlug` utility (strips special chars, lowercases, hyphenates). On update, if the user explicitly provides a `slug` field, it overrides the auto-generated one. Uniqueness is enforced at the database level with a unique index.

**7. `QuestionSettings` are optional and per-question.**
A `text` question in a non-scored questionnaire (e.g., a survey) has no `correctAnswers` and no `settings` at all. A `text` question in a scored quiz may have `settings.correctAnswers` and `settings.acceptableAnswerLevel` set. The optional nature of `QuestionSettings` means the schema is not prescriptive — correct answer behavior is opt-in, not required.

---

### `packages/shared` Exports (`src/index.ts`)

The root `index.ts` re-exports everything through barrel files:

```ts
// Types
export type {
  User,
  Questionnaire,
  QuestionnaireType,
  QuestionnaireStatus,
  QuestionnaireVisibility,
  QuestionnaireDifficulty,
  QuestionnaireSettings,
} from './types/questionnaire';

export type { Section } from './types/section';

export type {
  QuestionType,
  Question,
  QuestionOption,
  QuestionSettings,
} from './types/question';

export type { Response, Answer } from './types/response';
export type { Category } from './types/category';

// Schemas
export {
  CreateQuestionnaireSchema,
  UpdateQuestionnaireSchema,
} from './schemas/questionnaire';
export type {
  CreateQuestionnaireInput,
  UpdateQuestionnaireInput,
} from './schemas/questionnaire';

export {
  CreateQuestionSchema,
  CreateQuestionOptionSchema,
} from './schemas/question';
export type {
  CreateQuestionInput,
  CreateQuestionOptionInput,
} from './schemas/question';

export { SubmitResponseSchema } from './schemas/response';
export type { SubmitResponseInput } from './schemas/response';

export { UserRegistrationSchema, UserLoginSchema } from './schemas/user';
export type { UserRegistrationInput, UserLoginInput } from './schemas/user';

// Utilities
export { generateSlug } from './utils/slug';
export { calculateScore } from './utils/score';
```

---

## Directory Structure

```
packages/shared/src/
├── types/
│   ├── user.ts           — User interface + PublicUser projection
│   ├── questionnaire.ts  — Questionnaire, QuestionnaireType, Status, Visibility, Difficulty, Settings
│   ├── question.ts       — Question, QuestionType, QuestionOption, QuestionSettings
│   ├── section.ts        — Section
│   ├── response.ts       — Response, Answer
│   ├── category.ts       — Category
│   └── index.ts          — barrel re-export of all types
├── schemas/
│   ├── user.ts           — UserRegistrationSchema, UserLoginSchema
│   ├── questionnaire.ts  — CreateQuestionnaireSchema, UpdateQuestionnaireSchema
│   ├── question.ts       — CreateQuestionSchema, CreateQuestionOptionSchema
│   ├── response.ts       — SubmitResponseSchema
│   └── index.ts          — barrel re-export of all schemas
├── utils/
│   ├── slug.ts           — generateSlug(title: string): string
│   └── score.ts          — calculateScore(answers: Answer[], questions: Question[]): number
└── index.ts              — root barrel; re-exports everything above
```

### Utility Function Signatures

**`generateSlug`** (`utils/slug.ts`):
```ts
function generateSlug(title: string): string
// "My Great Quiz!" → "my-great-quiz"
// Strips non-alphanumeric (except hyphens), lowercases, collapses spaces to hyphens
// Does NOT check uniqueness — that is the caller's responsibility
```

**`calculateScore`** (`utils/score.ts`):
```ts
function calculateScore(
  answers: Answer[],
  questions: Question[]
): { correct: number; total: number; percentage: number }
// Pure function — no DB access, no side effects
// Counts answers where isCorrect === true against total scoreable questions
// Returns structured result; the caller formats the display (e.g., "8/10", "80%")
```

---

## Implementation Steps

### Step 1 — Define TypeScript Domain Interfaces (Ticket DM-601)
Create all files in `packages/shared/src/types/`. Define every interface and type alias listed in this document. Wire up `types/index.ts` barrel. Run `tsc --noEmit` in the `packages/shared` context to confirm zero type errors. No Zod dependency yet at this step.

### Step 2 — Write Zod Schemas (Ticket DM-602)
Create all files in `packages/shared/src/schemas/`. Write every schema with the exact validation rules specified above. Derive `z.infer` types where the schema is the source of truth. Export both the schema constant and the inferred type from each file. Wire up `schemas/index.ts`. Confirm schemas compile and that `tsc --noEmit` still passes.

### Step 3 — Utility Functions and Barrel Wiring (Ticket DM-603)
Implement `generateSlug` and `calculateScore` in `packages/shared/src/utils/`. Write unit tests for both (edge cases: empty title, all-special-char title, score of zero, score of 100%). Wire up root `src/index.ts` to re-export everything. Verify `packages/shared` builds cleanly and all exports are resolvable.

---

## Tickets

| Ticket | Description | Owner | Effort |
|--------|-------------|-------|--------|
| DM-601 | TypeScript domain interfaces — all types/ files | Nova | S |
| DM-602 | Zod validation schemas — all schemas/ files | Nova | S |
| DM-603 | Utility functions (slug, score) + barrel exports | Nova | S |

---

## Acceptance Criteria

- All TypeScript interfaces and type aliases are defined in the correct files under `packages/shared/src/types/`
- All Zod schemas are defined in `packages/shared/src/schemas/` and match their corresponding TypeScript interfaces
- `UserRegistrationSchema` rejects: usernames shorter than 3 chars, usernames with special characters (e.g., `user@name`), passwords without uppercase letters, passwords without numbers, invalid email formats
- `SubmitResponseSchema` rejects: missing `questionnaireId`, empty `answers` array, answer entries without `questionId` or `value`
- `packages/shared` builds with zero TypeScript errors in strict mode
- All types, schemas, and utilities are accessible via top-level import: `import { Questionnaire, CreateQuestionnaireSchema, generateSlug } from '@questify/shared'`
- No runtime dependency other than `zod` in `packages/shared/package.json`
- `generateSlug` and `calculateScore` have passing unit tests covering edge cases

---

## Out of Scope

- Drizzle ORM schema definition (PHASE-07)
- Database migration files (PHASE-07)
- API endpoint implementation (PHASE-08)
- Better Auth integration (covered separately)
- Any runtime database operations
- Data seeding scripts

---

## Estimated Effort

**M** — Three focused tickets, all in one package. The complexity is in getting the type definitions right (especially conditional fields like `QuestionSettings` and `QuestionnaireSettings`) and ensuring the Zod schemas are accurate mirrors of the TypeScript interfaces. No build tooling changes needed beyond installing `zod` as a dependency.
