import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { TreeSidebar } from '@/components/tree/TreeSidebar'
import { GlobalSearch } from '@/components/GlobalSearch'
import { AIStatusLED } from '@/components/AIStatusLED'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Link to="/" className="font-display text-base font-semibold text-text">
          Knowledge Graph
        </Link>
        <div className="mx-4 max-w-md flex-1">
          <GlobalSearch />
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <AIStatusLED />
          <Link to="/present" className="hover:text-text">
            Present
          </Link>
          <Link to="/settings" className="hover:text-text">
            Settings
          </Link>
          {user?.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full border border-border"
            />
          )}
          <button onClick={handleSignOut} className="hover:text-text">
            Sign out
          </button>
        </nav>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <TreeSidebar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
