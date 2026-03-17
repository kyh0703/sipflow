import { ExecutionLog } from '@/features/execution/components/execution-log';
import { ExecutionTimeline } from '@/features/execution/components/execution-timeline';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  useWorkspaceConsolePanelSize,
  useWorkspaceConsoleTab,
  useWorkspacePanelActions,
} from './store/workspace-panel-store';

export function FlowConsolePanel({ children }: { children: React.ReactNode }) {
  const consolePanelSize = useWorkspaceConsolePanelSize();
  const consoleTab = useWorkspaceConsoleTab();
  const effectiveConsolePanelSize = Math.max(consolePanelSize, 38);
  const { setConsolePanelSize, setBottomTab } = useWorkspacePanelActions();

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel id="flow-content" defaultSize={100 - effectiveConsolePanelSize} minSize={10}>
        <div className="h-full min-h-0">{children}</div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        id="console"
        defaultSize={effectiveConsolePanelSize}
        minSize={20}
        maxSize={90}
        onResize={(size) => {
          if (size.asPercentage > 0) {
            setConsolePanelSize(size.asPercentage);
          }
        }}
      >
        <div className="flex h-full min-h-0 flex-col border-t border-border bg-background">
          <div className="flex items-center gap-1 border-b border-border bg-muted/50 px-3 py-1">
            <button
              onClick={() => setBottomTab('log')}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                consoleTab === 'log'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Log
            </button>
            <button
              onClick={() => setBottomTab('timeline')}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                consoleTab === 'timeline'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Timeline
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {consoleTab === 'log' ? <ExecutionLog /> : <ExecutionTimeline />}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
