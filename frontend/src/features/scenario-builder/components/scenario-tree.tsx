import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useScenarioApi, type ScenarioListItem } from '../hooks/use-scenario-api';
import { useScenarioStore } from '../store/scenario-store';

export function ScenarioTree() {
  const api = useScenarioApi();
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const currentScenarioId = useScenarioStore((state) => state.currentScenarioId);
  const isDirty = useScenarioStore((state) => state.isDirty);
  const setCurrentScenario = useScenarioStore((state) => state.setCurrentScenario);
  const clearCanvas = useScenarioStore((state) => state.clearCanvas);
  const loadFromJSON = useScenarioStore((state) => state.loadFromJSON);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const list = await api.listScenarios();
      setScenarios(list);
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
      clearCanvas();
      setCurrentScenario(newScenario.id, newScenario.name);
      await loadScenarios();
    } catch (error) {
      alert('Failed to create scenario: ' + error);
    }
  };

  const handleLoadScenario = async (scenario: ScenarioListItem) => {
    // Check for unsaved changes
    if (isDirty) {
      const confirm = window.confirm(
        'You have unsaved changes. Do you want to discard them and switch scenarios?'
      );
      if (!confirm) {
        return;
      }
    }

    try {
      const loaded = await api.loadScenario(scenario.id);
      loadFromJSON(loaded.flow_data);
      setCurrentScenario(loaded.id, loaded.name);
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
    const confirm = window.confirm(
      `Are you sure you want to delete "${scenario.name}"? This action cannot be undone.`
    );
    if (!confirm) {
      return;
    }

    try {
      await api.deleteScenario(scenario.id);

      // If deleted scenario was the current one, clear canvas
      if (currentScenarioId === scenario.id) {
        clearCanvas();
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
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNewScenario}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New Scenario
        </button>
      </div>

      {/* Scenario list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        ) : scenarios.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No scenarios yet</div>
        ) : (
          <div className="flex flex-col">
            {scenarios.map((scenario) => {
              const isActive = currentScenarioId === scenario.id;
              return (
                <div
                  key={scenario.id}
                  onClick={() => handleLoadScenario(scenario)}
                  className={`
                    group flex items-center justify-between px-3 py-2 cursor-pointer
                    border-b border-border last:border-b-0
                    hover:bg-accent transition-colors
                    ${isActive ? 'bg-accent' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <span className="text-sm truncate" title={scenario.name}>
                        {scenario.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleRename(scenario, e)}
                      className="p-1 hover:bg-background rounded"
                      title="Rename"
                    >
                      <Pencil size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(scenario, e)}
                      className="p-1 hover:bg-background rounded"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-destructive" />
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
