import { Button } from '@quiz/ui'
import { useNavigate } from '@tanstack/react-router'
import { stubSignIn } from '../lib/auth-stub'

export default function SignInPage() {
  const navigate = useNavigate()

  function handleSignIn() {
    stubSignIn()
    navigate({ to: '/' })
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Auth stub — real auth comes in QZ-0004
        </p>
      </div>
      <Button onClick={handleSignIn} className="w-full">
        Sign in (stub)
      </Button>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        No account?{' '}
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
