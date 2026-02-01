import { create } from 'zustand'

/**
 * UI state interface
 */
interface UIState {
  sidebarOpen: boolean
  activePanel: string | null

  // Actions grouped in object to keep references stable
  actions: {
    toggleSidebar: () => void
    setActivePanel: (panel: string | null) => void
  }
}

/**
 * Zustand store for UI state
 *
 * Usage:
 * ```tsx
 * const sidebarOpen = useUIStore(state => state.sidebarOpen)
 * const toggleSidebar = useUIStore(state => state.actions.toggleSidebar)
 * ```
 */
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activePanel: null,

  actions: {
    toggleSidebar: () =>
      set((state) => ({
        sidebarOpen: !state.sidebarOpen,
      })),

    setActivePanel: (panel) =>
      set({
        activePanel: panel,
      }),
  },
}))
