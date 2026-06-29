import { cn } from '../../lib/utils'

export interface CategoryTabsProps {
  tabs: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function CategoryTabs({ tabs, value, onValueChange, className }: CategoryTabsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onValueChange(tab.value)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
              : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
