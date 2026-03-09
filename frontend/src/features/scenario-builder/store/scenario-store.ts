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

interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface ScenarioState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
  validationErrors: ValidationError[];
  historyPast: FlowSnapshot[];
  historyFuture: FlowSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  removeSelectedElements: () => void;
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
  undo: () => void;
  redo: () => void;
}

function buildEdgeID(source: string, target: string): string {
  return `${source}-${target}`;
}

function cloneNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  }));
}

function cloneEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
  }));
}

function createSnapshot(nodes: Node[], edges: Edge[]): FlowSnapshot {
  return {
    nodes: cloneNodes(nodes),
    edges: cloneEdges(edges),
  };
}

function withHistory(state: ScenarioState): Pick<ScenarioState, 'historyPast' | 'historyFuture' | 'canUndo' | 'canRedo'> {
  const nextPast = [...state.historyPast, createSnapshot(state.nodes, state.edges)].slice(-50);
  return {
    historyPast: nextPast,
    historyFuture: [],
    canUndo: nextPast.length > 0,
    canRedo: false,
  };
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
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,

  onNodesChange: (changes) => {
    const hasPersistentChange = changes.some(
      (change) => change.type !== 'position' && change.type !== 'select'
    );
    const hasStructuralChange = changes.some(
      (change) => change.type !== 'position' && change.type !== 'select'
    );
    const historyState = hasStructuralChange ? withHistory(get()) : null;

    set({
      nodes: applyNodeChanges(changes, get().nodes),
      ...(hasPersistentChange && { isDirty: true, saveStatus: 'modified' as const }),
      ...(historyState ?? {}),
    });
  },

  onEdgesChange: (changes) => {
    const hasPersistentChange = changes.some((change) => change.type !== 'select');
    const hasStructuralChange = changes.some((change) => change.type !== 'select');
    const historyState = hasStructuralChange ? withHistory(get()) : null;

    set({
      edges: applyEdgeChanges(changes, get().edges),
      ...(hasPersistentChange && { isDirty: true, saveStatus: 'modified' as const }),
      ...(historyState ?? {}),
    });
  },

  onConnect: (connection) => {
    const branchType = connection.sourceHandle === 'success' ? 'success' : 'failure';
    const newEdge = {
      ...connection,
      id: buildEdgeID(connection.source, connection.target),
      type: 'branch',
      data: { branchType } as BranchEdgeData,
    };
    const historyState = withHistory(get());

    set({
      edges: addEdge(newEdge, get().edges),
      isDirty: true,
      saveStatus: 'modified',
      ...historyState,
    });
  },

  addNode: (node) => {
    const historyState = withHistory(get());
    set({
      nodes: [...get().nodes, node],
      isDirty: true,
      saveStatus: 'modified',
      ...historyState,
    });
  },

  removeNode: (nodeId) => {
    const historyState = withHistory(get());
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
      saveStatus: 'modified',
      ...historyState,
    });
  },

  removeSelectedElements: () => {
    const { nodes, edges, selectedNodeId } = get();
    const selectedNodeIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id)
    );

    if (selectedNodeId) {
      selectedNodeIds.add(selectedNodeId);
    }

    const selectedEdgeIds = new Set(
      edges
        .filter(
          (edge) =>
            edge.selected ||
            selectedNodeIds.has(edge.source) ||
            selectedNodeIds.has(edge.target)
        )
        .map((edge) => edge.id)
    );

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      return;
    }

    const historyState = withHistory(get());

    set({
      nodes: nodes.filter((node) => !selectedNodeIds.has(node.id)),
      edges: edges.filter((edge) => !selectedEdgeIds.has(edge.id)),
      isDirty: true,
      saveStatus: 'modified',
      selectedNodeId: null,
      ...historyState,
    });
  },

  updateNodeData: (nodeId, data) => {
    const historyState = withHistory(get());
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
      saveStatus: 'modified',
      ...historyState,
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
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
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
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
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
        edges: (edges || []).map((edge: Edge) => ({
          ...edge,
          id: buildEdgeID(edge.source, edge.target),
        })),
        isDirty: false,
        saveStatus: 'saved',
        historyPast: [],
        historyFuture: [],
        canUndo: false,
        canRedo: false,
      });
    } catch (error) {
      console.error('Failed to parse flow JSON:', error);
      throw error;
    }
  },

  undo: () => {
    const { historyPast, historyFuture, nodes, edges } = get();
    if (historyPast.length === 0) {
      return;
    }

    const previous = historyPast[historyPast.length - 1];
    const currentSnapshot = createSnapshot(nodes, edges);
    const nextPast = historyPast.slice(0, -1);
    const nextFuture = [...historyFuture, currentSnapshot].slice(-50);

    set({
      nodes: cloneNodes(previous.nodes),
      edges: cloneEdges(previous.edges),
      historyPast: nextPast,
      historyFuture: nextFuture,
      canUndo: nextPast.length > 0,
      canRedo: true,
      isDirty: true,
      saveStatus: 'modified',
      selectedNodeId: null,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, nodes, edges } = get();
    if (historyFuture.length === 0) {
      return;
    }

    const next = historyFuture[historyFuture.length - 1];
    const currentSnapshot = createSnapshot(nodes, edges);
    const nextPast = [...historyPast, currentSnapshot].slice(-50);
    const remainingFuture = historyFuture.slice(0, -1);

    set({
      nodes: cloneNodes(next.nodes),
      edges: cloneEdges(next.edges),
      historyPast: nextPast,
      historyFuture: remainingFuture,
      canUndo: true,
      canRedo: remainingFuture.length > 0,
      isDirty: true,
      saveStatus: 'modified',
      selectedNodeId: null,
    });
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
