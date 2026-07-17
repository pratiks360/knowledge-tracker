import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Mobile only: the tree is an off-canvas drawer below `md`, closed by default. */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  chatPanelOpen: boolean
  toggleChatPanel: () => void
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
