import {
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';
import { Save, Check, Circle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { DnDProvider } from '../hooks/use-dnd';
import {
  ScenarioFlowContext,
  useScenarioFlow,
  type ScenarioFlowContextValue,
} from '../context/scenario-flow-context';
import { ActivityBar } from './activity-bar';
import { Canvas } from './canvas';
import { NodePalette } from './node-palette';
import { PropertiesPanel } from './properties-panel';
import { ScenarioTree } from './scenario-tree';
import { ExecutionToolbar } from './execution-toolbar';
import { ExecutionLog } from './execution-log';
import { ExecutionTimeline } from './execution-timeline';
import { validateBackendContract } from '../lib/backend-contract';
import { useExecutionStatus } from '../hooks/use-execution';
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

const AUTOSAVE_DEBOUNCE_MS = 2000;
const initialFlowState: FlowState = {
  nodes: [],
  edges: [],
  historyPast: [],
  historyFuture: [],
};

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

function ScenarioFlowProvider({ children }: { children: React.ReactNode }) {
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

function ScenarioBuilderContent() {
  const {
    currentScenarioId,
    currentScenarioName,
    saveStatus,
    saveNow,
    selectedNodeId,
  } = useScenarioFlow();
  const executionStatus = useExecutionStatus();
  const [bottomTab, setBottomTab] = useState<'log' | 'timeline'>('log');
  const [activePanel, setActivePanel] = useState<'scenario' | 'palette' | null>('scenario');
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const propertiesRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => {
    if (selectedNodeId) {
      propertiesRef.current?.expand();
    } else {
      propertiesRef.current?.collapse();
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    validateBackendContract()
      .then((issues) => {
        if (cancelled || issues.length === 0) {
          return;
        }

        issues.forEach((issue) => console.error(issue));
        toast.error(`Backend contract mismatch detected (${issues.length})`);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to validate backend contract:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePanelToggle = (panel: 'scenario' | 'palette') => {
    if (activePanel === panel && !sidebarRef.current?.isCollapsed()) {
      sidebarRef.current?.collapse();
      setActivePanel(null);
    } else {
      sidebarRef.current?.expand();
      setActivePanel(panel);
    }
  };

  const handleSave = async () => {
    if (!currentScenarioId) {
      toast.error('No scenario selected. Create or select a scenario first.');
      return;
    }

    try {
      await saveNow();
      toast.success('Scenario saved successfully');
    } catch (error) {
      toast.error('Failed to save scenario: ' + error);
    }
  };

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <div className="flex flex-col h-screen w-screen">
        <div className="h-10 border-b border-border bg-background flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {currentScenarioName || 'No scenario selected'}
            </span>
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500" title="All changes saved">
                <Check size={12} />
                Saved
              </span>
            )}
            {saveStatus === 'modified' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500" title="Unsaved changes">
                <Circle size={8} fill="currentColor" />
                Modified
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500" title="Saving...">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ExecutionToolbar />
            <button
              onClick={handleSave}
              disabled={!currentScenarioId}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save (Ctrl+S)"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <ActivityBar
            activePanel={activePanel}
            onPanelToggle={handlePanelToggle}
          />

          <ResizablePanelGroup
            orientation="horizontal"
            className="flex-1"
            defaultLayout={{ sidebar: 20, canvas: 58, properties: 22 }}
          >
            <ResizablePanel
              id="sidebar"
              minSize="17%"
              maxSize="30%"
              collapsible
              collapsedSize={0}
              panelRef={sidebarRef}
              onResize={(size) => {
                if (size.asPercentage === 0) setActivePanel(null);
              }}
            >
              <div className="h-full overflow-y-auto">
                {activePanel === 'scenario' && <ScenarioTree />}
                {activePanel === 'palette' && (
                  <div className="p-3">
                    <NodePalette />
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel id="canvas">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <Canvas />
                </div>
                {executionStatus !== 'idle' && (
                  <div className="border-t border-border bg-background">
                    <div className="flex items-center gap-1 px-3 py-1 border-b border-border bg-muted/50">
                      <button
                        onClick={() => setBottomTab('log')}
                        className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                          bottomTab === 'log'
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Log
                      </button>
                      <button
                        onClick={() => setBottomTab('timeline')}
                        className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                          bottomTab === 'timeline'
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Timeline
                      </button>
                    </div>
                    {bottomTab === 'log' && <ExecutionLog />}
                    {bottomTab === 'timeline' && <ExecutionTimeline />}
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              id="properties"
              minSize="15%"
              maxSize="30%"
              collapsible
              collapsedSize={0}
              panelRef={propertiesRef}
            >
              <div className="h-full overflow-y-auto p-4">
                <PropertiesPanel />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </>
  );
}

export function ScenarioBuilder() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <ScenarioFlowProvider>
          <ScenarioBuilderContent />
        </ScenarioFlowProvider>
      </DnDProvider>
    </ReactFlowProvider>
  );
}
