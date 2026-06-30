import { Progress } from '../ui/progress'

export interface SectionBreakdownProps {
  sections: { name: string; score: number; total: number }[]
}

export function SectionBreakdown({ sections }: SectionBreakdownProps) {
  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const pct = Math.round((section.score / section.total) * 100)
        return (
          <div key={section.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-primary)]">{section.name}</span>
              <span className="text-[var(--color-text-secondary)]">
                {section.score}/{section.total}
              </span>
            </div>
            <Progress value={pct} />
          </div>
        )
      })}
    </div>
  )
}
