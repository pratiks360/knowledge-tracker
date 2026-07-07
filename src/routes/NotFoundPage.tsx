import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg text-center">
      <h1 className="font-display text-xl text-text">Page not found</h1>
      <Link to="/" className="text-sm text-accent hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
