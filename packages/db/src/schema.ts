import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Placeholder — full schema defined in Phase 01+ tickets
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
