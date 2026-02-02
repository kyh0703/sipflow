import { create } from 'zustand'
import { flowService, isSuccess } from '@/services/flowService'
import type { FlowMeta } from '@/services/flowService'

/**
 * Project state interface
 */
interface ProjectState {
  projectPath: string | null    // Current .sipflow file path
  flows: FlowMeta[]             // Flow list for sidebar
  currentFlowId: number | null  // Active flow being edited
  isDirty: boolean              // Unsaved changes exist

  actions: {
    setProjectPath: (path: string | null) => void
    setFlows: (flows: FlowMeta[]) => void
    setCurrentFlowId: (id: number | null) => void
    markDirty: () => void
    markClean: () => void
    refreshFlowList: () => Promise<void>
    reset: () => void
  }
}

/**
 * Zustand store for project state
 *
 * Usage:
 * ```tsx
 * const projectPath = useProjectStore(state => state.projectPath)
 * const { markDirty, refreshFlowList } = useProjectStore(state => state.actions)
 * ```
 */
export const useProjectStore = create<ProjectState>((set) => ({
  projectPath: null,
  flows: [],
  currentFlowId: null,
  isDirty: false,

  actions: {
    setProjectPath: (path) => set({ projectPath: path }),

    setFlows: (flows) => set({ flows }),

    setCurrentFlowId: (id) => set({ currentFlowId: id }),

    markDirty: () => set({ isDirty: true }),

    markClean: () => set({ isDirty: false }),

    refreshFlowList: async () => {
      try {
        const response = await flowService.listFlows()
        if (isSuccess(response)) {
          set({ flows: response.data ?? [] })
        } else {
          console.error('Failed to refresh flow list:', response.error)
        }
      } catch (error) {
        console.error('Failed to refresh flow list:', error)
      }
    },

    reset: () => set({
      projectPath: null,
      flows: [],
      currentFlowId: null,
      isDirty: false,
    }),
  },
}))
