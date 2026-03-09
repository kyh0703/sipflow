import type { Edge, Node, OnSelectionChangeParams } from '@xyflow/react';
import { useScenarioStore } from '../store/scenario-store';
import { useScenarioFlow } from './use-scenario-flow';

export function useUndoRedo() {
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);
  const { canUndo, canRedo, canDelete, undo, redo, deleteSelection } = useScenarioFlow();

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
