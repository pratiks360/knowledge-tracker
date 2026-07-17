import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pkg-theme'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** Stored choice, else the OS preference, else dark. */
export function resolveInitialTheme(): Theme {
  const stored = readStored()
  if (stored) return stored
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: resolveInitialTheme(),
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    applyTheme(theme)
    set({ theme })
  },
}))

/** Sync the DOM attribute with the resolved theme before first paint. */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme)
}
