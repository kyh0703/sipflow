import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { toast } from 'sonner';
import { LoadScenario, SaveScenario } from '../../../../wailsjs/go/binding/ScenarioBinding';
import type { ValidationError } from '../lib/validation';
import { getHelperLines } from '../lib/helper-line';
import type { BranchEdgeData } from '../types/scenario';
import {
  useScenarioActions,
  useScenarioCurrentScenarioId,
  useScenarioIsDirty,
} from './scenario-store';

interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface FlowEditorActions {
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeSelectedElements: () => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setDirty: (dirty: boolean) => void;
  saveNow: () => Promise<void>;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  toFlowJSON: () => string;
  loadFromJSON: (json: string) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
}

interface FlowEditorContextValue {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  validationErrors: ValidationError[];
  horizontalLine?: number;
  verticalLine?: number;
  canUndo: boolean;
  canRedo: boolean;
  actions: FlowEditorActions;
}

const FlowEditorContext = createContext<FlowEditorContextValue | null>(null);

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

function parseFlowJSON(json: string): FlowSnapshot {
  if (!json || json === '{}') {
    return { nodes: [], edges: [] };
  }

  const parsed = JSON.parse(json) as { nodes?: Node[]; edges?: Edge[] };

  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges)
      ? parsed.edges.map((edge) => ({
          ...edge,
          id: buildEdgeID(edge.source, edge.target),
        }))
      : [],
  };
}

function useFlowEditorContextValue(): FlowEditorContextValue {
  const currentScenarioId = useScenarioCurrentScenarioId();
  const isDirty = useScenarioIsDirty();
  const { setDirty, setSaveStatus } = useScenarioActions();

  const [nodes, setNodes, onNodesStateChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesStateChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [horizontalLine, setHorizontalLine] = useState<number | undefined>(undefined);
  const [verticalLine, setVerticalLine] = useState<number | undefined>(undefined);
  const [historyPast, setHistoryPast] = useState<FlowSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<FlowSnapshot[]>([]);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const selectedNodeIdRef = useRef(selectedNodeId);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const resetTransientState = useCallback(() => {
    setSelectedNodeId(null);
    setValidationErrors([]);
    setHistoryPast([]);
    setHistoryFuture([]);
    setHorizontalLine(undefined);
    setVerticalLine(undefined);
  }, []);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    resetTransientState();
  }, [resetTransientState]);

  const pushHistory = useCallback(() => {
    const snapshot = createSnapshot(nodesRef.current, edgesRef.current);
    setHistoryPast((prev) => [...prev, snapshot].slice(-50));
    setHistoryFuture([]);
  }, []);

  const loadFlowSnapshot = useCallback(
    (snapshot: FlowSnapshot) => {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      resetTransientState();
      setDirty(false);
      setSaveStatus('saved');
    },
    [resetTransientState, setDirty, setSaveStatus]
  );

  const toFlowJSON = useCallback(() => {
    return JSON.stringify({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
  }, []);

  const loadFromJSON = useCallback(
    (json: string) => {
      try {
        loadFlowSnapshot(parseFlowJSON(json));
      } catch (error) {
        console.error('Failed to parse flow JSON:', error);
        throw error;
      }
    },
    [loadFlowSnapshot]
  );

  const saveNow = useCallback(async () => {
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
  }, [currentScenarioId, isDirty, setDirty, setSaveStatus, toFlowJSON]);

  useEffect(() => {
    let cancelled = false;

    if (!currentScenarioId) {
      clearCanvas();
      setDirty(false);
      setSaveStatus('saved');
      return () => {
        cancelled = true;
      };
    }

    const loadScenario = async () => {
      try {
        const scenario = await LoadScenario(currentScenarioId);

        if (cancelled) {
          return;
        }

        loadFlowSnapshot(parseFlowJSON(scenario.flow_data));
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load scenario:', error);
        toast.error('Failed to load scenario: ' + error);
      }
    };

    void loadScenario();

    return () => {
      cancelled = true;
    };
  }, [clearCanvas, currentScenarioId, loadFlowSnapshot, setDirty, setSaveStatus]);

  useEffect(() => {
    if (!currentScenarioId || !isDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveNow().catch(() => {
        // saveNow already handles UI state + logging
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentScenarioId, edges, isDirty, nodes, saveNow]);

  const actions = useMemo<FlowEditorActions>(
    () => ({
      onNodesChange: (changes) => {
        const hasPersistentChange = changes.some(
          (change) => change.type !== 'position' && change.type !== 'select'
        );
        const hasStructuralChange = changes.some(
          (change) => change.type !== 'position' && change.type !== 'select'
        );

        if (hasStructuralChange) {
          pushHistory();
        }

        setHorizontalLine(undefined);
        setVerticalLine(undefined);

        if (
          changes.length === 1 &&
          changes[0].type === 'position' &&
          changes[0].dragging &&
          changes[0].position
        ) {
          const helperLines = getHelperLines(changes[0], nodesRef.current);
          changes[0].position.x = helperLines.snapPosition.x ?? changes[0].position.x;
          changes[0].position.y = helperLines.snapPosition.y ?? changes[0].position.y;
          setHorizontalLine(helperLines.horizontal);
          setVerticalLine(helperLines.vertical);
        }

        onNodesStateChange(changes);

        if (hasPersistentChange) {
          setDirty(true);
        }
      },
      onEdgesChange: (changes) => {
        const hasPersistentChange = changes.some((change) => change.type !== 'select');
        const hasStructuralChange = changes.some((change) => change.type !== 'select');

        if (hasStructuralChange) {
          pushHistory();
        }

        onEdgesStateChange(changes);

        if (hasPersistentChange) {
          setDirty(true);
        }
      },
      onConnect: (connection) => {
        const newEdge = {
          ...connection,
          sourceHandle: 'source',
          id: buildEdgeID(connection.source, connection.target),
          type: 'branch',
          data: { branchType: 'success' } as BranchEdgeData,
        };

        const sourceNode = nodesRef.current.find((node) => node.id === connection.source);
        const targetNode = nodesRef.current.find((node) => node.id === connection.target);
        const shouldAutoAssignInstance =
          sourceNode?.type === 'sipInstance' &&
          (targetNode?.type === 'command' || targetNode?.type === 'event');

        pushHistory();

        if (shouldAutoAssignInstance) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.id !== connection.target) {
                return node;
              }

              if (node.type === 'event' && node.data.event === 'INCOMING') {
                const sourceNumber =
                  typeof sourceNode?.data?.dn === 'string' && sourceNode.data.dn.length > 0
                    ? sourceNode.data.dn
                    : typeof sourceNode?.data?.label === 'string'
                    ? sourceNode.data.label
                    : '';

                return {
                  ...node,
                  data: {
                    ...node.data,
                    sipInstanceId: connection.source,
                    number: sourceNumber || node.data.number,
                  },
                };
              }

              return { ...node, data: { ...node.data, sipInstanceId: connection.source } };
            })
          );
        }

        setEdges((currentEdges) => addEdge(newEdge, currentEdges));
        setDirty(true);
      },
      addNode: (node) => {
        pushHistory();
        setNodes((currentNodes) => [...currentNodes, node]);
        setDirty(true);
      },
      removeSelectedElements: () => {
        const selectedNodeIds = new Set(
          nodesRef.current.filter((node) => node.selected).map((node) => node.id)
        );

        if (selectedNodeIdRef.current) {
          selectedNodeIds.add(selectedNodeIdRef.current);
        }

        const selectedEdgeIds = new Set(
          edgesRef.current
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

        pushHistory();

        setNodes((currentNodes) =>
          currentNodes.filter((node) => !selectedNodeIds.has(node.id))
        );
        setEdges((currentEdges) =>
          currentEdges.filter((edge) => !selectedEdgeIds.has(edge.id))
        );
        setSelectedNodeId(null);
        setDirty(true);
      },
      updateNodeData: (nodeId, data) => {
        pushHistory();
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          )
        );
        setDirty(true);
      },
      setSelectedNode: (nodeId) => {
        setSelectedNodeId(nodeId);
      },
      setDirty,
      saveNow,
      setValidationErrors: (errors) => {
        setValidationErrors(errors);
      },
      clearValidationErrors: () => {
        setValidationErrors([]);
      },
      toFlowJSON,
      loadFromJSON,
      clearCanvas,
      undo: () => {
        if (historyPast.length === 0) {
          return;
        }

        const previous = historyPast[historyPast.length - 1];
        const currentSnapshot = createSnapshot(nodesRef.current, edgesRef.current);

        setHistoryPast((prev) => prev.slice(0, -1));
        setHistoryFuture((prev) => [...prev, currentSnapshot].slice(-50));
        setNodes(cloneNodes(previous.nodes));
        setEdges(cloneEdges(previous.edges));
        setSelectedNodeId(null);
        setDirty(true);
      },
      redo: () => {
        if (historyFuture.length === 0) {
          return;
        }

        const next = historyFuture[historyFuture.length - 1];
        const currentSnapshot = createSnapshot(nodesRef.current, edgesRef.current);

        setHistoryPast((prev) => [...prev, currentSnapshot].slice(-50));
        setHistoryFuture((prev) => prev.slice(0, -1));
        setNodes(cloneNodes(next.nodes));
        setEdges(cloneEdges(next.edges));
        setSelectedNodeId(null);
        setDirty(true);
      },
    }),
    [
      clearCanvas,
      historyFuture,
      historyPast,
      loadFromJSON,
      onEdgesStateChange,
      onNodesStateChange,
      pushHistory,
      saveNow,
      setDirty,
      toFlowJSON,
    ]
  );

  return useMemo(
    () => ({
      nodes,
      edges,
      selectedNodeId,
      validationErrors,
      horizontalLine,
      verticalLine,
      canUndo: historyPast.length > 0,
      canRedo: historyFuture.length > 0,
      actions,
    }),
    [
      actions,
      edges,
      historyFuture.length,
      historyPast.length,
      horizontalLine,
      nodes,
      selectedNodeId,
      validationErrors,
      verticalLine,
    ]
  );
}

export function FlowEditorProvider({ children }: { children: ReactNode }) {
  const value = useFlowEditorContextValue();

  return <FlowEditorContext.Provider value={value}>{children}</FlowEditorContext.Provider>;
}

function useFlowEditorContext() {
  const context = useContext(FlowEditorContext);

  if (!context) {
    throw new Error('FlowEditorProvider is missing from the component tree.');
  }

  return context;
}

export function useFlowEditorNodes() {
  return useFlowEditorContext().nodes;
}

export function useFlowEditorEdges() {
  return useFlowEditorContext().edges;
}

export function useFlowEditorSelectedNodeId() {
  return useFlowEditorContext().selectedNodeId;
}

export function useFlowEditorValidationErrors() {
  return useFlowEditorContext().validationErrors;
}

export function useFlowEditorCanUndo() {
  return useFlowEditorContext().canUndo;
}

export function useFlowEditorCanRedo() {
  return useFlowEditorContext().canRedo;
}

export function useFlowEditorActions() {
  return useFlowEditorContext().actions;
}

export function useFlowEditorHorizontalLine() {
  return useFlowEditorContext().horizontalLine;
}

export function useFlowEditorVerticalLine() {
  return useFlowEditorContext().verticalLine;
}
