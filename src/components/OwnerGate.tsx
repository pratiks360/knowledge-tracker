import { useAuth } from '@/lib/auth-context'

export function OwnerGate() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <h1 className="font-display text-xl text-text">This is a private app</h1>
      <p className="max-w-sm text-sm text-muted">
        {user?.email} isn&apos;t authorized to use this instance. Only the owner&apos;s Google
        account can sign in.
      </p>
      <button
        onClick={() => signOut()}
        className="mt-2 rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-hover"
      >
        Sign out
      </button>
    </div>
  )
}
