import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
} from '@xyflow/react';
import type { ScenarioNode, BranchEdgeData } from '../types/scenario';
import type { ValidationError } from '../lib/validation';
import { SaveScenario } from '../../../../wailsjs/go/binding/ScenarioBinding';

interface ScenarioState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
  validationErrors: ValidationError[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearCanvas: () => void;
  getInstanceNodes: () => Node[];
  getInstanceColor: (instanceId: string) => string;
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaveStatus: (status: 'saved' | 'modified' | 'saving') => void;
  saveNow: () => Promise<void>;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  toFlowJSON: () => string;
  loadFromJSON: (json: string) => void;
}

// Inline debounce utility to avoid external dependencies
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentScenarioId: null,
  currentScenarioName: null,
  isDirty: false,
  saveStatus: 'saved',
  validationErrors: [],

  onNodesChange: (changes) => {
    // Only set isDirty for non-position changes (position changes are handled by onNodeDragStop)
    const hasNonPositionChange = changes.some((change) => change.type !== 'position');

    set({
      nodes: applyNodeChanges(changes, get().nodes),
      ...(hasNonPositionChange && { isDirty: true, saveStatus: 'modified' as const }),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
      saveStatus: 'modified',
    });
  },

  onConnect: (connection) => {
    const branchType = connection.sourceHandle === 'success' ? 'success' : 'failure';
    const newEdge = {
      ...connection,
      type: 'branch',
      data: { branchType } as BranchEdgeData,
    };

    set({
      edges: addEdge(newEdge, get().edges),
      isDirty: true,
      saveStatus: 'modified',
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
      isDirty: true,
      saveStatus: 'modified',
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
      saveStatus: 'modified',
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
      saveStatus: 'modified',
    });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setNodes: (nodes) => {
    set({ nodes });
  },

  setEdges: (edges) => {
    set({ edges });
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
    });
  },

  getInstanceNodes: () => {
    return get().nodes.filter((node) => node.type === 'sipInstance');
  },

  getInstanceColor: (instanceId: string) => {
    const instance = get().nodes.find((node) => node.id === instanceId && node.type === 'sipInstance');
    if (instance && instance.data && typeof instance.data.color === 'string') {
      return instance.data.color;
    }
    return '#94a3b8'; // gray default
  },

  setCurrentScenario: (id: string | null, name: string | null) => {
    // Cancel any pending autosave when switching scenarios
    debouncedSave.cancel();
    set({
      currentScenarioId: id,
      currentScenarioName: name,
      isDirty: false,
      saveStatus: 'saved',
    });
  },

  setDirty: (dirty: boolean) => {
    set({
      isDirty: dirty,
      saveStatus: dirty ? 'modified' : 'saved',
    });
  },

  setSaveStatus: (status: 'saved' | 'modified' | 'saving') => {
    set({ saveStatus: status });
  },

  saveNow: async () => {
    // Cancel pending debounced save
    debouncedSave.cancel();

    const { currentScenarioId, isDirty, toFlowJSON, setSaveStatus, setDirty } = get();

    if (!currentScenarioId || !isDirty) {
      return;
    }

    try {
      setSaveStatus('saving');
      const flowData = toFlowJSON();
      await SaveScenario(currentScenarioId, flowData);
      setDirty(false);
      setSaveStatus('saved');
      console.log('[Manual Save] Saved scenario:', currentScenarioId);
    } catch (error) {
      setSaveStatus('modified');
      console.error('[Manual Save] Failed:', error);
      throw error; // Re-throw for caller to handle
    }
  },

  setValidationErrors: (errors: ValidationError[]) => {
    set({ validationErrors: errors });
  },

  clearValidationErrors: () => {
    set({ validationErrors: [] });
  },

  toFlowJSON: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges });
  },

  loadFromJSON: (json: string) => {
    try {
      const { nodes, edges } = JSON.parse(json);
      set({
        nodes: nodes || [],
        edges: edges || [],
        isDirty: false,
        saveStatus: 'saved',
      });
    } catch (error) {
      console.error('Failed to parse flow JSON:', error);
      throw error;
    }
  },
}));

// Debounced autosave: 2000ms debounce delay
const AUTOSAVE_DEBOUNCE_MS = 2000;

const debouncedSave = debounce(async () => {
  const state = useScenarioStore.getState();

  // Guard: no scenario selected
  if (!state.currentScenarioId) {
    return;
  }

  // Guard: not dirty
  if (!state.isDirty) {
    return;
  }

  try {
    state.setSaveStatus('saving');
    const flowData = state.toFlowJSON();
    await SaveScenario(state.currentScenarioId, flowData);
    state.setDirty(false);
    state.setSaveStatus('saved');
    console.log('[Autosave] Saved scenario:', state.currentScenarioId);
  } catch (error) {
    state.setSaveStatus('modified');
    console.error('[Autosave] Failed:', error);
  }
}, AUTOSAVE_DEBOUNCE_MS);

// Subscribe to isDirty changes and trigger autosave
useScenarioStore.subscribe((state) => {
  if (state.isDirty && state.currentScenarioId) {
    debouncedSave();
  }
});
