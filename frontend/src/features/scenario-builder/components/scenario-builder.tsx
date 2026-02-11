import { ReactFlowProvider } from '@xyflow/react';
import { Save, Check, Circle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DnDProvider } from '../hooks/use-dnd';
import { Canvas } from './canvas';
import { NodePalette } from './node-palette';
import { PropertiesPanel } from './properties-panel';
import { ScenarioTree } from './scenario-tree';
import { ExecutionToolbar } from './execution-toolbar';
import { ExecutionLog } from './execution-log';
import { ExecutionTimeline } from './execution-timeline';
import { useScenarioStore } from '../store/scenario-store';
import { useScenarioApi } from '../hooks/use-scenario-api';
import { useExecutionStore } from '../store/execution-store';

export function ScenarioBuilder() {
  const api = useScenarioApi();
  const currentScenarioId = useScenarioStore((state) => state.currentScenarioId);
  const currentScenarioName = useScenarioStore((state) => state.currentScenarioName);
  const saveStatus = useScenarioStore((state) => state.saveStatus);
  const saveNow = useScenarioStore((state) => state.saveNow);
  const executionStatus = useExecutionStore((state) => state.status);
  const [bottomTab, setBottomTab] = useState<'log' | 'timeline'>('log');

  const handleSave = async () => {
    if (!currentScenarioId) {
      toast.error('No scenario selected. Create or select a scenario first.');
      return;
    }

    try {
      await saveNow();
      toast.success('Scenario saved successfully');
    } catch (error) {
      toast.error('Failed to save scenario: ' + error);
    }
  };

  return (
    <ReactFlowProvider>
      <DnDProvider>
        <Toaster position="bottom-right" richColors />
        <div className="flex flex-col h-screen w-screen">
          {/* Header Bar */}
          <div className="h-10 border-b border-border bg-background flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {currentScenarioName || 'No scenario selected'}
              </span>
              {/* Save Status Indicator */}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500" title="All changes saved">
                  <Check size={12} />
                  Saved
                </span>
              )}
              {saveStatus === 'modified' && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500" title="Unsaved changes">
                  <Circle size={8} fill="currentColor" />
                  Modified
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500" title="Saving...">
                  <Loader2 size={12} className="animate-spin" />
                  Saving...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ExecutionToolbar />
              <button
                onClick={handleSave}
                disabled={!currentScenarioId}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save (Ctrl+S)"
              >
                <Save size={14} />
                Save
              </button>
              <ThemeToggle />
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar */}
            <div className="w-[200px] border-r border-border flex flex-col bg-background">
              {/* Upper area: Scenario tree */}
              <div className="flex-1 border-b overflow-hidden flex flex-col">
                <ScenarioTree />
              </div>

              {/* Lower area: Node palette */}
              <div className="flex-1 overflow-y-auto p-3">
                <NodePalette />
              </div>
            </div>

            {/* Center: Canvas + Execution Panel (Log/Timeline tabs) */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1">
                <Canvas />
              </div>
              {/* Bottom panel: only show when not idle */}
              {executionStatus !== 'idle' && (
                <div className="border-t border-border bg-background">
                  {/* Tab headers */}
                  <div className="flex items-center gap-1 px-3 py-1 border-b border-border bg-muted/50">
                    <button
                      onClick={() => setBottomTab('log')}
                      className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        bottomTab === 'log'
                          ? 'bg-background text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Log
                    </button>
                    <button
                      onClick={() => setBottomTab('timeline')}
                      className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        bottomTab === 'timeline'
                          ? 'bg-background text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Timeline
                    </button>
                  </div>
                  {/* Tab content */}
                  {bottomTab === 'log' && <ExecutionLog />}
                  {bottomTab === 'timeline' && <ExecutionTimeline />}
                </div>
              )}
            </div>

            {/* Right Sidebar: Properties */}
            <div className="w-[280px] border-l border-border bg-background overflow-y-auto p-4">
              <PropertiesPanel />
            </div>
          </div>
        </div>
      </DnDProvider>
    </ReactFlowProvider>
  );
}
