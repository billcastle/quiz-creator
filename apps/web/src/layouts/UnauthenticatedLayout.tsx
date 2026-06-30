import { Outlet } from '@tanstack/react-router'

export function UnauthenticatedLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)]">
      <Outlet />
    </div>
  )
}
