import { useEffect } from 'react';
import { Play, Square, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useExecutionStore } from '../store/execution-store';
import { useScenarioStore } from '../store/scenario-store';
import { useEngineApi } from '../hooks/use-engine-api';

const statusStyles: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  completed: 'bg-green-100 text-green-800 border border-green-300',
  failed: 'bg-red-100 text-red-800 border border-red-300',
  stopped: 'bg-orange-100 text-orange-800 border border-orange-300',
};

export function ExecutionToolbar() {
  const status = useExecutionStore((state) => state.status);
  const startListening = useExecutionStore((state) => state.startListening);
  const stopListening = useExecutionStore((state) => state.stopListening);
  const reset = useExecutionStore((state) => state.reset);
  const currentScenarioId = useScenarioStore((state) => state.currentScenarioId);
  const { startScenario, stopScenario } = useEngineApi();

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  const handleStart = async () => {
    if (!currentScenarioId) {
      toast.warning('No scenario selected', {
        description: 'Please select or create a scenario first.',
      });
      return;
    }

    try {
      reset();
      await startScenario(currentScenarioId);
    } catch (error) {
      toast.error('Failed to start scenario', {
        description: String(error),
      });
    }
  };

  const handleStop = async () => {
    try {
      await stopScenario();
    } catch (error) {
      toast.error('Failed to stop scenario', {
        description: String(error),
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Mode indicator (Local only in Phase 03) */}
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
        <ToggleLeft size={12} />
        <span>Local</span>
      </div>

      {/* Run button */}
      <button
        onClick={handleStart}
        disabled={status === 'running' || !currentScenarioId}
        className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Run scenario"
      >
        <Play size={14} />
        Run
      </button>

      {/* Stop button */}
      <button
        onClick={handleStop}
        disabled={status !== 'running'}
        className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Stop scenario"
      >
        <Square size={14} />
        Stop
      </button>

      {/* Status badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[status]}`}>
        {status}
      </span>
    </div>
  );
}
