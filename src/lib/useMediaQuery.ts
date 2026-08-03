import { useSyncExternalStore } from 'react'

/** Reactive media-query match. SSR-safe (returns false on the server). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false
  )
}

/** True at Tailwind's `md` breakpoint and up. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
