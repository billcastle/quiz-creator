import { z } from 'zod'

// Placeholder — schemas shared by apps/web and apps/api
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
