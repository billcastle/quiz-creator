import { ThemeToggle } from '@quiz/ui'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'

export function TakeLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-base)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-2"
        >
          <LayoutGrid className="h-5 w-5 text-[var(--color-accent)]" />
          <span className="font-bold text-[var(--color-text-primary)]">Questify</span>
        </button>
        <ThemeToggle />
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
