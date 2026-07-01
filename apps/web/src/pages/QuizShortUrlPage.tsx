import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { api } from '../lib/api'

export default function QuizShortUrlPage() {
  const { shortId } = useParams({ strict: false }) as { shortId: string }
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ shortId: string | null; slug: string | null }>(`/api/q/${shortId}`)
      .then(({ shortId: sid, slug }) => {
        if (sid && slug) {
          navigate({ to: '/quiz/$shortId/$slug', params: { shortId: sid, slug }, replace: true })
        } else {
          navigate({ to: '/', replace: true })
        }
      })
      .catch(() => navigate({ to: '/', replace: true }))
  }, [shortId, navigate])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
    </div>
  )
}
