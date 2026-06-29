import { Badge } from '../ui/badge'

export interface AnswerReviewRowProps {
  question: string
  state: 'correct' | 'incorrect' | 'skipped'
}

const stateVariant = {
  correct: 'default',
  incorrect: 'destructive',
  skipped: 'secondary',
} as const

const stateLabel = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  skipped: 'Skipped',
}

export function AnswerReviewRow({ question, state }: AnswerReviewRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <p className="flex-1 text-sm text-[var(--color-text-primary)]">{question}</p>
      <Badge variant={stateVariant[state]}>{stateLabel[state]}</Badge>
    </div>
  )
}
