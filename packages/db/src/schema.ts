import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

export const questionnaires = sqliteTable('questionnaires', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled Questionnaire'),
  status: text('status', { enum: ['draft', 'published', 'archived'] })
    .notNull()
    .default('draft'),
  visibility: text('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  timeLimitSeconds: integer('time_limit_seconds'),
  allowMultipleAttempts: integer('allow_multiple_attempts', { mode: 'boolean' })
    .notNull()
    .default(false),
  category: text('category'),
  shortId: text('short_id').unique(),
  slug: text('slug').default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  parentType: text('parent_type', { enum: ['questionnaire', 'survey'] }).notNull(),
  parentId: text('parent_id').notNull(),
  title: text('title').notNull().default(''),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  parentType: text('parent_type', { enum: ['questionnaire', 'survey'] }).notNull(),
  parentId: text('parent_id').notNull(),
  sectionId: text('section_id'),
  type: text('type', {
    enum: ['single_choice', 'multiple_choice', 'short_answer', 'long_answer'],
  }).notNull(),
  prompt: text('prompt').notNull().default(''),
  position: integer('position').notNull().default(0),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  showCorrectAnswer: integer('show_correct_answer', { mode: 'boolean' }).notNull().default(false),
  caseSensitive: integer('case_sensitive', { mode: 'boolean' }).notNull().default(false),
  acceptableAnswers: text('acceptable_answers'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const questionOptions = sqliteTable('question_options', {
  id: text('id').primaryKey(),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default(''),
  position: integer('position').notNull().default(0),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
})

export const surveys = sqliteTable('surveys', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled Survey'),
  status: text('status', { enum: ['draft', 'published', 'archived'] })
    .notNull()
    .default('draft'),
  visibility: text('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  allowMultipleAttempts: integer('allow_multiple_attempts', { mode: 'boolean' })
    .notNull()
    .default(false),
  category: text('category'),
  shortId: text('short_id').unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
