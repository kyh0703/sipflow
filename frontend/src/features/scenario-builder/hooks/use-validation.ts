import { useMemo } from 'react';
import { toast } from 'sonner';
import { useScenarioStore } from '../store/scenario-store';
import { validateScenario, type ValidationError } from '../lib/validation';

export function useValidation() {
  const nodes = useScenarioStore((state) => state.nodes);
  const edges = useScenarioStore((state) => state.edges);
  const setValidationErrors = useScenarioStore((state) => state.setValidationErrors);
  const validationErrors = useScenarioStore((state) => state.validationErrors);

  /**
   * Run validation and store errors in the store.
   * Returns the array of validation errors.
   */
  const validate = (): ValidationError[] => {
    const errors = validateScenario(nodes, edges);
    setValidationErrors(errors);
    return errors;
  };

  /**
   * Run validation, store errors, and show toast notifications.
   * Returns true if valid (no errors), false otherwise.
   */
  const validateAndNotify = (): boolean => {
    const errors = validate();

    if (errors.length === 0) {
      toast.success('Validation passed', {
        description: 'Scenario is valid and ready to execute',
      });
      return true;
    }

    // Group errors by type
    const errorsByType = errors.reduce(
      (acc, error) => {
        if (!acc[error.type]) {
          acc[error.type] = [];
        }
        acc[error.type].push(error);
        return acc;
      },
      {} as Record<string, ValidationError[]>
    );

    // Show toast for each error type
    Object.entries(errorsByType).forEach(([type, typeErrors]) => {
      const count = typeErrors.length;
      let title = '';
      let description = '';

      switch (type) {
        case 'cycle':
          title = 'Cycle detected';
          description = `${count} node${count > 1 ? 's are' : ' is'} part of a cycle`;
          break;
        case 'isolated':
          title = 'Isolated nodes';
          description = `${count} node${count > 1 ? 's are' : ' is'} not connected to a SIP Instance`;
          break;
        case 'instance-assignment':
          title = 'Missing instance assignment';
          description = `${count} node${count > 1 ? 's need' : ' needs'} to be assigned to a SIP Instance`;
          break;
        case 'required-field':
          title = 'Required fields missing';
          description = `${count} node${count > 1 ? 's have' : ' has'} missing required fields`;
          break;
      }

      toast.error(title, { description });
    });

    return false;
  };

  /**
   * Set of node IDs that have validation errors.
   * Used for highlighting nodes with errors.
   */
  const errorNodeIds = useMemo(() => {
    const ids = new Set<string>();
    validationErrors.forEach((error) => {
      if (error.nodeId) {
        ids.add(error.nodeId);
      }
    });
    return ids;
  }, [validationErrors]);

  return {
    validate,
    validateAndNotify,
    errorNodeIds,
  };
}
