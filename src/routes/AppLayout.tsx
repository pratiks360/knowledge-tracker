import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { TreeSidebar } from '@/components/tree/TreeSidebar'
import { GlobalSearch } from '@/components/GlobalSearch'
import { AIStatusLED } from '@/components/AIStatusLED'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useUIStore } from '@/lib/store'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { mobileNavOpen, setMobileNavOpen, sidebarCollapsed, sidebarWidth, setSidebarWidth } =
    useUIStore()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Picking a topic in the drawer should get you to it, not leave the drawer
  // covering the page you just navigated to.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="shrink-0 border-b border-border">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle topics"
            aria-expanded={mobileNavOpen}
            className="-ml-1 rounded p-1.5 text-muted transition hover:bg-surface-hover hover:text-text md:hidden"
          >
            {/* Inline SVG rather than a glyph so it sits on the baseline predictably. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link to="/" className="font-display shrink-0 text-base font-semibold text-text">
            <span className="hidden sm:inline">Knowledge Graph</span>
            <span className="sm:hidden">KG</span>
          </Link>

          {/* Search gets the full width of its own row on mobile, where sharing the
              bar with the nav left it a few characters wide. */}
          <div className="mx-2 hidden max-w-md flex-1 md:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 md:hidden" />

          <nav className="flex shrink-0 items-center gap-2 text-sm text-muted sm:gap-4">
            <ThemeToggle />
            <AIStatusLED />
            <Link to="/present" className="hidden transition hover:text-text sm:inline">
              Present
            </Link>
            <Link to="/settings" className="transition hover:text-text">
              Settings
            </Link>
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="hidden h-7 w-7 rounded-full border border-border sm:block"
              />
            )}
            <button onClick={handleSignOut} className="transition hover:text-text">
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Out</span>
            </button>
          </nav>
        </div>

        <div className="px-3 pb-2 md:hidden">
          <GlobalSearch />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Docked tree — desktop only. */}
        <div className="hidden md:flex">
          <TreeSidebar />
        </div>
        {/* Drag handle between the tree and the main column (hidden when collapsed). */}
        {!sidebarCollapsed && (
          <div className="hidden md:flex">
            <ResizeHandle
              side="right"
              ariaLabel="Resize topics sidebar"
              getWidth={() => sidebarWidth}
              onResize={setSidebarWidth}
            />
          </div>
        )}

        {/* Off-canvas tree — mobile only. */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="relative flex h-full bg-bg shadow-xl">
              <TreeSidebar variant="drawer" />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
