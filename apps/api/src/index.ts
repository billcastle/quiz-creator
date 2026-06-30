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

export default app
