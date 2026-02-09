import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useScenarioStore } from '../store/scenario-store';
import { useScenarioApi } from '../hooks/use-scenario-api';
import { edgeTypes } from '../edges/branch-edge';
import { useDnD } from '../hooks/use-dnd';
import { nodeTypes } from './nodes';
import { INSTANCE_COLORS } from '../types/scenario';

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { type: dragType, setType: setDragType } = useDnD();
  const api = useScenarioApi();

  const nodes = useScenarioStore((state) => state.nodes);
  const edges = useScenarioStore((state) => state.edges);
  const onNodesChange = useScenarioStore((state) => state.onNodesChange);
  const onEdgesChange = useScenarioStore((state) => state.onEdgesChange);
  const onConnect = useScenarioStore((state) => state.onConnect);
  const addNode = useScenarioStore((state) => state.addNode);
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);
  const currentScenarioId = useScenarioStore((state) => state.currentScenarioId);
  const toFlowJSON = useScenarioStore((state) => state.toFlowJSON);
  const setDirty = useScenarioStore((state) => state.setDirty);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

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
        label: 'SIP Instance',
        mode: 'DN',
        register: true,
        color: INSTANCE_COLORS[instanceCount % INSTANCE_COLORS.length],
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
      id: `${dragType}-${Date.now()}`,
      type: nodeType,
      position,
      data: nodeData,
    };

    addNode(newNode);
    setDragType(null);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();

        if (!currentScenarioId) {
          alert('Create or select a scenario first');
          return;
        }

        try {
          const flowData = toFlowJSON();
          await api.saveScenario(currentScenarioId, flowData);
          setDirty(false);
        } catch (error) {
          alert('Failed to save scenario: ' + error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentScenarioId, api, toFlowJSON, setDirty]);

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

    return true;
  };

  const connectionLineStyle = { stroke: '#94a3b8', strokeWidth: 2 };
  const defaultEdgeOptions = { type: 'branch' };

  return (
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
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      isValidConnection={isValidConnection}
      connectionLineStyle={connectionLineStyle}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
