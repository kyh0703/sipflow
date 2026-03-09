import type { Edge, Node, OnSelectionChangeParams } from '@xyflow/react';
import { useExecutionReadOnly } from './use-execution';
import { useScenarioFlow } from './use-scenario-flow';

export function useUndoRedo() {
  const { canUndo, canRedo, canDelete, undo, redo, deleteSelection, setSelectedNode } = useScenarioFlow();
  const isReadOnly = useExecutionReadOnly();

  const handleSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams<Node, Edge>) => {
    setSelectedNode(selectedNodes.length === 1 ? selectedNodes[0].id : null);
  };

  return {
    canUndo: canUndo && !isReadOnly,
    canRedo: canRedo && !isReadOnly,
    canDelete: canDelete && !isReadOnly,
    undo: () => {
      if (!isReadOnly) undo();
    },
    redo: () => {
      if (!isReadOnly) redo();
    },
    deleteSelection: () => {
      if (!isReadOnly) deleteSelection();
    },
    handleSelectionChange,
    isReadOnly,
  };
}
