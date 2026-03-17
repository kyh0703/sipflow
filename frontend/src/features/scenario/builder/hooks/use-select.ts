import { useCallback } from 'react';
import { useReactFlow, type Edge, type Node } from '@xyflow/react';
import { useFlowEditorActions, useFlowEditorSelectedNodeId } from '../store/flow-editor-context';

export function useSelect() {
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow<Node, Edge>();
  const { setSelectedNode } = useFlowEditorActions();
  const selectedNodeId = useFlowEditorSelectedNodeId();

  const selectAll = useCallback(() => {
    setSelectedNode(null);
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: true })));
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: true })));
  }, [setEdges, setNodes, setSelectedNode]);

  const selectNode = useCallback(
    (id: string) => {
      setSelectedNode(id);
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: node.id === id,
        }))
      );
      setEdges((edges) => edges.map((edge) => ({ ...edge, selected: false })));
    },
    [setEdges, setNodes, setSelectedNode]
  );

  const unselectNode = useCallback(
    (id: string) => {
      if (selectedNodeId === id) {
        setSelectedNode(null);
      }

      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: node.id === id ? false : node.selected,
        }))
      );
    },
    [selectedNodeId, setNodes, setSelectedNode]
  );

  const isSelected = useCallback(() => {
    return (
      Boolean(selectedNodeId) ||
      getNodes().some((node) => node.selected) ||
      getEdges().some((edge) => edge.selected)
    );
  }, [getEdges, getNodes, selectedNodeId]);

  return { selectAll, selectNode, unselectNode, isSelected };
}
