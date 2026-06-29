import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

// Pass c.env.QUIZ_DB from a Hono handler to get a typed Drizzle client
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
export { schema }
