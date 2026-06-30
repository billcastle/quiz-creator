import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AnswerOptionProps {
  type: 'checkbox' | 'radio'
  value: string
  onChange?: (value: string) => void
  onRemove?: () => void
}

export function AnswerOption({ type, value, onChange, onRemove }: AnswerOptionProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
      <span className="shrink-0 text-[var(--color-text-disabled)]">
        {type === 'checkbox' ? (
          <span className="inline-block h-4 w-4 rounded-sm border-2 border-current" />
        ) : (
          <span className="inline-block h-4 w-4 rounded-full border-2 border-current" />
        )}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Answer text…"
        className={cn(
          'flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none'
        )}
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[var(--color-text-disabled)] hover:text-[var(--color-destructive)]"
          aria-label="Remove option"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
