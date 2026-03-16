import { useCallback } from 'react';
import { useFlowEditorActions } from '../store/flow-editor-context';
import { useSelect } from './use-select';

export function useDelete() {
  const { removeSelectedElements, setSelectedNode } = useFlowEditorActions();
  const { isSelected } = useSelect();

  const deleteSelected = useCallback(() => {
    if (!isSelected()) {
      return;
    }

    setSelectedNode(null);
    removeSelectedElements();
  }, [isSelected, removeSelectedElements, setSelectedNode]);

  return {
    canDelete: isSelected(),
    deleteSelected,
  };
}
