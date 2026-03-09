import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useExecutionActions,
  useExecutionActionLogs,
  useExecutionReadOnly,
  useExecutionStatus,
} from '../hooks/use-execution';
import { useScenarioFlow } from '../hooks/use-scenario-flow';
import { useUndoRedo } from '../hooks/use-undo-redo';
import { useValidation } from '../hooks/use-validation';
import { wouldCreateCycle } from '../lib/validation';
import { edgeTypes } from '../edges/branch-edge';
import { useDnD } from '../hooks/use-dnd';
import { nodeTypes } from './nodes';
import { CanvasToolbar } from './canvas-toolbar';
import { INSTANCE_COLORS, DEFAULT_CODECS } from '../types/scenario';
import type { EdgeAnimationMessage } from '../types/execution';

function createNodeID(): string {
  return uuidv4();
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { type: dragType, setType: setDragType } = useDnD();
  const { validateAndNotify } = useValidation();
  const { resolvedTheme } = useTheme();

  const {
    currentScenarioId,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    saveNow,
    setSelectedNode,
    setDirty,
  } = useScenarioFlow();
  const {
    canUndo,
    canRedo,
    canDelete,
    undo,
    redo,
    deleteSelection,
    handleSelectionChange,
  } = useUndoRedo();

  const status = useExecutionStatus();
  const isReadOnly = useExecutionReadOnly();
  const actionLogs = useExecutionActionLogs();
  const executionActions = useExecutionActions();
  const lastLogCountRef = useRef(0);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

    if (isReadOnly || !dragType) {
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
        label: 'SIP Instance',
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
        label: eventName,
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
    setDragType(null);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = isReadOnly ? 'none' : 'move';
  };

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const onNodeDragStop = () => {
    if (isReadOnly) {
      return;
    }
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

      executionActions.addEdgeAnimation(animation);
    });
  }, [status, actionLogs, edges, executionActions]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const isEditable = isEditableTarget(event.target);

      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if (hasModifier && key === 's') {
        event.preventDefault();

        if (!currentScenarioId) {
          toast.error('Create or select a scenario first');
          return;
        }

        // Run validation and show warnings
        validateAndNotify();

        try {
          await saveNow();
          toast.success('Scenario saved successfully');
        } catch (error) {
          toast.error('Failed to save scenario: ' + error);
        }

        return;
      }

      if (isEditable) {
        return;
      }

      if (hasModifier && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((hasModifier && key === 'z' && event.shiftKey) || (event.ctrlKey && key === 'y')) {
        event.preventDefault();
        redo();
        return;
      }

      if ((key === 'delete' || key === 'backspace') && canDelete) {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentScenarioId,
    canDelete,
    deleteSelection,
    redo,
    saveNow,
    undo,
    validateAndNotify,
  ]);

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

    // Prevent duplicate connections from the same source handle
    const existingEdge = edges.find(
      (edge) =>
        edge.source === connection.source &&
        edge.sourceHandle === connection.sourceHandle
    );
    if (existingEdge) {
      return false;
    }

    // Prevent cycles using DFS
    if (wouldCreateCycle(nodes, edges, { source: connection.source, target: connection.target })) {
      return false;
    }

    return true;
  };

  const connectionLineStyle = { stroke: '#94a3b8', strokeWidth: 2 };
  const defaultEdgeOptions = { type: 'branch' };

  // Background color: light mode uses gray-300 (#d1d5db), dark mode uses gray-600 (#52525b)
  const backgroundColor = resolvedTheme === 'dark' ? '#52525b' : '#d1d5db';

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={(connection) => {
        if (!isReadOnly) {
          onConnect(connection);
        }
      }}
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
      nodesDraggable={!isReadOnly}
      nodesConnectable={!isReadOnly}
      elementsSelectable
      connectOnClick={!isReadOnly}
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
          onDelete={deleteSelection}
        />
      </Panel>
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={backgroundColor} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
