import { Copy, Pencil, Trash2 } from 'lucide-react'

export interface QuestionItemProps {
  index: number
  question: string
  answers: string[]
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export function QuestionItem({
  index,
  question,
  answers,
  onEdit,
  onDuplicate,
  onDelete,
}: QuestionItemProps) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <div className="mb-2 flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-sm font-semibold text-[var(--color-text-secondary)]">
          {index}.
        </span>
        <p className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">{question}</p>
      </div>
      <ul className="mb-3 ml-6 space-y-1">
        {answers.map((answer) => (
          <li key={answer} className="text-xs text-[var(--color-text-secondary)]">
            • {answer}
          </li>
        ))}
      </ul>
      <div className="ml-6 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <Copy className="h-3 w-3" /> Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)]"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  )
}
