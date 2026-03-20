import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { showConfirmModal } from '@/components/modal/confirm-modal';
import { useScenarioApi, type ScenarioListItem } from '../hooks/use-scenario-api';
import {
  useScenarioActions,
  useScenarioCurrentScenarioId,
  useScenarioIsDirty,
} from '../store/scenario-store';

export function ScenarioTree() {
  const api = useScenarioApi();
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const currentScenarioId = useScenarioCurrentScenarioId();
  const isDirty = useScenarioIsDirty();
  const { setCurrentScenario } = useScenarioActions();

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const list = await api.listScenarios();
      setScenarios(list ?? []);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleNewScenario = async () => {
    const name = window.prompt('Enter scenario name:');
    if (!name || name.trim() === '') {
      return;
    }

    try {
      const newScenario = await api.createScenario(name.trim());
      setCurrentScenario(newScenario.id, newScenario.name);
      await loadScenarios();
    } catch (error) {
      alert('Failed to create scenario: ' + error);
    }
  };

  const handleLoadScenario = async (scenario: ScenarioListItem) => {
    // Check for unsaved changes
    if (isDirty) {
      const shouldDiscard = await showConfirmModal(
        '저장되지 않은 변경사항이 있습니다.\n변경사항을 저장하지 않고 이동하면 현재 작업이 사라집니다.'
      );
      if (!shouldDiscard) {
        return;
      }
    }

    try {
      setCurrentScenario(scenario.id, scenario.name);
    } catch (error) {
      alert('Failed to load scenario: ' + error);
    }
  };

  const handleRename = async (scenario: ScenarioListItem, event: React.MouseEvent) => {
    event.stopPropagation();
    const newName = window.prompt('Enter new name:', scenario.name);
    if (!newName || newName.trim() === '') {
      return;
    }

    try {
      await api.renameScenario(scenario.id, newName.trim());
      await loadScenarios();

      // Update current scenario name if this is the active one
      if (currentScenarioId === scenario.id) {
        setCurrentScenario(scenario.id, newName.trim());
      }
    } catch (error) {
      alert('Failed to rename scenario: ' + error);
    }
  };

  const handleDelete = async (scenario: ScenarioListItem, event: React.MouseEvent) => {
    event.stopPropagation();
    const shouldDelete = await showConfirmModal(
      `"${scenario.name}" 시나리오를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await api.deleteScenario(scenario.id);

      // If deleted scenario was the current one, clear canvas
      if (currentScenarioId === scenario.id) {
        setCurrentScenario(null, null);
      }

      await loadScenarios();
    } catch (error) {
      alert('Failed to delete scenario: ' + error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with New button */}
      <div className="border-b border-border p-2">
        <button
          onClick={handleNewScenario}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={14} />
          New Scenario
        </button>
      </div>

      {/* Scenario list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-2 text-xs text-muted-foreground">Loading...</div>
        ) : scenarios.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">No scenarios yet</div>
        ) : (
          <div className="flex flex-col">
            {scenarios.map((scenario) => {
              const isActive = currentScenarioId === scenario.id;
              return (
                <div
                  key={scenario.id}
                  onClick={() => handleLoadScenario(scenario)}
                  className={`
                    group flex cursor-pointer items-center justify-between px-2 py-1.5
                    border-b border-border last:border-b-0
                    hover:bg-accent transition-colors
                    ${isActive ? 'bg-accent' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      )}
                      <span className="truncate text-[13px]" title={scenario.name}>
                        {scenario.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => handleRename(scenario, e)}
                      className="rounded p-1 hover:bg-background"
                      title="Rename"
                    >
                      <Pencil size={12} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(scenario, e)}
                      className="rounded p-1 hover:bg-background"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
