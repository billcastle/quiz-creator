import { Button, Input } from '@quiz/ui'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'

export default function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setPending(true)
    const { error: authError } = await authClient.signIn.email({ email, password })
    setPending(false)

    if (authError) {
      setError(authError.message ?? 'Sign in failed.')
      return
    }

    navigate({ to: '/' })
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Welcome back — enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-[var(--color-text-primary)]">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={pending}
          />
        </div>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => navigate({ to: '/sign-up' })}
          className="text-[var(--color-accent)] hover:underline"
        >
          Sign up
        </button>
      </p>
    </div>
  )
}
