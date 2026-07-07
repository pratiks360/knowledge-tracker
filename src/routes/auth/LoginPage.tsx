import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(
    searchParams.get('error') ? 'Sign-in failed. Please try again.' : null
  )
  const location = useLocation()
  void location

  const handleSignIn = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setError('Could not start sign-in. Please try again.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-text">Knowledge Graph</h1>
        <p className="text-sm text-muted">Your personal learning dashboard</p>
      </div>

      <button
        onClick={handleSignIn}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-text transition hover:bg-surface-hover"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        Continue with Google
      </button>

      {error && <p className="text-sm text-error">{error}</p>}

      <p className="max-w-xs text-center text-xs text-muted">
        This is a private, single-user app. Only the owner&apos;s Google account can sign in.
      </p>
    </div>
  )
}
