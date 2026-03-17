import { useEffect } from 'react';
import { toast } from 'sonner';
import { useFlowEditorActions } from '../store/flow-editor-context';
import { useScenarioCurrentScenarioId } from '@/features/scenario/store/scenario-store';
import { useCopyPaste } from './use-copy-paste';
import { useDelete } from './use-delete';
import { useSelect } from './use-select';
import { useShortcut } from './use-shortcut';
import { useValidation } from './use-validation';

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function useKeyBinding() {
  const currentScenarioId = useScenarioCurrentScenarioId();
  const { saveNow, undo, redo, setSelectedNode } = useFlowEditorActions();
  const { validateAndNotify } = useValidation();
  const { selectAll } = useSelect();
  const { copy, cut, paste } = useCopyPaste();
  const { canDelete, deleteSelected } = useDelete();

  useShortcut(['Meta+a', 'Control+a'], () => {
    setSelectedNode(null);
    selectAll();
  });
  useShortcut(['Meta+c', 'Control+c'], copy);
  useShortcut(['Meta+x', 'Control+x'], cut);
  useShortcut(['Meta+v', 'Control+v'], paste);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const isEditable = isEditableTarget(event.target);

      if (hasModifier && key === 's') {
        event.preventDefault();

        if (!currentScenarioId) {
          toast.error('Create or select a scenario first');
          return;
        }

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
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canDelete,
    currentScenarioId,
    deleteSelected,
    redo,
    saveNow,
    undo,
    validateAndNotify,
  ]);
}
