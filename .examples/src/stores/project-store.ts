import { createStore } from '@/lib/store'

interface ProjectState {
  search: string
  actions: {
    setSearch: (term: string) => void
  }
}

export const useProjectStore = createStore<ProjectState>(
  (set) => ({
      search: '',
      actions: {
        setSearch: (term) =>
          set((state) => {
            state.search = term
          }),
      },
  }),
  { name: 'project' },
)

export const useProjectSearch = () => useProjectStore((state) => state.search)
export const useProjectActions = () => useProjectStore((state) => state.actions)
