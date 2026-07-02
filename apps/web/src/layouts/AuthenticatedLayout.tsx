import { SideNav, TopNav } from '@quiz/ui'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'

export function AuthenticatedLayout() {
  const navigate = useNavigate()
  const { location } = useRouterState()
  const [sideNavOpen, setSideNavOpen] = useState(false)
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  function handleCollapse(v: boolean) {
    setSideCollapsed(v)
    localStorage.setItem('sidebar-collapsed', String(v))
  }

  async function handleSignOut() {
    await authClient.signOut()
    navigate({ to: '/sign-in' })
  }

  function handleNavigate(path: string) {
    navigate({ to: path as never })
    setSideNavOpen(false)
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-base)]">
      <TopNav
        isAuthenticated
        onLogoClick={() => navigate({ to: '/' })}
        onProfile={() => navigate({ to: '/' })}
        onSignOut={handleSignOut}
        onHamburgerClick={() => setSideNavOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <SideNav
            activePath={location.pathname}
            onNavigate={handleNavigate}
            onCreateQuiz={() => navigate({ to: '/quiz/new' })}
            onCreateSurvey={() => navigate({ to: '/survey/new' })}
            collapsed={sideCollapsed}
            onCollapsedChange={handleCollapse}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {sideNavOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-0 z-40 lg:hidden"
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default bg-black/50"
              onClick={() => setSideNavOpen(false)}
              aria-label="Close navigation menu"
              tabIndex={-1}
            />
            <div className="absolute left-0 top-0 z-10 h-full">
              <SideNav
                activePath={location.pathname}
                onNavigate={handleNavigate}
                onCreateQuiz={() => {
                  navigate({ to: '/quiz/new' })
                  setSideNavOpen(false)
                }}
                onCreateSurvey={() => {
                  navigate({ to: '/survey/new' })
                  setSideNavOpen(false)
                }}
              />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
