import { Server } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { SettingsTab } from '@/router-types';
import { AppSidebar } from './app-sidebar';
import { FlowConsolePanel } from './flow-console-panel';
import { useWorkspaceConsoleOpen } from './store/workspace-panel-store';

function SettingsTabLink({
  label,
  icon: Icon,
  to,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: '/settings/pbx' | '/settings/general' | '/settings/media';
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors"
      activeProps={{
        className: cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
          'bg-primary text-primary-foreground'
        ),
      }}
      inactiveProps={{
        className: cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground'
        ),
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}

interface SettingsWorkspaceProps {
  activeTab: SettingsTab;
  children?: ReactNode;
}

const SETTINGS_META: Record<Exclude<SettingsTab, null>, { title: string }> = {
  pbx: {
    title: 'SIP',
  },
  general: {
    title: '',
  },
  media: {
    title: 'Media',
  },
};

function SettingsWorkspace({ activeTab, children }: SettingsWorkspaceProps) {
  const currentMeta = activeTab ? SETTINGS_META[activeTab] : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-9 items-center px-4">
        <span className="text-xs font-medium">Settings</span>
      </div>
      <Separator />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-44 shrink-0 flex-col bg-muted/20 p-2.5">
          <div className="space-y-1">
            <SettingsTabLink label="General" icon={Server} to="/settings/general" />
            <SettingsTabLink label="SIP" icon={Server} to="/settings/pbx" />
            <SettingsTabLink label="Media" icon={Server} to="/settings/media" />
          </div>
        </aside>
        <Separator orientation="vertical" />

        <section className="flex min-h-0 flex-1 flex-col bg-background">
          {activeTab === null ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-sm text-muted-foreground shadow-sm">
                왼쪽 탭에서 설정 카테고리를 선택해 주세요.
              </div>
            </div>
          ) : null}

          {activeTab !== null ? (
            <div className="min-h-0 flex-1 overflow-auto">
              {currentMeta?.title ? (
                <div className="px-6 py-5">
                  <h1 className="text-lg font-semibold text-foreground">{currentMeta.title}</h1>
                </div>
              ) : null}
              {children}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

interface SettingsLayoutProps {
  activeTab: SettingsTab;
  children?: ReactNode;
}

export function SettingsLayout({ activeTab, children }: SettingsLayoutProps) {
  const isConsoleOpen = useWorkspaceConsoleOpen();

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <AppSidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {isConsoleOpen ? (
          <FlowConsolePanel>
            <SettingsWorkspace activeTab={activeTab}>{children}</SettingsWorkspace>
          </FlowConsolePanel>
        ) : (
          <SettingsWorkspace activeTab={activeTab}>{children}</SettingsWorkspace>
        )}
      </main>
    </div>
  );
}
