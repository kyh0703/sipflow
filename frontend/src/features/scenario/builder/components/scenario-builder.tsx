import { ReactFlowProvider } from '@xyflow/react';
import { Save, Check, Circle, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ExecutionToolbar } from '@/features/execution/components/execution-toolbar';
import { Canvas } from './canvas';
import { NodePalette } from './node-palette';
import { PropertiesPanel } from './properties-panel';
import { ScenarioTree } from '@/features/scenario/components/scenario-tree';
import { validateBackendContract } from '../lib/backend-contract';
import {
  useScenarioCurrentScenarioId,
  useScenarioCurrentScenarioName,
  useScenarioSaveStatus,
} from '@/features/scenario/store/scenario-store';
import {
  useFlowEditorActions,
  useFlowEditorSelectedNodeId,
} from '../store/flow-editor-context';

interface ScenarioBuilderProps {
  activePanel: 'scenario' | 'palette';
}

export function ScenarioBuilder({ activePanel }: ScenarioBuilderProps) {
  const currentScenarioId = useScenarioCurrentScenarioId();
  const currentScenarioName = useScenarioCurrentScenarioName();
  const saveStatus = useScenarioSaveStatus();
  const propertiesRef = useRef<PanelImperativeHandle>(null);
  const selectedNodeId = useFlowEditorSelectedNodeId();
  const { saveNow } = useFlowEditorActions();

  // Properties panel: expand when a node is selected, collapse when deselected
  useEffect(() => {
    if (selectedNodeId) {
      propertiesRef.current?.expand();
    } else {
      propertiesRef.current?.collapse();
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    validateBackendContract()
      .then((issues) => {
        if (cancelled || issues.length === 0) {
          return;
        }

        issues.forEach((issue) => console.error(issue));
        toast.error(`Backend contract mismatch detected (${issues.length})`);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to validate backend contract:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="flex h-full w-full flex-col">
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
              <ThemeToggle />
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
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Resizable layout */}
            <ResizablePanelGroup
              orientation="horizontal"
              className="flex-1"
              defaultLayout={{ sidebar: 20, canvas: 58, properties: 22 }}
            >
              {/* Left Sidebar */}
              <ResizablePanel
                id="sidebar"
                minSize="17%"
                maxSize="30%"
              >
                <div className="h-full overflow-y-auto">
                  {activePanel === 'scenario' && <ScenarioTree />}
                  {activePanel === 'palette' && (
                    <div className="p-3">
                      <NodePalette />
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Center: Canvas */}
              <ResizablePanel id="canvas">
                <div className="h-full min-h-0">
                  <Canvas />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Sidebar: Properties */}
              <ResizablePanel
                id="properties"
                minSize="15%"
                maxSize="30%"
                collapsible
                collapsedSize={0}
                panelRef={propertiesRef}
              >
                <div className="h-full overflow-y-auto p-4">
                  <PropertiesPanel />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
      </div>
    </ReactFlowProvider>
  );
}
