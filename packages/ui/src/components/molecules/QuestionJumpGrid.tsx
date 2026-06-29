import { cn } from '../../lib/utils'

type QuestionState = 'answered' | 'flagged' | 'current' | 'unanswered'

const stateStyles: Record<QuestionState, string> = {
  answered: 'bg-[var(--color-success)] text-white border-transparent',
  flagged: 'bg-[var(--color-warning)] text-white border-transparent',
  current:
    'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent ring-2 ring-[var(--color-accent)]',
  unanswered:
    'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]',
}

export interface QuestionJumpGridProps {
  questions: { index: number; state: QuestionState }[]
  onJump?: (index: number) => void
}

export function QuestionJumpGrid({ questions, onJump }: QuestionJumpGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map(({ index, state }) => (
        <button
          key={index}
          type="button"
          onClick={() => onJump?.(index)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
            stateStyles[state]
          )}
        >
          {index + 1}
        </button>
      ))}
    </div>
  )
}
