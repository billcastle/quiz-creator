import { createDb, schema } from '@quiz/db'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './lib/auth'

// Cloudflare Workers bindings — extend as new bindings are added
type Bindings = {
  QUIZ_DB: D1Database
  QUIZ_KV: KVNamespace
  CORS_ORIGIN: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', (c, next) => cors({ origin: c.env.CORS_ORIGIN, credentials: true })(c, next))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.all('/api/auth/**', (c) => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

// ── Questionnaire list ────────────────────────────────────────────────────────

app.get('/api/questionnaires', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const rows = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.creatorId, session.user.id))
    .orderBy(desc(schema.questionnaires.createdAt))

  return c.json({ questionnaires: rows })
})

// ── Questionnaire CRUD ────────────────────────────────────────────────────────

app.post('/api/questionnaires', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const body: { title?: string } = await c.req.json<{ title?: string }>().catch(() => ({}))
  const db = createDb(c.env.QUIZ_DB)
  const now = new Date()
  const id = crypto.randomUUID()

  await db.insert(schema.questionnaires).values({
    id,
    creatorId: session.user.id,
    title: body.title ?? 'Untitled Questionnaire',
    status: 'draft',
    visibility: 'private',
    allowMultipleAttempts: false,
    createdAt: now,
    updatedAt: now,
  })

  const [row] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, id))

  return c.json({ questionnaire: row }, 201)
})

app.get('/api/questionnaires/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [q] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, c.req.param('id')))

  if (!q || q.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const questionRows = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.parentId, q.id))
    .orderBy(asc(schema.questions.position))

  const allOptions = await Promise.all(
    questionRows.map((qr) =>
      db
        .select()
        .from(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, qr.id))
        .orderBy(asc(schema.questionOptions.position))
    )
  )

  const questions = questionRows.map((qr, i) => ({ ...qr, options: allOptions[i] }))

  return c.json({ questionnaire: { ...q, questions } })
})

app.put('/api/questionnaires/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [q] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, c.req.param('id')))

  if (!q || q.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json<{
    title?: string
    status?: 'draft' | 'published' | 'archived'
    visibility?: 'public' | 'private'
    timeLimitSeconds?: number | null
    allowMultipleAttempts?: boolean
  }>()

  await db
    .update(schema.questionnaires)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.visibility !== undefined && { visibility: body.visibility }),
      ...(body.timeLimitSeconds !== undefined && { timeLimitSeconds: body.timeLimitSeconds }),
      ...(body.allowMultipleAttempts !== undefined && {
        allowMultipleAttempts: body.allowMultipleAttempts,
      }),
      updatedAt: new Date(),
    })
    .where(eq(schema.questionnaires.id, q.id))

  const [updated] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, q.id))

  return c.json({ questionnaire: updated })
})

app.delete('/api/questionnaires/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [q] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, c.req.param('id')))

  if (!q || q.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  await db.delete(schema.questionnaires).where(eq(schema.questionnaires.id, q.id))

  return new Response(null, { status: 204 })
})

// ── Question CRUD ─────────────────────────────────────────────────────────────

app.post('/api/questionnaires/:id/questions', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [q] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, c.req.param('id')))

  if (!q || q.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json<{
    type: 'single_choice' | 'multiple_choice' | 'short_answer' | 'long_answer'
    prompt?: string
    sectionId?: string
    position?: number
  }>()

  const existing = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.parentId, q.id))

  const position = body.position ?? existing.length
  const now = new Date()
  const id = crypto.randomUUID()

  await db.insert(schema.questions).values({
    id,
    parentType: 'questionnaire',
    parentId: q.id,
    sectionId: body.sectionId ?? null,
    type: body.type,
    prompt: body.prompt ?? '',
    position,
    required: true,
    showCorrectAnswer: false,
    caseSensitive: false,
    acceptableAnswers: null,
    createdAt: now,
    updatedAt: now,
  })

  const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, id))

  return c.json({ question: { ...row, options: [] } }, 201)
})

app.put('/api/questions/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [question] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, c.req.param('id')))

  if (!question) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  // Verify ownership via parent questionnaire
  const [parent] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, question.parentId))

  if (!parent || parent.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json<{
    prompt?: string
    required?: boolean
    showCorrectAnswer?: boolean
    caseSensitive?: boolean
    acceptableAnswers?: string[] | null
  }>()

  await db
    .update(schema.questions)
    .set({
      ...(body.prompt !== undefined && { prompt: body.prompt }),
      ...(body.required !== undefined && { required: body.required }),
      ...(body.showCorrectAnswer !== undefined && { showCorrectAnswer: body.showCorrectAnswer }),
      ...(body.caseSensitive !== undefined && { caseSensitive: body.caseSensitive }),
      ...(body.acceptableAnswers !== undefined && {
        acceptableAnswers:
          body.acceptableAnswers !== null ? JSON.stringify(body.acceptableAnswers) : null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(schema.questions.id, question.id))

  const [updated] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, question.id))

  return c.json({ question: updated })
})

app.delete('/api/questions/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [question] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, c.req.param('id')))

  if (!question) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [parent] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, question.parentId))

  if (!parent || parent.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  await db.delete(schema.questions).where(eq(schema.questions.id, question.id))

  return new Response(null, { status: 204 })
})

app.put('/api/questionnaires/:id/questions/reorder', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [q] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, c.req.param('id')))

  if (!q || q.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const { order } = await c.req.json<{ order: string[] }>()

  await Promise.all(
    order.map((questionId, index) =>
      db
        .update(schema.questions)
        .set({ position: index, updatedAt: new Date() })
        .where(eq(schema.questions.id, questionId))
    )
  )

  return c.json({ ok: true })
})

// ── Question options ──────────────────────────────────────────────────────────

app.post('/api/questions/:id/options', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [question] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, c.req.param('id')))

  if (!question) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [parent] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, question.parentId))

  if (!parent || parent.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const body: { label?: string; isCorrect?: boolean } = await c.req
    .json<{ label?: string; isCorrect?: boolean }>()
    .catch(() => ({}))

  const existing = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.questionId, question.id))

  const id = crypto.randomUUID()

  await db.insert(schema.questionOptions).values({
    id,
    questionId: question.id,
    label: body.label ?? '',
    position: existing.length,
    isCorrect: body.isCorrect ?? false,
  })

  const [row] = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.id, id))

  return c.json({ option: row }, 201)
})

app.put('/api/question-options/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [option] = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.id, c.req.param('id')))

  if (!option) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [question] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, option.questionId))

  if (!question) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [parent] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, question.parentId))

  if (!parent || parent.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json<{ label?: string; isCorrect?: boolean }>()

  await db
    .update(schema.questionOptions)
    .set({
      ...(body.label !== undefined && { label: body.label }),
      ...(body.isCorrect !== undefined && { isCorrect: body.isCorrect }),
    })
    .where(eq(schema.questionOptions.id, option.id))

  const [updated] = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.id, option.id))

  return c.json({ option: updated })
})

app.delete('/api/question-options/:id', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const [option] = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.id, c.req.param('id')))

  if (!option) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [question] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, option.questionId))

  if (!question) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)

  const [parent] = await db
    .select()
    .from(schema.questionnaires)
    .where(eq(schema.questionnaires.id, question.parentId))

  if (!parent || parent.creatorId !== session.user.id) {
    return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  await db.delete(schema.questionOptions).where(eq(schema.questionOptions.id, option.id))

  return new Response(null, { status: 204 })
})

// ── Surveys list ──────────────────────────────────────────────────────────────

app.get('/api/surveys', async (c) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)

  const db = createDb(c.env.QUIZ_DB)
  const rows = await db
    .select()
    .from(schema.surveys)
    .where(eq(schema.surveys.creatorId, session.user.id))
    .orderBy(desc(schema.surveys.createdAt))

  return c.json({ surveys: rows })
})

export default app
