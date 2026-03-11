import { createPersistStore } from '@/lib/store';

export type AppNavView = 'scenario' | 'palette' | 'settings';
export type SettingsTab = 'pbx' | null;

interface LayoutStoreState {
  activeNavView: AppNavView;
  activeSettingsTab: SettingsTab;
  actions: {
    setActiveNavView: (view: AppNavView) => void;
    setActiveSettingsTab: (tab: Exclude<SettingsTab, null>) => void;
  };
}

export const useLayoutStore = createPersistStore<LayoutStoreState>(
  (set) => ({
    activeNavView: 'scenario',
    activeSettingsTab: null,
    actions: {
      setActiveNavView: (view) =>
        set((state) => {
          state.activeNavView = view;
        }),
      setActiveSettingsTab: (tab) =>
        set((state) => {
          state.activeSettingsTab = tab;
        }),
    },
  }),
  {
    name: 'sipflow-layout',
    partialize: (state) => ({
      activeNavView: state.activeNavView,
      activeSettingsTab: state.activeSettingsTab,
    }),
  }
);

export const useActiveNavView = () =>
  useLayoutStore((state) => state.activeNavView);

export const useActiveSettingsTab = () =>
  useLayoutStore((state) => state.activeSettingsTab);

export const useLayoutActions = () =>
  useLayoutStore((state) => state.actions);
