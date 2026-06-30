import { createDb, schema } from '@quiz/db'
import { desc, eq } from 'drizzle-orm'
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
