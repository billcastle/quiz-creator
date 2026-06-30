export const AUTH_STUB_KEY = 'questify-auth-stub'

export function isAuthenticatedStub(): boolean {
  return localStorage.getItem(AUTH_STUB_KEY) === 'true'
}

export function stubSignIn(): void {
  localStorage.setItem(AUTH_STUB_KEY, 'true')
}

export function stubSignOut(): void {
  localStorage.removeItem(AUTH_STUB_KEY)
}
