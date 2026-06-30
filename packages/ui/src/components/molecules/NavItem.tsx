import type * as React from 'react'
import { cn } from '../../lib/utils'

export interface NavItemProps {
  icon: React.ReactNode
  label: string
  state?: 'default' | 'active' | 'collapsed'
  onClick?: () => void
}

export function NavItem({ icon, label, state = 'default', onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors',
        state === 'collapsed' ? 'justify-center px-2' : 'gap-3 px-3',
        state === 'active'
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
      )}
    >
      <span className="shrink-0">{icon}</span>
      {state !== 'collapsed' && <span>{label}</span>}
    </button>
  )
}
