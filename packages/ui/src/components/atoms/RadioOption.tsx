import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '../../lib/utils'

type RadioOptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled'

const stateStyles: Record<RadioOptionState, string> = {
  default: 'border-[var(--color-border)] bg-[var(--color-bg-surface)]',
  selected:
    'border-[var(--color-accent)] bg-[var(--color-bg-surface)] ring-2 ring-[var(--color-accent)]',
  correct: 'border-[var(--color-success)] bg-[var(--color-bg-surface)]',
  incorrect: 'border-[var(--color-destructive)] bg-[var(--color-bg-surface)]',
  disabled: 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] opacity-50',
}

export interface RadioOptionProps {
  value: string
  label: string
  state?: RadioOptionState
}

export function RadioOption({ value, label, state = 'default' }: RadioOptionProps) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      disabled={state === 'disabled'}
      aria-label={label}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed',
        stateStyles[state]
      )}
    >
      <span className="aspect-square h-4 w-4 shrink-0 rounded-full border border-[var(--color-border)] data-[state=checked]:border-[var(--color-accent)] flex items-center justify-center">
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className="block h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
        </RadioGroupPrimitive.Indicator>
      </span>
      <span>{label}</span>
    </RadioGroupPrimitive.Item>
  )
}
