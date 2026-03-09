import type { Edge, Node, OnSelectionChangeParams } from '@xyflow/react';
import { useScenarioStore } from '../store/scenario-store';

export function useUndoRedo() {
  const nodes = useScenarioStore((state) => state.nodes);
  const edges = useScenarioStore((state) => state.edges);
  const selectedNodeId = useScenarioStore((state) => state.selectedNodeId);
  const canUndo = useScenarioStore((state) => state.canUndo);
  const canRedo = useScenarioStore((state) => state.canRedo);
  const undo = useScenarioStore((state) => state.undo);
  const redo = useScenarioStore((state) => state.redo);
  const removeSelectedElements = useScenarioStore((state) => state.removeSelectedElements);
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);

  const canDelete =
    Boolean(selectedNodeId) ||
    nodes.some((node) => node.selected) ||
    edges.some((edge) => edge.selected);

  const deleteSelection = () => {
    if (!canDelete) {
      return;
    }

    removeSelectedElements();
  };

  const handleSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams<Node, Edge>) => {
    setSelectedNode(selectedNodes.length === 1 ? selectedNodes[0].id : null);
  };

  return {
    canUndo,
    canRedo,
    canDelete,
    undo,
    redo,
    deleteSelection,
    handleSelectionChange,
  };
}
