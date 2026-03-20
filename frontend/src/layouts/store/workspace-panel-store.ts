import { createStore } from '@/lib/store';

type WorkspaceConsoleTab = 'log' | 'timeline';

interface WorkspacePanelStoreState {
  isConsoleOpen: boolean;
  consolePanelSize: number;
  consoleTab: WorkspaceConsoleTab;
}

interface WorkspacePanelStoreActions {
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsolePanelSize: (size: number) => void;
  setBottomTab: (tab: WorkspaceConsoleTab) => void;
}

type WorkspacePanelStore = WorkspacePanelStoreState & {
  actions: WorkspacePanelStoreActions;
};

export const useWorkspacePanelStore = createStore<WorkspacePanelStore>(
  (set) => ({
    isConsoleOpen: false,
    consolePanelSize: 33,
    consoleTab: 'log',
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
      setBottomTab: (tab) => {
        set((state) => {
          state.consoleTab = tab;
        });
      },
    },
  }),
  {
    name: 'workspace-layout-store',
  }
);

export const useWorkspaceConsoleOpen = () =>
  useWorkspacePanelStore((state) => state.isConsoleOpen);

export const useWorkspaceConsolePanelSize = () =>
  useWorkspacePanelStore((state) => state.consolePanelSize);

export const useWorkspaceConsoleTab = () =>
  useWorkspacePanelStore((state) => state.consoleTab);

export const useWorkspacePanelActions = () =>
  useWorkspacePanelStore((state) => state.actions);
