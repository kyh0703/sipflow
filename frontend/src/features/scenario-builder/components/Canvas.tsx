import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useScenarioStore } from '../store/scenarioStore';
import { edgeTypes } from '../edges/BranchEdge';
import { useDnD } from '../hooks/useDnD';

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { type: dragType, setType: setDragType } = useDnD();

  const nodes = useScenarioStore((state) => state.nodes);
  const edges = useScenarioStore((state) => state.edges);
  const onNodesChange = useScenarioStore((state) => state.onNodesChange);
  const onEdgesChange = useScenarioStore((state) => state.onEdgesChange);
  const onConnect = useScenarioStore((state) => state.onConnect);
  const addNode = useScenarioStore((state) => state.addNode);
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

    if (!dragType) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: Node = {
      id: `${dragType}-${Date.now()}`,
      type: dragType,
      position,
      data: { label: `${dragType} node` },
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
      nodeTypes={{}}
      edgeTypes={edgeTypes}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
