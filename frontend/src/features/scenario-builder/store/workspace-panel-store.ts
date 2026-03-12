import { createStore } from '@/lib/store';

interface WorkspacePanelStoreState {
  isConsoleOpen: boolean;
}

interface WorkspacePanelStoreActions {
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
}

type WorkspacePanelStore = WorkspacePanelStoreState & {
  actions: WorkspacePanelStoreActions;
};

export const useWorkspacePanelStore = createStore<WorkspacePanelStore>(
  (set) => ({
    isConsoleOpen: false,
    actions: {
      toggleConsole: () => {
        set((state) => {
          state.isConsoleOpen = !state.isConsoleOpen;
        });
      },
      setConsoleOpen: (open) => {
        set((state) => {
          state.isConsoleOpen = open;
        });
      },
    },
  }),
  {
    name: 'workspace-panel-store',
  }
);

export const useWorkspaceConsoleOpen = () =>
  useWorkspacePanelStore((state) => state.isConsoleOpen);

export const useWorkspacePanelActions = () =>
  useWorkspacePanelStore((state) => state.actions);
