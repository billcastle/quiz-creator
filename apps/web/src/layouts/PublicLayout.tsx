import { TopNav } from '@quiz/ui'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'

export function PublicLayout() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setIsAuthenticated(!!data)
    })
  }, [])

  async function handleSignOut() {
    await authClient.signOut()
    setIsAuthenticated(false)
    navigate({ to: '/sign-in' })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-base)]">
      <TopNav
        isAuthenticated={isAuthenticated}
        onLogoClick={() => navigate({ to: '/' })}
        onSignIn={() => navigate({ to: '/sign-in' })}
        onSignUp={() => navigate({ to: '/sign-up' })}
        onProfile={() => navigate({ to: '/' })}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
