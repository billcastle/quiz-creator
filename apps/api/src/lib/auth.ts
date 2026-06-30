import { createDb } from '@quiz/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

type Env = {
  QUIZ_DB: D1Database
  QUIZ_KV: KVNamespace
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  CORS_ORIGIN: string
}

export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.QUIZ_DB), { provider: 'sqlite' }),
    secondaryStorage: {
      get: (key) => env.QUIZ_KV.get(key),
      set: (key, value, ttl) =>
        env.QUIZ_KV.put(key, value, ttl ? { expirationTtl: ttl } : undefined),
      delete: (key) => env.QUIZ_KV.delete(key),
    },
    emailAndPassword: { enabled: true },
    trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL],
  })
}
