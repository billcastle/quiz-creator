import type * as React from 'react'
import { ProgressRing } from '../atoms/ProgressRing'

export interface ScoreCircleProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score < 50) return 'var(--color-destructive)'
  if (score < 80) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export function ScoreCircle({ score }: ScoreCircleProps) {
  const color = getScoreColor(score)
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ '--color-accent': color } as React.CSSProperties}>
        <ProgressRing value={score} size="lg" />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)]">Score</span>
    </div>
  )
}
