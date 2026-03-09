import { create } from 'zustand';
import type { ValidationError } from '../lib/validation';

interface ScenarioState {
  selectedNodeId: string | null;
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
  validationErrors: ValidationError[];
  setSelectedNode: (nodeId: string | null) => void;
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaveStatus: (status: 'saved' | 'modified' | 'saving') => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  selectedNodeId: null,
  currentScenarioId: null,
  currentScenarioName: null,
  isDirty: false,
  saveStatus: 'saved',
  validationErrors: [],

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setCurrentScenario: (id, name) => {
    set({
      currentScenarioId: id,
      currentScenarioName: name,
      isDirty: false,
      saveStatus: 'saved',
      selectedNodeId: null,
    });
  },

  setDirty: (dirty) => {
    set({
      isDirty: dirty,
      saveStatus: dirty ? 'modified' : 'saved',
    });
  },

  setSaveStatus: (status) => {
    set({ saveStatus: status });
  },

  setValidationErrors: (errors) => {
    set({ validationErrors: errors });
  },

  clearValidationErrors: () => {
    set({ validationErrors: [] });
  },
}));
