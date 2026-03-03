import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import type { ValidationError } from '../lib/validation';
import { SaveScenario } from '../../../../wailsjs/go/binding/ScenarioBinding';

type SaveStatus = 'saved' | 'modified' | 'saving';

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
  saveStatus: SaveStatus;
  validationErrors: ValidationError[];
  canUndo: boolean;
  canRedo: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  deleteSelectedElements: () => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearCanvas: () => void;
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  saveNow: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  toFlowJSON: () => string;
  loadFromJSON: (json: string) => void;
}

const HISTORY_LIMIT = 100;

const ScenarioStoreContext = createContext<ScenarioState | null>(null);

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneFlow(nodes: Node[], edges: Edge[]): FlowSnapshot {
  return {
    nodes: cloneValue(nodes),
    edges: cloneValue(edges),
  };
}

export function ScenarioStoreProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodesState] = useNodesState<Node>([]);
  const [edges, setEdgesState] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [currentScenarioName, setCurrentScenarioName] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatusState] = useState<SaveStatus>('saved');
  const [validationErrors, setValidationErrorsState] = useState<ValidationError[]>([]);
  const [undoStack, setUndoStack] = useState<FlowSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<FlowSnapshot[]>([]);

  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    const snapshot = cloneFlow(nodesRef.current, edgesRef.current);

    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length <= HISTORY_LIMIT) {
        return next;
      }

      return next.slice(next.length - HISTORY_LIMIT);
    });

    setRedoStack([]);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveStatusState('modified');
  }, []);

  const onNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      const hasStructuralChange = changes.some(
        (change) => change.type !== 'position' && change.type !== 'select' && change.type !== 'dimensions'
      );

      if (hasStructuralChange) {
        pushUndoSnapshot();
        markDirty();
      }

      setNodesState((prevNodes) => applyNodeChanges(changes, prevNodes));
    },
    [markDirty, pushUndoSnapshot, setNodesState]
  );

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      const hasStructuralChange = changes.some((change) => change.type !== 'select');

      if (hasStructuralChange) {
        pushUndoSnapshot();
        markDirty();
      }

      setEdgesState((prevEdges) => applyEdgeChanges(changes, prevEdges));
    },
    [markDirty, pushUndoSnapshot, setEdgesState]
  );

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      const branchType = connection.sourceHandle === 'success' ? 'success' : 'failure';
      const newEdge = {
        ...connection,
        type: 'branch',
        data: { branchType } as Record<string, unknown>,
      };

      pushUndoSnapshot();
      setEdgesState((prevEdges) => addEdge(newEdge, prevEdges));
      markDirty();
    },
    [markDirty, pushUndoSnapshot, setEdgesState]
  );

  const addNode = useCallback(
    (node: Node) => {
      pushUndoSnapshot();
      setNodesState((prevNodes) => [...prevNodes, node]);
      markDirty();
    },
    [markDirty, pushUndoSnapshot, setNodesState]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const hasNode = nodesRef.current.some((node) => node.id === nodeId);
      if (!hasNode) {
        return;
      }

      pushUndoSnapshot();
      setNodesState((prevNodes) => prevNodes.filter((node) => node.id !== nodeId));
      setEdgesState((prevEdges) => prevEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId((prevSelectedId) => (prevSelectedId === nodeId ? null : prevSelectedId));
      markDirty();
    },
    [markDirty, pushUndoSnapshot, setEdgesState, setNodesState]
  );

  const deleteSelectedElements = useCallback(() => {
    const selectedNodeIds = new Set(nodesRef.current.filter((node) => node.selected).map((node) => node.id));
    const selectedEdgeIds = new Set(edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id));

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      return;
    }

    pushUndoSnapshot();

    const nextNodes = nodesRef.current.filter((node) => !selectedNodeIds.has(node.id));
    const nextEdges = edgesRef.current.filter(
      (edge) =>
        !selectedEdgeIds.has(edge.id) &&
        !selectedNodeIds.has(edge.source) &&
        !selectedNodeIds.has(edge.target)
    );

    setNodesState(nextNodes);
    setEdgesState(nextEdges);
    setSelectedNodeId((prevSelectedId) => (prevSelectedId && selectedNodeIds.has(prevSelectedId) ? null : prevSelectedId));
    markDirty();
  }, [markDirty, pushUndoSnapshot, setEdgesState, setNodesState]);

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<any>) => {
      const hasNode = nodesRef.current.some((node) => node.id === nodeId);
      if (!hasNode) {
        return;
      }

      pushUndoSnapshot();
      setNodesState((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      markDirty();
    },
    [markDirty, pushUndoSnapshot, setNodesState]
  );

  const setSelectedNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const setNodes = useCallback(
    (nextNodes: Node[]) => {
      setNodesState(nextNodes);
    },
    [setNodesState]
  );

  const setEdges = useCallback(
    (nextEdges: Edge[]) => {
      setEdgesState(nextEdges);
    },
    [setEdgesState]
  );

  const clearCanvas = useCallback(() => {
    if (nodesRef.current.length === 0 && edgesRef.current.length === 0) {
      return;
    }

    pushUndoSnapshot();
    setNodesState([]);
    setEdgesState([]);
    setSelectedNodeId(null);
    markDirty();
  }, [markDirty, pushUndoSnapshot, setEdgesState, setNodesState]);

  const setCurrentScenario = useCallback(
    (id: string | null, name: string | null) => {
      setCurrentScenarioId(id);
      setCurrentScenarioName(name);
      setIsDirty(false);
      setSaveStatusState('saved');
      setValidationErrorsState([]);
      clearHistory();
    },
    [clearHistory]
  );

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    setSaveStatusState(dirty ? 'modified' : 'saved');
  }, []);

  const setSaveStatus = useCallback((status: SaveStatus) => {
    setSaveStatusState(status);
  }, []);

  const toFlowJSON = useCallback(() => {
    return JSON.stringify({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
  }, []);

  const saveNow = useCallback(async () => {
    if (!currentScenarioId || !isDirty) {
      return;
    }

    try {
      setSaveStatusState('saving');
      const flowData = toFlowJSON();
      await SaveScenario(currentScenarioId, flowData);
      setIsDirty(false);
      setSaveStatusState('saved');
      console.log('[Manual Save] Saved scenario:', currentScenarioId);
    } catch (error) {
      setSaveStatusState('modified');
      console.error('[Manual Save] Failed:', error);
      throw error;
    }
  }, [currentScenarioId, isDirty, toFlowJSON]);

  const undo = useCallback(() => {
    setUndoStack((prevUndoStack) => {
      if (prevUndoStack.length === 0) {
        return prevUndoStack;
      }

      const previousSnapshot = prevUndoStack[prevUndoStack.length - 1];
      const currentSnapshot = cloneFlow(nodesRef.current, edgesRef.current);

      setRedoStack((prevRedoStack) => [...prevRedoStack, currentSnapshot]);
      setNodesState(cloneValue(previousSnapshot.nodes));
      setEdgesState(cloneValue(previousSnapshot.edges));
      setSelectedNodeId((prevSelectedId) =>
        prevSelectedId && previousSnapshot.nodes.some((node) => node.id === prevSelectedId)
          ? prevSelectedId
          : null
      );
      markDirty();

      return prevUndoStack.slice(0, -1);
    });
  }, [markDirty, setEdgesState, setNodesState]);

  const redo = useCallback(() => {
    setRedoStack((prevRedoStack) => {
      if (prevRedoStack.length === 0) {
        return prevRedoStack;
      }

      const nextSnapshot = prevRedoStack[prevRedoStack.length - 1];
      const currentSnapshot = cloneFlow(nodesRef.current, edgesRef.current);

      setUndoStack((prevUndoStack) => {
        const nextUndoStack = [...prevUndoStack, currentSnapshot];
        if (nextUndoStack.length <= HISTORY_LIMIT) {
          return nextUndoStack;
        }

        return nextUndoStack.slice(nextUndoStack.length - HISTORY_LIMIT);
      });

      setNodesState(cloneValue(nextSnapshot.nodes));
      setEdgesState(cloneValue(nextSnapshot.edges));
      setSelectedNodeId((prevSelectedId) =>
        prevSelectedId && nextSnapshot.nodes.some((node) => node.id === prevSelectedId)
          ? prevSelectedId
          : null
      );
      markDirty();

      return prevRedoStack.slice(0, -1);
    });
  }, [markDirty, setEdgesState, setNodesState]);

  const setValidationErrors = useCallback((errors: ValidationError[]) => {
    setValidationErrorsState(errors);
  }, []);

  const clearValidationErrors = useCallback(() => {
    setValidationErrorsState([]);
  }, []);

  const loadFromJSON = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as { nodes?: Node[]; edges?: Edge[] };

        setNodesState(parsed.nodes ?? []);
        setEdgesState(parsed.edges ?? []);
        setSelectedNodeId(null);
        setIsDirty(false);
        setSaveStatusState('saved');
        setValidationErrorsState([]);
        clearHistory();
      } catch (error) {
        console.error('Failed to parse flow JSON:', error);
        throw error;
      }
    },
    [clearHistory, setEdgesState, setNodesState]
  );

  const state = useMemo<ScenarioState>(
    () => ({
      nodes,
      edges,
      selectedNodeId,
      currentScenarioId,
      currentScenarioName,
      isDirty,
      saveStatus,
      validationErrors,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      onNodesChange,
      onEdgesChange,
      onConnect,
      addNode,
      removeNode,
      deleteSelectedElements,
      updateNodeData,
      setSelectedNode,
      setNodes,
      setEdges,
      clearCanvas,
      setCurrentScenario,
      setDirty,
      setSaveStatus,
      saveNow,
      undo,
      redo,
      setValidationErrors,
      clearValidationErrors,
      toFlowJSON,
      loadFromJSON,
    }),
    [
      addNode,
      clearCanvas,
      clearValidationErrors,
      currentScenarioId,
      currentScenarioName,
      deleteSelectedElements,
      edges,
      isDirty,
      loadFromJSON,
      onConnect,
      onEdgesChange,
      onNodesChange,
      redo,
      removeNode,
      saveNow,
      saveStatus,
      selectedNodeId,
      setCurrentScenario,
      setDirty,
      setEdges,
      setNodes,
      setSaveStatus,
      setSelectedNode,
      setValidationErrors,
      toFlowJSON,
      undo,
      updateNodeData,
      validationErrors,
      nodes,
      undoStack.length,
      redoStack.length,
    ]
  );

  return <ScenarioStoreContext.Provider value={state}>{children}</ScenarioStoreContext.Provider>;
}

export function useScenarioStore<T>(selector: (state: ScenarioState) => T): T {
  const state = useContext(ScenarioStoreContext);

  if (!state) {
    throw new Error('useScenarioStore must be used within ScenarioStoreProvider');
  }

  return selector(state);
}
