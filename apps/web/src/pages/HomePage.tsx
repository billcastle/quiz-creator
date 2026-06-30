import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@quiz/ui'
import { useNavigate } from '@tanstack/react-router'
import { FilePlus2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ContentItem, Questionnaire, Survey } from '../types/content'

type Filter = 'all' | 'questionnaires' | 'surveys'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

function formatDate(ts: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ts))
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="mb-3 flex gap-2">
        <div className="h-5 w-24 rounded-full bg-[var(--color-bg-subtle)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--color-bg-subtle)]" />
      </div>
      <div className="mb-2 h-5 w-3/4 rounded bg-[var(--color-bg-subtle)]" />
      <div className="h-4 w-1/3 rounded bg-[var(--color-bg-subtle)]" />
    </div>
  )
}

function EmptyState({ filter }: { filter: Filter }) {
  const headline =
    filter === 'surveys'
      ? 'No surveys yet'
      : filter === 'questionnaires'
        ? 'No questionnaires yet'
        : 'Nothing here yet'

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <FilePlus2 size={48} className="mb-4 text-[var(--color-text-disabled)]" strokeWidth={1.25} />
      <h2 className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">{headline}</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Use the sidebar to create your first one.
      </p>
    </div>
  )
}

function ContentCard({
  item,
  onDelete,
}: {
  item: ContentItem
  onDelete: (id: string, kind: ContentItem['kind']) => void
}) {
  const navigate = useNavigate()
  const editRoute =
    item.kind === 'questionnaire' ? `/quiz/${item.id}/edit` : `/survey/${item.id}/edit`

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap gap-2">
        {item.kind === 'questionnaire' ? (
          <Badge variant="quiz">Questionnaire</Badge>
        ) : (
          <Badge variant="survey">Survey</Badge>
        )}
        <Badge variant="secondary">{STATUS_LABELS[item.status] ?? item.status}</Badge>
      </div>
      <p className="flex-1 truncate text-base font-medium text-[var(--color-text-primary)]">
        {item.title || 'Untitled'}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {formatDate(item.createdAt)}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => navigate({ to: editRoute })}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id, item.kind)}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-500"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    kind: ContentItem['kind']
  } | null>(null)

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id, kind } = pendingDelete
    setPendingDelete(null)
    if (kind === 'questionnaire') {
      setQuestionnaires((prev) => prev.filter((q) => q.id !== id))
      await api.del(`/api/questionnaires/${id}`)
    } else {
      setSurveys((prev) => prev.filter((s) => s.id !== id))
      await api.del(`/api/surveys/${id}`)
    }
  }

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
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const visibleItems =
    filter === 'questionnaires'
      ? allItems.filter((i) => i.kind === 'questionnaire')
      : filter === 'surveys'
        ? allItems.filter((i) => i.kind === 'survey')
        : allItems

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
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
        <EmptyState filter={filter} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onDelete={(id, kind) => setPendingDelete({ id, kind })}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
