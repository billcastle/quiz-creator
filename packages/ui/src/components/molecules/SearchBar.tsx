import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  className?: string
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  className,
}: SearchBarProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-3 h-4 w-4 text-[var(--color-text-secondary)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-9 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
