import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Cloudflare Workers bindings — extend as new bindings are added
type Bindings = {
  QUIZ_DB: D1Database
  QUIZ_KV: KVNamespace
  CORS_ORIGIN: string
  BETTER_AUTH_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', (c, next) => cors({ origin: c.env.CORS_ORIGIN })(c, next))

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
