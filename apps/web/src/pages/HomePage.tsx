import { Badge, Button, Tabs, TabsList, TabsTrigger } from '@quiz/ui'
import { useNavigate } from '@tanstack/react-router'
import { FilePlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ContentItem, Questionnaire, Survey } from '../types/content'

type Filter = 'all' | 'questionnaires' | 'surveys'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ts * 1000))
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="mb-3 flex gap-2">
        <div className="h-5 w-24 rounded-full bg-[var(--color-bg-subtle)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--color-bg-subtle)]" />
      </div>
      <div className="mb-2 h-5 w-3/4 rounded bg-[var(--color-bg-subtle)]" />
      <div className="h-4 w-1/3 rounded bg-[var(--color-bg-subtle)]" />
    </div>
  )
}

function EmptyState({ filter, onNew }: { filter: Filter; onNew: () => void }) {
  const headline =
    filter === 'surveys'
      ? 'No surveys yet'
      : filter === 'questionnaires'
        ? 'No questionnaires yet'
        : 'No content yet'

  const ctaLabel = filter === 'surveys' ? '+ New Survey' : '+ New Questionnaire'

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FilePlus2 size={48} className="mb-4 text-[var(--color-text-disabled)]" strokeWidth={1.25} />
      <h2 className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">{headline}</h2>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Create your first one to get started.
      </p>
      <Button onClick={onNew}>{ctaLabel}</Button>
    </div>
  )
}

function ContentCard({ item }: { item: ContentItem }) {
  const navigate = useNavigate()
  const editRoute =
    item.kind === 'questionnaire' ? `/quiz/${item.id}/edit` : `/survey/${item.id}/edit`

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap gap-2">
        {item.kind === 'questionnaire' ? (
          <Badge variant="quiz">Questionnaire</Badge>
        ) : (
          <Badge variant="survey">Survey</Badge>
        )}
        <Badge variant="secondary">{STATUS_LABELS[item.status] ?? item.status}</Badge>
      </div>
      <p className="truncate text-base font-medium text-[var(--color-text-primary)]">
        {item.title}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {formatDate(item.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => navigate({ to: editRoute })}
          className="text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          Edit
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    Promise.all([
      api.get<{ questionnaires: Questionnaire[] }>('/api/questionnaires'),
      api.get<{ surveys: Survey[] }>('/api/surveys'),
    ])
      .then(([q, s]) => {
        setQuestionnaires(q.questionnaires)
        setSurveys(s.surveys)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const allItems: ContentItem[] = [
    ...questionnaires.map((q) => ({ kind: 'questionnaire' as const, ...q })),
    ...surveys.map((s) => ({ kind: 'survey' as const, ...s })),
  ].sort((a, b) => b.createdAt - a.createdAt)

  const visibleItems =
    filter === 'questionnaires'
      ? allItems.filter((i) => i.kind === 'questionnaire')
      : filter === 'surveys'
        ? allItems.filter((i) => i.kind === 'survey')
        : allItems

  const defaultNewRoute = filter === 'surveys' ? '/survey/new' : '/quiz/new'

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">My Content</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/survey/new' })}>
            + New Survey
          </Button>
          <Button size="sm" onClick={() => navigate({ to: '/quiz/new' })}>
            + New Questionnaire
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="questionnaires">Questionnaires</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState filter={filter} onNew={() => navigate({ to: defaultNewRoute })} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
