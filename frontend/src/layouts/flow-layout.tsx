import type { ReactNode } from 'react';
import { FlowEditorProvider } from '@/features/scenario-builder/store/flow-editor-context';
import { AppSidebar } from './app-sidebar';

interface FlowLayoutProps {
  children: ReactNode;
}

export function FlowLayout({ children }: FlowLayoutProps) {
  return (
    <FlowEditorProvider>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </FlowEditorProvider>
  );
}
