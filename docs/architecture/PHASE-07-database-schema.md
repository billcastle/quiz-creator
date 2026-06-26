---
phase: 07
title: "Database Schema & Migrations"
status: pending
depends_on: ["PHASE-06"]
estimated_tickets: 5
---

# PHASE-07 — Database Schema & Migrations

## Overview

This phase translates the domain model established in PHASE-06 into concrete Drizzle ORM schema definitions targeting Cloudflare D1 (SQLite-compatible). It establishes the complete migration workflow for both local development (via Wrangler) and Cloudflare production (via wrangler d1 migrations), and populates the development database with realistic seed data sufficient for testing all downstream phases.

After this phase, every subsequent backend phase (PHASE-08 and beyond) can import from `@quiz/db` and get a fully typed Drizzle client, all schema types, and query helpers — with zero schema ambiguity.

---

## Goals

- [ ] Define all 8 Drizzle schema tables in `packages/db/src/schema/`
- [ ] Export all schema objects and inferred TypeScript types from `packages/db/src/schema/index.ts`
- [ ] Configure `drizzle.config.ts` with correct D1/SQLite dialect settings
- [ ] Implement `createDb()` factory in `packages/db/src/client.ts`
- [ ] Register D1 binding in `apps/api/wrangler.toml`
- [ ] Add all `db:*` npm scripts to `packages/db/package.json`
- [ ] Generate initial migration file via `npm run db:generate`
- [ ] Apply migration to local D1 via `npm run db:migrate:local` with zero errors
- [ ] Write seed data (`seed.ts` + `seed.sql`) and verify `npm run db:seed` populates local D1
- [ ] TypeScript strict mode: zero errors across `packages/db`
- [ ] `npm run db:studio` opens Drizzle Studio showing all 8 tables

---

## Architecture Decisions Required

**D1 Constraint: No enforced foreign keys** — Cloudflare D1 does not enforce foreign key constraints at the database level (they are parsed but not enforced in the SQLite mode D1 uses). All referential integrity is the responsibility of the application layer. Schema definitions must NOT rely on cascades or FK violation errors to maintain data integrity.

**ID Strategy: nanoid / cuid2 over auto-increment** — Auto-increment integer IDs are predictable, expose record counts, and create merge conflicts in distributed or replicated systems. All primary keys use nanoid (7–21 chars) or cuid2 strings. The generating package is `nanoid` (ESM, tree-shakeable). IDs are generated in application code before the INSERT, not by the database.

**Timestamp Strategy: INTEGER (Unix epoch ms)** — SQLite has no native DATETIME type. All timestamps are stored as `INTEGER` representing Unix epoch milliseconds. Drizzle's `{ mode: 'timestamp_ms' }` option makes the TypeScript type `Date`, allowing seamless conversion at the query boundary. Use `Date.now()` to produce values for insert; use `new Date(row.createdAt)` to convert back to JS Date objects in application code.

**JSON Fields: TEXT with `.$type<T>()`** — Complex nested structures (settings objects, metadata) are stored as TEXT (JSON-serialized strings). The `.$type<T>()` Drizzle annotation provides TypeScript type hints at the query layer but does NOT affect the underlying column type. Application code must call `JSON.stringify()` on write and `JSON.parse()` on read. A helper utility in `packages/db/src/lib/json.ts` should wrap this pattern.

**Boolean Fields: INTEGER with `{ mode: 'boolean' }`** — SQLite has no BOOLEAN type. Drizzle maps `true → 1` and `false → 0` automatically when `{ mode: 'boolean' }` is specified. Never store booleans as TEXT ('true'/'false') or use bare integer columns without the mode option — the TypeScript type would be `number` instead of `boolean`.

---

## Technical Architecture

### Drizzle + D1 Architecture Overview

`packages/db` is the sole owner of all database concerns in the monorepo. No other package or app imports from `drizzle-orm` directly — they go through `@quiz/db`.

The package uses:
- `drizzle-orm` — query builder and schema definition DSL
- `drizzle-orm/d1` — Cloudflare D1 adapter (`drizzle(d1Binding, { schema })`)
- `drizzle-orm/sqlite-core` — column type constructors: `sqliteTable`, `text`, `integer`, `blob`
- `drizzle-kit` — CLI tool for generating SQL migration files (dev dependency)
- `@clack/prompts` and `nanoid` — used by seed script

Column type reference for D1/SQLite via Drizzle:

| Logical Type     | Drizzle Column                                  | SQLite Storage |
|------------------|-------------------------------------------------|----------------|
| String / UUID    | `text('col')`                                   | TEXT           |
| Enum string      | `text('col', { enum: [...] })`                  | TEXT           |
| Boolean          | `integer('col', { mode: 'boolean' })`           | INTEGER        |
| Timestamp (ms)   | `integer('col', { mode: 'timestamp_ms' })`      | INTEGER        |
| JSON object      | `text('col').$type<T>()`                        | TEXT           |
| Auto PK (avoid)  | `integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true })` | INTEGER |

Indexes are defined using Drizzle's `index()` helper inside the table definition's third argument callback, or via raw SQL in the migration file. Both approaches produce identical SQL; prefer the Drizzle helper so indexes are reflected in the TypeScript schema object.

---

### Schema Files (`packages/db/src/schema/`)

#### `users.ts`

The users table is the identity anchor for the entire system. It stores credentials managed by Better-auth (PHASE-09) and the public-facing profile fields.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id:           text('id').primaryKey(),
    username:     text('username').notNull().unique(),
    email:        text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
    avatarUrl:    text('avatar_url'),
    bio:          text('bio'),
    createdAt:    integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt:    integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    usernameIdx: index('idx_users_username').on(table.username),
    emailIdx:    index('idx_users_email').on(table.email),
  })
)

export type User        = typeof users.$inferSelect
export type InsertUser  = typeof users.$inferInsert
```

The `passwordHash` column is written exclusively by the auth layer (PHASE-09). No query outside the auth service should read or write this column.

#### `questionnaires.ts`

The central table. Each row represents one quiz, survey, or exam created by a user.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import type { QuestionnaireSettings } from '../types'

export const questionnaires = sqliteTable(
  'questionnaires',
  {
    id:          text('id').primaryKey(),
    slug:        text('slug').notNull().unique(),
    title:       text('title').notNull(),
    description: text('description'),
    type:        text('type', { enum: ['quiz', 'survey', 'exam'] }).notNull(),
    status:      text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
    visibility:  text('visibility', { enum: ['public', 'private', 'unlisted'] }).notNull().default('public'),
    creatorId:   text('creator_id').notNull(),
    category:    text('category'),
    difficulty:  text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
    isScoreBased:integer('is_score_based', { mode: 'boolean' }).notNull().default(false),
    settings:    text('settings').$type<QuestionnaireSettings>(),
    shareToken:  text('share_token').notNull().unique(),
    createdAt:   integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt:   integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    creatorIdx:         index('idx_questionnaires_creator_id').on(table.creatorId),
    slugIdx:            index('idx_questionnaires_slug').on(table.slug),
    shareTokenIdx:      index('idx_questionnaires_share_token').on(table.shareToken),
    statusVisibilityIdx:index('idx_questionnaires_status_visibility').on(table.status, table.visibility),
  })
)

export type Questionnaire       = typeof questionnaires.$inferSelect
export type InsertQuestionnaire = typeof questionnaires.$inferInsert
```

The `statusVisibilityIdx` composite index is critical for the public feed query: `WHERE status = 'published' AND visibility = 'public'`. Without this index, the feed query would scan the entire table.

The `settings` TEXT column stores a JSON-serialized `QuestionnaireSettings` object. The shape differs by `type`:

```typescript
// packages/db/src/types.ts
export interface QuizSettings {
  showScoreAtEnd: boolean
  shuffleQuestions: boolean
  allowRetake: boolean
}

export interface SurveySettings {
  thankYouMessage: string
  allowAnonymous: boolean
}

export interface ExamSettings {
  timeLimitMinutes: number | null
  shuffleQuestions: boolean
  resultMode: 'immediate' | 'custom_message'
  customResultMessage: string | null
}

export type QuestionnaireSettings = QuizSettings | SurveySettings | ExamSettings
```

#### `sections.ts`

Sections group questions within a questionnaire (primarily used by Exam type for multi-section structure).

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const sections = sqliteTable(
  'sections',
  {
    id:               text('id').primaryKey(),
    questionnaireId:  text('questionnaire_id').notNull(),
    title:            text('title').notNull(),
    description:      text('description'),
    order:            integer('order').notNull(),
  },
  (table) => ({
    questionnaireIdx: index('idx_sections_questionnaire_id').on(table.questionnaireId),
  })
)

export type Section       = typeof sections.$inferSelect
export type InsertSection = typeof sections.$inferInsert
```

The `order` column is a 0-based integer maintained by the application. Reordering sections requires updating multiple rows; the API layer handles this as a batch update within a single D1 request (PHASE-08 / PHASE-10).

#### `questions.ts`

One row per question. Questions belong to a questionnaire and optionally to a section.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import type { QuestionSettings } from '../types'

export const questions = sqliteTable(
  'questions',
  {
    id:              text('id').primaryKey(),
    questionnaireId: text('questionnaire_id').notNull(),
    sectionId:       text('section_id'),           // nullable — questions can be section-less
    order:           integer('order').notNull(),
    type:            text('type', { enum: ['radio', 'checkbox', 'text', 'textarea', 'select'] }).notNull(),
    content:         text('content').notNull(),
    required:        integer('required', { mode: 'boolean' }).notNull().default(true),
    settings:        text('settings').$type<QuestionSettings>(),
  },
  (table) => ({
    questionnaireIdx: index('idx_questions_questionnaire_id').on(table.questionnaireId),
    sectionIdx:       index('idx_questions_section_id').on(table.sectionId),
  })
)

export type Question       = typeof questions.$inferSelect
export type InsertQuestion = typeof questions.$inferInsert
```

`QuestionSettings` is a per-type JSON object:

```typescript
export interface RadioQuestionSettings {
  // no extra settings currently
}

export interface CheckboxQuestionSettings {
  minSelect?: number
  maxSelect?: number
}

export interface TextQuestionSettings {
  placeholder?: string
  maxLength?: number
}

export type QuestionSettings = RadioQuestionSettings | CheckboxQuestionSettings | TextQuestionSettings
```

#### `question-options.ts`

Each selectable answer choice for radio, checkbox, and select questions. Text and textarea questions have no options rows.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const questionOptions = sqliteTable(
  'question_options',
  {
    id:        text('id').primaryKey(),
    questionId:text('question_id').notNull(),
    content:   text('content').notNull(),
    order:     integer('order').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    questionIdx: index('idx_question_options_question_id').on(table.questionId),
  })
)

export type QuestionOption       = typeof questionOptions.$inferSelect
export type InsertQuestionOption = typeof questionOptions.$inferInsert
```

`isCorrect` is only meaningful for quiz/exam types. For surveys this field is always `false` and must not be exposed in the take-mode API response.

#### `responses.ts`

One row per completed submission. Anonymous responses have a null `respondentId`; authenticated responses store the user's ID.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import type { ResponseMetadata } from '../types'

export const responses = sqliteTable(
  'responses',
  {
    id:              text('id').primaryKey(),
    questionnaireId: text('questionnaire_id').notNull(),
    respondentId:    text('respondent_id'),           // nullable for anonymous
    completedAt:     integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
    metadata:        text('metadata').$type<ResponseMetadata>(),
  },
  (table) => ({
    questionnaireIdx: index('idx_responses_questionnaire_id').on(table.questionnaireId),
    respondentIdx:    index('idx_responses_respondent_id').on(table.respondentId),
  })
)

export type Response       = typeof responses.$inferSelect
export type InsertResponse = typeof responses.$inferInsert
```

`ResponseMetadata` captures device/session context for analytics:

```typescript
export interface ResponseMetadata {
  userAgent?: string
  ipCountry?: string         // from Cloudflare cf-ipcountry header
  durationSeconds?: number   // time from first question render to submit
  anonymousId?: string       // localStorage UUID for anonymous respondents
}
```

#### `answers.ts`

One row per question answered within a response. All answer values are stored as TEXT regardless of question type. For checkbox questions (multiple selections), the value is a JSON array string: `'["opt_abc", "opt_def"]'`.

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const answers = sqliteTable(
  'answers',
  {
    id:         text('id').primaryKey(),
    responseId: text('response_id').notNull(),
    questionId: text('question_id').notNull(),
    value:      text('value').notNull(),    // always TEXT; JSON array for checkbox
    isCorrect:  integer('is_correct', { mode: 'boolean' }),  // nullable — null for survey questions
  },
  (table) => ({
    responseIdx: index('idx_answers_response_id').on(table.responseId),
    questionIdx: index('idx_answers_question_id').on(table.questionId),
  })
)

export type Answer       = typeof answers.$inferSelect
export type InsertAnswer = typeof answers.$inferInsert
```

`isCorrect` is computed at response-submission time by comparing `value` against the correct option IDs from `question_options`. For survey questions it is always stored as `null`. Recomputing on read is not acceptable for performance — always store at write time.

#### `categories.ts`

Flat taxonomy for questionnaire categorization. Managed by admins only.

```typescript
import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable(
  'categories',
  {
    id:   text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    icon: text('icon'),   // emoji character or icon name string (e.g. '📐' or 'calculator')
  },
  (table) => ({
    slugIdx: index('idx_categories_slug').on(table.slug),
  })
)

export type Category       = typeof categories.$inferSelect
export type InsertCategory = typeof categories.$inferInsert
```

#### `schema/index.ts` — Barrel Export

This file is the single import point for all consumers of `@quiz/db`. It re-exports every schema object and every inferred TypeScript type.

```typescript
// Schema objects (used by Drizzle client, migrations, query helpers)
export { users }           from './users'
export { questionnaires }  from './questionnaires'
export { sections }        from './sections'
export { questions }       from './questions'
export { questionOptions } from './question-options'
export { responses }       from './responses'
export { answers }         from './answers'
export { categories }      from './categories'

// Inferred TypeScript types (select shapes)
export type { User, InsertUser }                         from './users'
export type { Questionnaire, InsertQuestionnaire }       from './questionnaires'
export type { Section, InsertSection }                   from './sections'
export type { Question, InsertQuestion }                 from './questions'
export type { QuestionOption, InsertQuestionOption }     from './question-options'
export type { Response, InsertResponse }                 from './responses'
export type { Answer, InsertAnswer }                     from './answers'
export type { Category, InsertCategory }                 from './categories'

// Domain types used in JSON columns
export type {
  QuestionnaireSettings,
  QuizSettings,
  SurveySettings,
  ExamSettings,
  QuestionSettings,
  ResponseMetadata,
} from '../types'
```

---

### Drizzle Config (`packages/db/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dbCredentials: {
    // Only used by drizzle-kit for remote D1 introspection/push.
    // Local dev uses wrangler d1 execute, not drizzle-kit push.
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
    token: process.env.CLOUDFLARE_D1_TOKEN ?? '',
  },
  verbose: true,
  strict: true,
})
```

Key notes:
- `drizzle-kit generate` reads the schema and emits SQL into `src/migrations/` — it does NOT apply the migration.
- `drizzle-kit push` is not used in this project; all migration application goes through `wrangler d1`.
- The `dbCredentials` block is only needed for remote D1 introspection. Local dev never touches it.

---

### D1 Client Factory (`packages/db/src/client.ts`)

```typescript
import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema/index'

export type AppDb = DrizzleD1Database<typeof schema>

/**
 * Creates a typed Drizzle client bound to a Cloudflare D1 database.
 *
 * Call this inside each Hono route handler (or in a global middleware)
 * by passing `c.env.QUIZ_DB` (the D1Database binding from wrangler.toml).
 *
 * @example
 *   app.use('*', async (c, next) => {
 *     c.set('db', createDb(c.env.QUIZ_DB))
 *     await next()
 *   })
 */
export function createDb(d1: D1Database): AppDb {
  return drizzle(d1, { schema })
}
```

The return type `AppDb` is exported and used throughout `apps/api` as the type for the `db` context variable. This ensures all query calls are fully type-checked against the schema.

The `schema` object passed to `drizzle()` enables the relational query API (`db.query.users.findMany(...)`) in addition to the standard query builder (`db.select().from(users)`).

---

### Migration Workflow

#### Local Development Flow

```
1.  Edit files in packages/db/src/schema/
2.  npm run db:generate
    → drizzle-kit reads schema, diffs against previous migration
    → emits packages/db/src/migrations/0001_<name>.sql
3.  npm run db:migrate:local
    → wrangler d1 execute QUIZ_DB --local --file=src/migrations/0001_<name>.sql
    → applies to .wrangler/state/v3/d1/miniflare-D1DatabaseObject/
4.  npm run db:studio
    → drizzle-kit studio --port 4983
    → opens http://localhost:4983 with visual table browser
```

#### Production Deployment Flow

```
1.  wrangler d1 create quiz-db   (first time only — saves database_id to wrangler.toml)
2.  npm run db:migrate:prod
    → wrangler d1 migrations apply QUIZ_DB
    → applies all unapplied migrations in src/migrations/ in order
3.  Verify by checking wrangler d1 info QUIZ_DB
```

**Staging first rule:** Always run `npm run db:migrate:staging` (pointing at a staging D1 instance) before production. Never apply raw SQL to production outside of the migration file workflow.

#### Migration File Naming Convention

Drizzle Kit generates files with a sequential prefix and a name derived from the schema diff:

```
src/migrations/
  0000_initial_schema.sql
  0001_add_questionnaire_share_token.sql
  0002_add_categories_table.sql
  meta/
    _journal.json        ← drizzle-kit migration ledger — never edit manually
    0000_snapshot.json
    0001_snapshot.json
```

Never rename migration files after they have been applied to any environment.

---

### npm Scripts (`packages/db/package.json`)

```json
{
  "scripts": {
    "db:generate":      "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 execute QUIZ_DB --local --file=$(ls src/migrations/*.sql | sort | tail -1)",
    "db:migrate:prod":  "wrangler d1 migrations apply QUIZ_DB",
    "db:studio":        "drizzle-kit studio --port 4983",
    "db:seed":          "wrangler d1 execute QUIZ_DB --local --file=src/seed.sql",
    "typecheck":        "tsc --noEmit"
  }
}
```

For convenience, the root `package.json` should forward these with workspace scope:

```json
{
  "scripts": {
    "db:generate":      "npm run db:generate -w packages/db",
    "db:migrate:local": "npm run db:migrate:local -w packages/db",
    "db:studio":        "npm run db:studio -w packages/db",
    "db:seed":          "npm run db:seed -w packages/db"
  }
}
```

---

### Seed Data (`packages/db/src/seed.ts` and `seed.sql`)

The seed script creates a realistic dataset for development and QA testing. It must be idempotent — running it twice should not create duplicates (use INSERT OR IGNORE or check existence first).

**Users (5 total):**

| username      | email                         | role  | password        |
|---------------|-------------------------------|-------|-----------------|
| admin_alice   | alice@questify.dev            | admin | `dev_password1` |
| admin_bob     | bob@questify.dev              | admin | `dev_password1` |
| user_charlie  | charlie@questify.dev          | user  | `dev_password1` |
| user_diana    | diana@questify.dev            | user  | `dev_password1` |
| user_evan     | evan@questify.dev             | user  | `dev_password1` |

**Categories (6 total):**

| name                | slug                | icon |
|---------------------|---------------------|------|
| Mathematics         | mathematics         | 📐   |
| Science             | science             | 🔬   |
| History             | history             | 📜   |
| Programming         | programming         | 💻   |
| Language & Grammar  | language-grammar    | 📝   |
| General Knowledge   | general-knowledge   | 🌍   |

**Questionnaires (3 total, all published + public):**

1. `sample-math-quiz` — type: quiz, category: mathematics, difficulty: medium, isScoreBased: true
   - 5 radio questions with 4 options each (1 correct per question)
   - 15 sample responses, each with random answers

2. `ux-research-survey` — type: survey, category: general-knowledge, isScoreBased: false
   - 4 questions: 2 radio, 1 checkbox, 1 textarea
   - 20 sample responses with varied answer patterns

3. `frontend-dev-exam` — type: exam, category: programming, difficulty: hard, isScoreBased: true
   - 2 sections: "JavaScript Fundamentals" (3 questions), "React Concepts" (3 questions)
   - All questions are radio type
   - 10 sample responses

**Seed SQL Structure:**

The `seed.sql` file uses plain SQL for maximum compatibility with `wrangler d1 execute`. The `seed.ts` TypeScript file uses the Drizzle client to insert the same data programmatically (useful for testing the client API itself). Both produce the same state.

```sql
-- seed.sql pattern
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, created_at, updated_at)
VALUES
  ('usr_alice', 'admin_alice', 'alice@questify.dev', '<bcrypt_hash>', 'admin', unixepoch('now') * 1000, unixepoch('now') * 1000),
  ...;

INSERT OR IGNORE INTO categories (id, name, slug, icon) VALUES
  ('cat_math', 'Mathematics', 'mathematics', '📐'),
  ...;
```

The `password_hash` values in seed.sql are pre-computed bcrypt hashes of `dev_password1`. Never store plaintext passwords even in seed files.

---

### D1 Database Binding (`apps/api/wrangler.toml`)

```toml
[[d1_databases]]
binding = "QUIZ_DB"
database_name = "quiz-db"
database_id = ""   # filled in after: wrangler d1 create quiz-db
migrations_dir = "../../packages/db/src/migrations"
```

The `migrations_dir` points to the shared migrations folder in `packages/db`, not to a local `apps/api` folder. This ensures that `wrangler d1 migrations apply` uses the same migration files generated by drizzle-kit.

---

### Directory Structure

```
packages/db/
  src/
    schema/
      users.ts                 ← users table definition + types
      questionnaires.ts        ← questionnaires table + JSON type annotations
      sections.ts              ← sections table
      questions.ts             ← questions table + QuestionSettings type
      question-options.ts      ← question_options table
      responses.ts             ← responses table + ResponseMetadata type
      answers.ts               ← answers table
      categories.ts            ← categories table
      index.ts                 ← barrel: re-exports all schema + types
    migrations/                ← generated by drizzle-kit generate (DO NOT EDIT)
      0000_initial_schema.sql
      meta/
        _journal.json
        0000_snapshot.json
    lib/
      json.ts                  ← helpers: parseJson<T>, stringifyJson<T>
    types.ts                   ← QuestionnaireSettings, QuestionSettings, ResponseMetadata
    client.ts                  ← createDb() factory, AppDb type alias
    seed.ts                    ← programmatic seed using Drizzle client
    seed.sql                   ← raw SQL seed for wrangler d1 execute
  drizzle.config.ts            ← dialect: sqlite, driver: d1-http, schema/out paths
  package.json                 ← db:generate, db:migrate:local, db:studio, db:seed scripts
  tsconfig.json                ← extends root tsconfig, strict: true
```

---

## Implementation Steps

### Ticket DB-01: Write Core Schema Files (users, questionnaires, sections, questions, question-options)

**Assign:** Sage (Backend)

Define the first five schema tables in `packages/db/src/schema/`. Each file follows the same pattern: import column constructors from `drizzle-orm/sqlite-core`, define the table with `sqliteTable`, define indexes in the third argument, and export both `$inferSelect` and `$inferInsert` types.

Deliverables:
- `packages/db/src/schema/users.ts`
- `packages/db/src/schema/questionnaires.ts`
- `packages/db/src/schema/sections.ts`
- `packages/db/src/schema/questions.ts`
- `packages/db/src/schema/question-options.ts`
- `packages/db/src/types.ts` (QuestionnaireSettings, QuestionSettings interfaces)

Acceptance: `tsc --noEmit` passes in `packages/db` with all five files present.

---

### Ticket DB-02: Write Remaining Schema Files + Barrel Export

**Assign:** Sage (Backend)

Complete the schema with the three remaining tables and wire up the barrel export.

Deliverables:
- `packages/db/src/schema/responses.ts`
- `packages/db/src/schema/answers.ts`
- `packages/db/src/schema/categories.ts`
- `packages/db/src/schema/index.ts` (re-exports all tables + all types)
- `packages/db/src/lib/json.ts` (parseJson, stringifyJson helpers)

Acceptance: `tsc --noEmit` passes. All 8 tables importable from `@quiz/db`.

---

### Ticket DB-03: Drizzle Config + Generate Initial Migration

**Assign:** Sage (Backend)

Configure drizzle-kit and generate the first migration file.

Deliverables:
- `packages/db/drizzle.config.ts` — complete config with sqlite dialect, d1-http driver
- `packages/db/package.json` — add `db:generate`, `db:studio`, `db:migrate:local`, `db:migrate:prod` scripts
- Run `npm run db:generate` — produces `src/migrations/0000_initial_schema.sql`
- Verify the SQL file contains all 8 `CREATE TABLE` statements and all index statements

Acceptance: `0000_initial_schema.sql` exists and contains correct DDL for all 8 tables.

---

### Ticket DB-04: Client Factory + D1 Wrangler Binding

**Assign:** Sage (Backend)

Implement the `createDb()` factory and register the D1 binding in the API wrangler config.

Deliverables:
- `packages/db/src/client.ts` — `createDb(d1: D1Database): AppDb` implementation
- `packages/db/src/index.ts` — package root export: re-exports `createDb`, `AppDb`, and everything from `schema/index.ts`
- `apps/api/wrangler.toml` — `[[d1_databases]]` binding with `binding = "QUIZ_DB"` and correct `migrations_dir`
- Run `npm run db:migrate:local` — applies migration to local D1 without errors
- Run `npm run db:studio` — Drizzle Studio opens and shows all 8 tables

Acceptance: Studio shows all tables. `npm run dev:api` starts without D1 binding errors.

---

### Ticket DB-05: Seed Data

**Assign:** Sage (Backend)

Create comprehensive development seed data.

Deliverables:
- `packages/db/src/seed.sql` — raw SQL with all seed inserts (INSERT OR IGNORE for idempotency)
- `packages/db/src/seed.ts` — TypeScript seed script using Drizzle client (for verifying client API)
- `packages/db/package.json` — add `db:seed` script
- 5 users (2 admin, 3 user) with known credentials
- 6 categories
- 3 questionnaires (quiz, survey, exam) with questions, options, and 10–20 sample responses each

Acceptance: `npm run db:seed` completes without SQL errors. Drizzle Studio shows populated data across all tables. `responses` table has at least 45 rows (15 + 20 + 10).

---

## Acceptance Criteria

- All 8 schema tables defined with correct Drizzle column types matching the specifications above
- `npm run db:generate` produces a valid `0000_initial_schema.sql` migration file
- `npm run db:migrate:local` applies the migration to local D1 without errors
- `npm run db:seed` populates all tables with development data; idempotent on re-run
- `createDb()` returns an `AppDb` value — `DrizzleD1Database<typeof schema>` — fully typed
- TypeScript strict mode: zero errors across `packages/db` (`tsc --noEmit` exits 0)
- `npm run db:studio` opens Drizzle Studio at `localhost:4983` with all 8 tables visible and populated
- All boolean columns use `integer` with `{ mode: 'boolean' }` (never bare integer or text)
- All timestamp columns use `integer` with `{ mode: 'timestamp_ms' }` (never text dates)
- No auto-increment integer primary keys — all IDs are nanoid/cuid2 strings

---

## Out of Scope

- API route handlers (PHASE-08)
- Authentication integration (PHASE-09)
- Business logic in the DB layer (no computed columns, triggers, or views)
- Full-text search configuration
- Production D1 database creation (requires Cloudflare account setup)

---

## Estimated Effort

**L** — Schema design requires careful thought about D1 constraints, JSON column patterns, and index strategy. The migration workflow requires hands-on Wrangler verification. Seed data volume is non-trivial.
