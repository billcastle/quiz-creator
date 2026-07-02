import { Outlet } from '@tanstack/react-router'

export function BuilderLayout() {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-base)]">
      <Outlet />
    </div>
  )
}
