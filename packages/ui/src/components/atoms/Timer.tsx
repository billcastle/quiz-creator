import { cn } from '../../lib/utils'

export interface TimerProps {
  seconds: number
  state?: 'default' | 'warning' | 'danger'
  className?: string
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

const stateColor = {
  default: 'text-[var(--color-text-primary)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-destructive)]',
}

export function Timer({ seconds, state = 'default', className }: TimerProps) {
  return (
    <span
      className={cn('font-mono text-sm font-semibold tabular-nums', stateColor[state], className)}
    >
      {formatTime(seconds)}
    </span>
  )
}
