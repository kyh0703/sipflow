import { createStore } from '@/lib/store';

interface ScenarioStoreState {
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
}

interface ScenarioStoreActions {
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaveStatus: (status: 'saved' | 'modified' | 'saving') => void;
}

type ScenarioStore = ScenarioStoreState & {
  actions: ScenarioStoreActions;
};

export const useScenarioStore = createStore<ScenarioStore>(
  (set) => ({
    currentScenarioId: null,
    currentScenarioName: null,
    isDirty: false,
    saveStatus: 'saved',
    actions: {
      setCurrentScenario: (id, name) => {
        set((state) => {
          state.currentScenarioId = id;
          state.currentScenarioName = name;
          state.isDirty = false;
          state.saveStatus = 'saved';
        });
      },
      setDirty: (dirty) => {
        set((state) => {
          state.isDirty = dirty;
          state.saveStatus = dirty ? 'modified' : 'saved';
        });
      },
      setSaveStatus: (status) => {
        set((state) => {
          state.saveStatus = status;
        });
      },
    },
  }),
  {
    name: 'scenario-store',
  }
);

export const useScenarioCurrentScenarioId = () =>
  useScenarioStore((state) => state.currentScenarioId);

export const useScenarioCurrentScenarioName = () =>
  useScenarioStore((state) => state.currentScenarioName);

export const useScenarioIsDirty = () =>
  useScenarioStore((state) => state.isDirty);

export const useScenarioSaveStatus = () =>
  useScenarioStore((state) => state.saveStatus);

export const useScenarioActions = () =>
  useScenarioStore((state) => state.actions);
