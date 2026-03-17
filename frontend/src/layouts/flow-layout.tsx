import { useEffect, type ReactNode } from 'react';
import { FlowEditorProvider } from '@/features/scenario/builder/store/flow-editor-context';
import { useScenarioIsDirty } from '@/features/scenario/store/scenario-store';
import { AppSidebar } from './app-sidebar';
import { FlowConsolePanel } from './flow-console-panel';
import { useWorkspaceConsoleOpen } from './store/workspace-panel-store';

interface FlowLayoutProps {
  children: ReactNode;
}

export function FlowLayout({ children }: FlowLayoutProps) {
  const isDirty = useScenarioIsDirty();
  const isConsoleOpen = useWorkspaceConsoleOpen();

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  return (
    <FlowEditorProvider>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          {isConsoleOpen ? (
            <FlowConsolePanel>{children}</FlowConsolePanel>
          ) : (
            children
          )}
        </main>
      </div>
    </FlowEditorProvider>
  );
}
