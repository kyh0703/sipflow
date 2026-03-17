import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  useReactFlow,
  type OnSelectionChangeParams,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useScenarioCurrentScenarioId } from '@/features/scenario/store/scenario-store';
import {
  useFlowEditorActions,
  useFlowEditorCanRedo,
  useFlowEditorCanUndo,
  useFlowEditorEdges,
  useFlowEditorHorizontalLine,
  useFlowEditorNodes,
  useFlowEditorSelectedNodeId,
  useFlowEditorVerticalLine,
} from '../store/flow-editor-context';
import {
  useExecutionActionLogs,
  useExecutionActions,
  useExecutionStatus,
} from '@/features/execution/store/execution-store';
import { useDelete } from '../hooks/use-delete';
import { useKeyBinding } from '../hooks/use-key-binding';
import { useSelect } from '../hooks/use-select';
import { wouldCreateCycle } from '../lib/validation';
import { edgeTypes } from '../edges/branch-edge';
import { nodeTypes } from './nodes';
import { CanvasToolbar } from './canvas-toolbar';
import { HelperLines } from './helper-lines';
import { ConnectionLine } from './connection-line';
import { INSTANCE_COLORS, DEFAULT_CODECS } from '../types/scenario';
import type { EdgeAnimationMessage } from '@/features/execution/types/execution';
import { formatEventLabel } from '../lib/event-label';

function createNodeID(): string {
  return uuidv4();
}

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const shortcutTargetRef = useRef<HTMLDivElement>(null);
  const { canDelete, deleteSelected } = useDelete();
  const { selectNode } = useSelect();
  useKeyBinding();

  const nodes = useFlowEditorNodes();
  const edges = useFlowEditorEdges();
  const currentScenarioId = useScenarioCurrentScenarioId();
  const horizontalLine = useFlowEditorHorizontalLine();
  const verticalLine = useFlowEditorVerticalLine();
  const canUndo = useFlowEditorCanUndo();
  const canRedo = useFlowEditorCanRedo();
  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    setDirty,
    undo,
    redo,
  } = useFlowEditorActions();

  const status = useExecutionStatus();
  const actionLogs = useExecutionActionLogs();
  const { addEdgeAnimation } = useExecutionActions();
  const lastLogCountRef = useRef(0);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const dragType = event.dataTransfer.getData('application/reactflow');

    if (!dragType) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    let nodeType: string;
    let nodeData: Record<string, unknown>;

    if (dragType === 'sipInstance') {
      // Count existing SIP instances for color assignment
      const instanceCount = nodes.filter((n) => n.type === 'sipInstance').length;
      nodeType = 'sipInstance';
      nodeData = {
        label: '',
        dn: '',
        mode: 'DN',
        register: true,
        color: INSTANCE_COLORS[instanceCount % INSTANCE_COLORS.length],
        codecs: [...DEFAULT_CODECS],
      };
    } else if (dragType.startsWith('command-')) {
      // Parse command name from type string (e.g., 'command-MakeCall' -> 'MakeCall')
      const commandName = dragType.replace('command-', '');
      nodeType = 'command';
      nodeData = {
        label: commandName,
        command: commandName,
      };
    } else if (dragType.startsWith('event-')) {
      // Parse event name from type string (e.g., 'event-INCOMING' -> 'INCOMING')
      const eventName = dragType.replace('event-', '');
      nodeType = 'event';
      nodeData = {
        label: formatEventLabel(eventName),
        event: eventName,
      };
    } else {
      // Fallback for unknown types
      nodeType = dragType;
      nodeData = { label: `${dragType} node` };
    }

    const newNode: Node = {
      id: createNodeID(),
      type: nodeType,
      position,
      data: nodeData,
    };

    addNode(newNode);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const onNodeDragStop = () => {
    // Mark as dirty when node drag completes (position changes)
    setDirty(true);
  };

  // Trigger edge animations when sipMessage logs arrive
  useEffect(() => {
    if (status !== 'running') return;

    // Only process new logs
    if (actionLogs.length <= lastLogCountRef.current) {
      lastLogCountRef.current = actionLogs.length;
      return;
    }

    // Get new logs since last check
    const newLogs = actionLogs.slice(lastLogCountRef.current);
    lastLogCountRef.current = actionLogs.length;

    // Process each new log with sipMessage
    newLogs.forEach((log) => {
      if (!log.sipMessage) return;

      // Find outgoing edge from this node
      const outgoingEdge = edges.find((edge) => edge.source === log.nodeId);
      if (!outgoingEdge) return;

      // Create edge animation
      const animation: EdgeAnimationMessage = {
        id: crypto.randomUUID(),
        edgeId: outgoingEdge.id,
        method: log.sipMessage.method || '?',
        timestamp: Date.now(),
        duration: 1000,
      };

      addEdgeAnimation(animation);
    });
  }, [status, actionLogs, edges, addEdgeAnimation]);

  const isValidConnection = (connection: Edge | { source: string; target: string; sourceHandle?: string | null }) => {
    // Prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }

    // Prevent connecting TO a SipInstance node (they have no target handle)
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (targetNode && targetNode.type === 'sipInstance') {
      return false;
    }

    // Prevent duplicate connections from the same source node
    const existingEdge = edges.find((edge) => edge.source === connection.source);
    if (existingEdge) {
      return false;
    }

    // Prevent cycles using DFS
    if (wouldCreateCycle(nodes, edges, { source: connection.source, target: connection.target })) {
      return false;
    }

    return true;
  };

  const connectionLineStyle = { stroke: '#cbd5e1', strokeWidth: 1.5 };
  const defaultEdgeOptions = {
    type: 'branch',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: '#cbd5e1',
    },
  };

  // Keep the canvas visually quiet so nodes stand out.
  const backgroundColor = resolvedTheme === 'dark' ? '#334155' : '#e5e7eb';

  const handleDeleteSelected = () => {
    if (!canDelete) {
      return;
    }

    deleteSelected();
  };

  const handleSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams<Node, Edge>) => {
    setSelectedNode(selectedNodes.length === 1 ? selectedNodes[0].id : null);
  };

  return (
    <div
      id="xyflow"
      ref={shortcutTargetRef}
      tabIndex={0}
      className="h-full outline-none"
      onMouseDownCapture={() => shortcutTargetRef.current?.focus()}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={handleSelectionChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        connectionLineStyle={connectionLineStyle}
        connectionLineComponent={ConnectionLine}
        connectOnClick
        connectionRadius={28}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
      >
        <Panel position="top-right">
          <CanvasToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            canDelete={canDelete}
            onUndo={undo}
            onRedo={redo}
            onDelete={handleDeleteSelected}
          />
        </Panel>

        <HelperLines horizontal={horizontalLine} vertical={verticalLine} />
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color={backgroundColor} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
