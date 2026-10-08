import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { TreeSidebar } from '@/components/tree/TreeSidebar'
import { GlobalSearch } from '@/components/GlobalSearch'
import { AIStatusLED } from '@/components/AIStatusLED'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useUIStore } from '@/lib/store'

/** Primary destinations. Settings sits in the same group so the current page is always lit. */
const NAV_ITEMS = [
  { to: '/graph', label: 'Graph', hideOnMobile: true },
  { to: '/stats', label: 'Stats', hideOnMobile: true },
  { to: '/present', label: 'Present', hideOnMobile: true },
  { to: '/settings', label: 'Settings', hideOnMobile: false },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-2.5 py-1.5 text-sm font-medium ' +
  (isActive
    ? 'bg-accent-soft text-text'
    : 'text-muted hover:bg-surface-hover hover:text-text')

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
      {/* First tab stop: lets keyboard users jump past the header and tree. */}
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <header
        className="relative z-30 shrink-0 border-b border-border backdrop-blur-md"
        style={{ background: 'var(--header-bg)' }}
      >
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

          <Link
            to="/"
            className="font-display flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-text"
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-bg shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="2.4" />
                <circle cx="18" cy="8" r="2.4" />
                <circle cx="12" cy="18" r="2.4" />
                <path d="M7.8 7.2l8.4.4M7.4 8l3.4 8M16.6 10l-3.6 6.2" />
              </svg>
            </span>
            <span className="hidden sm:inline">Knowledge Graph</span>
            <span className="sr-only sm:hidden">Knowledge Graph</span>
          </Link>

          {/* Search gets the full width of its own row on mobile, where sharing the
              bar with the nav left it a few characters wide. */}
          <div className="mx-2 hidden max-w-md flex-1 md:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 md:hidden" />

          <nav aria-label="Primary" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <ThemeToggle />
            <AIStatusLED />
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={(state) =>
                  navLinkClass(state) + (item.hideOnMobile ? ' hidden sm:inline-block' : '')
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="ml-1 hidden h-7 w-7 rounded-full border border-border sm:block"
              />
            )}
            <button
              onClick={handleSignOut}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface-hover hover:text-text"
            >
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

        <div id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
