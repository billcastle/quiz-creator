import { Badge } from '../ui/badge'

export interface QuestionnaireCardProps {
  title: string
  type: 'quiz' | 'survey' | 'exam'
  takeCount: number
  thumbnailUrl?: string
}

export function QuestionnaireCard({
  title,
  type,
  takeCount,
  thumbnailUrl,
}: QuestionnaireCardProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-shadow hover:shadow-md">
      <div className="h-32 overflow-hidden bg-[var(--color-bg-subtle)]">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-text-disabled)]">
            <span className="text-4xl">📋</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Badge variant={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>
        <p className="line-clamp-2 text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-auto text-xs text-[var(--color-text-secondary)]">
          {takeCount.toLocaleString()} takes
        </p>
      </div>
    </div>
  )
}
