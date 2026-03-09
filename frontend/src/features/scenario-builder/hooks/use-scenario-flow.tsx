import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { SaveScenario } from '../../../../wailsjs/go/binding/ScenarioBinding';
import type { ValidationError } from '../lib/validation';
import type { BranchEdgeData } from '../types/scenario';

interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  historyPast: FlowSnapshot[];
  historyFuture: FlowSnapshot[];
}

interface ScenarioFlowContextValue {
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  selectedNodeId: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
  validationErrors: ValidationError[];
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  sipInstanceNodes: Node[];
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  setSelectedNode: (nodeId: string | null) => void;
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  deleteSelection: () => void;
  clearCanvas: () => void;
  loadFromJSON: (json: string) => void;
  toFlowJSON: () => string;
  saveNow: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}

const ScenarioFlowContext = createContext<ScenarioFlowContextValue | null>(null);

const AUTOSAVE_DEBOUNCE_MS = 2000;

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

function withHistory(state: FlowState): Pick<FlowState, 'historyPast' | 'historyFuture'> {
  return {
    historyPast: [...state.historyPast, createSnapshot(state.nodes, state.edges)].slice(-50),
    historyFuture: [],
  };
}

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = null;
  };

  return debounced;
}

const initialFlowState: FlowState = {
  nodes: [],
  edges: [],
  historyPast: [],
  historyFuture: [],
};

export function ScenarioFlowProvider({ children }: PropsWithChildren) {
  const [flowState, setFlowState] = useState<FlowState>(initialFlowState);
  const [selectedNodeId, setSelectedNode] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [currentScenarioName, setCurrentScenarioName] = useState<string | null>(null);
  const [isDirty, setDirtyState] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const setCurrentScenario = useCallback((id: string | null, name: string | null) => {
    setCurrentScenarioId(id);
    setCurrentScenarioName(name);
    setSelectedNode(null);
    setDirtyState(false);
    setSaveStatus('saved');
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    setDirtyState(dirty);
    setSaveStatus(dirty ? 'modified' : 'saved');
  }, []);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const markModified = useCallback(() => {
    setDirty(true);
  }, [setDirty]);

  const clearCanvas = useCallback(() => {
    setFlowState(initialFlowState);
    setSelectedNode(null);
    setDirty(false);
    clearValidationErrors();
  }, [clearValidationErrors, setDirty]);

  const onNodesChange = useCallback<OnNodesChange>((changes) => {
    const hasPersistentChange = changes.some(
      (change) => change.type !== 'position' && change.type !== 'select'
    );
    const hasStructuralChange = changes.some(
      (change) => change.type !== 'position' && change.type !== 'select'
    );

    setFlowState((current) => ({
      ...current,
      nodes: applyNodeChanges(changes, current.nodes),
      ...(hasStructuralChange ? withHistory(current) : {}),
    }));

    if (hasPersistentChange) {
      markModified();
    }
  }, [markModified]);

  const onEdgesChange = useCallback<OnEdgesChange>((changes) => {
    const hasPersistentChange = changes.some((change) => change.type !== 'select');
    const hasStructuralChange = changes.some((change) => change.type !== 'select');

    setFlowState((current) => ({
      ...current,
      edges: applyEdgeChanges(changes, current.edges),
      ...(hasStructuralChange ? withHistory(current) : {}),
    }));

    if (hasPersistentChange) {
      markModified();
    }
  }, [markModified]);

  const onConnect = useCallback<OnConnect>((connection) => {
    const branchType = connection.sourceHandle === 'success' ? 'success' : 'failure';
    const newEdge = {
      ...connection,
      id: buildEdgeID(connection.source, connection.target),
      type: 'branch',
      data: { branchType } as BranchEdgeData,
    };

    setFlowState((current) => ({
      ...current,
      edges: addEdge(newEdge, current.edges),
      ...withHistory(current),
    }));
    markModified();
  }, [markModified]);

  const addNode = useCallback((node: Node) => {
    setFlowState((current) => ({
      ...current,
      nodes: [...current.nodes, node],
      ...withHistory(current),
    }));
    markModified();
  }, [markModified]);

  const updateNodeData = useCallback((nodeId: string, data: Partial<Record<string, unknown>>) => {
    setFlowState((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      ...withHistory(current),
    }));
    markModified();
  }, [markModified]);

  const deleteSelection = useCallback(() => {
    let didDelete = false;

    setFlowState((current) => {
      const selectedNodeIds = new Set(
        current.nodes.filter((node) => node.selected).map((node) => node.id)
      );

      if (selectedNodeId) {
        selectedNodeIds.add(selectedNodeId);
      }

      const selectedEdgeIds = new Set(
        current.edges
          .filter(
            (edge) =>
              edge.selected ||
              selectedNodeIds.has(edge.source) ||
              selectedNodeIds.has(edge.target)
          )
          .map((edge) => edge.id)
      );

      if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
        return current;
      }

      didDelete = true;

      return {
        ...current,
        nodes: current.nodes.filter((node) => !selectedNodeIds.has(node.id)),
        edges: current.edges.filter((edge) => !selectedEdgeIds.has(edge.id)),
        ...withHistory(current),
      };
    });

    if (didDelete) {
      setSelectedNode(null);
      markModified();
    }
  }, [markModified, selectedNodeId]);

  const loadFromJSON = useCallback((json: string) => {
    try {
      const { nodes, edges } = JSON.parse(json);
      setFlowState({
        nodes: nodes || [],
        edges: (edges || []).map((edge: Edge) => ({
          ...edge,
          id: buildEdgeID(edge.source, edge.target),
        })),
        historyPast: [],
        historyFuture: [],
      });
      setSelectedNode(null);
      setDirty(false);
      clearValidationErrors();
    } catch (error) {
      console.error('Failed to parse flow JSON:', error);
      throw error;
    }
  }, [clearValidationErrors, setDirty]);

  const toFlowJSON = useCallback(() => {
    return JSON.stringify({ nodes: flowState.nodes, edges: flowState.edges });
  }, [flowState.edges, flowState.nodes]);

  const debouncedSave = useMemo(
    () =>
      debounce(async (scenarioId: string, flowJSON: string) => {
        try {
          setSaveStatus('saving');
          await SaveScenario(scenarioId, flowJSON);
          setDirty(false);
          setSaveStatus('saved');
          console.log('[Autosave] Saved scenario:', scenarioId);
        } catch (error) {
          setSaveStatus('modified');
          console.error('[Autosave] Failed:', error);
        }
      }, AUTOSAVE_DEBOUNCE_MS),
    [setDirty]
  );

  const saveNow = useCallback(async () => {
    debouncedSave.cancel();

    if (!currentScenarioId || !isDirty) {
      return;
    }

    try {
      setSaveStatus('saving');
      await SaveScenario(currentScenarioId, toFlowJSON());
      setDirty(false);
      setSaveStatus('saved');
      console.log('[Manual Save] Saved scenario:', currentScenarioId);
    } catch (error) {
      setSaveStatus('modified');
      console.error('[Manual Save] Failed:', error);
      throw error;
    }
  }, [currentScenarioId, debouncedSave, isDirty, setDirty, toFlowJSON]);

  const undo = useCallback(() => {
    let didUndo = false;

    setFlowState((current) => {
      if (current.historyPast.length === 0) {
        return current;
      }

      const previous = current.historyPast[current.historyPast.length - 1];
      const currentSnapshot = createSnapshot(current.nodes, current.edges);
      const nextPast = current.historyPast.slice(0, -1);
      didUndo = true;

      return {
        nodes: cloneNodes(previous.nodes),
        edges: cloneEdges(previous.edges),
        historyPast: nextPast,
        historyFuture: [...current.historyFuture, currentSnapshot].slice(-50),
      };
    });

    if (didUndo) {
      setSelectedNode(null);
      markModified();
    }
  }, [markModified]);

  const redo = useCallback(() => {
    let didRedo = false;

    setFlowState((current) => {
      if (current.historyFuture.length === 0) {
        return current;
      }

      const next = current.historyFuture[current.historyFuture.length - 1];
      const currentSnapshot = createSnapshot(current.nodes, current.edges);
      const remainingFuture = current.historyFuture.slice(0, -1);
      didRedo = true;

      return {
        nodes: cloneNodes(next.nodes),
        edges: cloneEdges(next.edges),
        historyPast: [...current.historyPast, currentSnapshot].slice(-50),
        historyFuture: remainingFuture,
      };
    });

    if (didRedo) {
      setSelectedNode(null);
      markModified();
    }
  }, [markModified]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  useEffect(() => {
    if (isDirty && currentScenarioId) {
      debouncedSave(currentScenarioId, toFlowJSON());
    }
  }, [currentScenarioId, debouncedSave, isDirty, toFlowJSON]);

  useEffect(() => {
    if (selectedNodeId && !flowState.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNode(null);
    }
  }, [flowState.nodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => flowState.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [flowState.nodes, selectedNodeId]
  );

  const sipInstanceNodes = useMemo(
    () => flowState.nodes.filter((node) => node.type === 'sipInstance'),
    [flowState.nodes]
  );

  const value = useMemo<ScenarioFlowContextValue>(() => ({
    currentScenarioId,
    currentScenarioName,
    selectedNodeId,
    isDirty,
    saveStatus,
    validationErrors,
    nodes: flowState.nodes,
    edges: flowState.edges,
    selectedNode,
    sipInstanceNodes,
    canUndo: flowState.historyPast.length > 0,
    canRedo: flowState.historyFuture.length > 0,
    canDelete:
      Boolean(selectedNodeId) ||
      flowState.nodes.some((node) => node.selected) ||
      flowState.edges.some((edge) => edge.selected),
    setSelectedNode,
    setCurrentScenario,
    setDirty,
    setValidationErrors,
    clearValidationErrors,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    deleteSelection,
    clearCanvas,
    loadFromJSON,
    toFlowJSON,
    saveNow,
    undo,
    redo,
  }), [
    addNode,
    clearCanvas,
    clearValidationErrors,
    currentScenarioId,
    currentScenarioName,
    deleteSelection,
    flowState.edges,
    flowState.historyFuture.length,
    flowState.historyPast.length,
    flowState.nodes,
    isDirty,
    loadFromJSON,
    onConnect,
    onEdgesChange,
    onNodesChange,
    redo,
    saveNow,
    saveStatus,
    selectedNode,
    selectedNodeId,
    setCurrentScenario,
    setDirty,
    sipInstanceNodes,
    toFlowJSON,
    undo,
    updateNodeData,
    validationErrors,
  ]);

  return (
    <ScenarioFlowContext.Provider value={value}>
      {children}
    </ScenarioFlowContext.Provider>
  );
}

export function useScenarioFlow() {
  const context = useContext(ScenarioFlowContext);
  if (!context) {
    throw new Error('useScenarioFlow must be used within ScenarioFlowProvider');
  }
  return context;
}
