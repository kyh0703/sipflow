import { createStore } from '@/lib/store';

interface WorkspacePanelStoreState {
  isConsoleOpen: boolean;
  consolePanelSize: number;
}

interface WorkspacePanelStoreActions {
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsolePanelSize: (size: number) => void;
}

type WorkspacePanelStore = WorkspacePanelStoreState & {
  actions: WorkspacePanelStoreActions;
};

export const useWorkspacePanelStore = createStore<WorkspacePanelStore>(
  (set) => ({
    isConsoleOpen: false,
    consolePanelSize: 38,
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
      setConsolePanelSize: (size) => {
        set((state) => {
          state.consolePanelSize = size;
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

export const useWorkspaceConsolePanelSize = () =>
  useWorkspacePanelStore((state) => state.consolePanelSize);

export const useWorkspacePanelActions = () =>
  useWorkspacePanelStore((state) => state.actions);
