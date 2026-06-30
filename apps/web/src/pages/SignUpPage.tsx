import { Button, Input } from '@quiz/ui'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'

export default function SignUpPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    const { error: authError } = await authClient.signUp.email({ email, password, name: email })
    setPending(false)

    if (authError) {
      setError(authError.message ?? 'Sign up failed.')
      return
    }

    navigate({ to: '/' })
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Get started by creating your account.
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirm-password"
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            Confirm password
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            disabled={pending}
          />
        </div>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => navigate({ to: '/sign-in' })}
          className="text-[var(--color-accent)] hover:underline"
        >
          Sign in
        </button>
      </p>
    </div>
  )
}
