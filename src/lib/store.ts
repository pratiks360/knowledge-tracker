import { create } from 'zustand'

// Panel widths persist across sessions so the user's layout sticks.
export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 560
export const CHAT_MIN = 260
export const CHAT_MAX = 680

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function readWidth(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback
  const v = Number(window.localStorage.getItem(key))
  return Number.isFinite(v) && v > 0 ? clamp(v, min, max) : fallback
}

function persist(key: string, value: number) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, String(value))
}

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Mobile only: the tree is an off-canvas drawer below `md`, closed by default. */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  chatPanelOpen: boolean
  toggleChatPanel: () => void
  /** Draggable panel widths (desktop). Persisted to localStorage. */
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
  chatWidth: number
  setChatWidth: (w: number) => void
  /** Tree rows are collapsed unless their id is in here. */
  expandedNodeIds: Set<string>
  toggleNodeExpanded: (id: string) => void
  expandNodes: (ids: string[]) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  sidebarWidth: readWidth('kg.sidebarWidth', 256, SIDEBAR_MIN, SIDEBAR_MAX),
  setSidebarWidth: (w) => {
    const width = clamp(w, SIDEBAR_MIN, SIDEBAR_MAX)
    persist('kg.sidebarWidth', width)
    set({ sidebarWidth: width })
  },
  chatWidth: readWidth('kg.chatWidth', 320, CHAT_MIN, CHAT_MAX),
  setChatWidth: (w) => {
    const width = clamp(w, CHAT_MIN, CHAT_MAX)
    persist('kg.chatWidth', width)
    set({ chatWidth: width })
  },
  // Open by default where it docks beside the topic, closed where it would cover
  // it — below md the panel is a full-screen sheet.
  chatPanelOpen:
    typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches,
  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
  expandedNodeIds: new Set<string>(),
  toggleNodeExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedNodeIds: next }
    }),
  expandNodes: (ids) =>
    set((s) => {
      if (ids.every((id) => s.expandedNodeIds.has(id))) return s
      const next = new Set(s.expandedNodeIds)
      ids.forEach((id) => next.add(id))
      return { expandedNodeIds: next }
    }),
}))
