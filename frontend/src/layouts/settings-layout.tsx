import { Server } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import type { SettingsTab } from '@/router-types';
import { AppSidebar } from './app-sidebar';

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
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors"
      activeProps={{
        className: cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
          'bg-primary text-primary-foreground'
        ),
      }}
      inactiveProps={{
        className: cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground'
        ),
      }}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

interface SettingsWorkspaceProps {
  activeTab: SettingsTab;
  children?: ReactNode;
}

const SETTINGS_META: Record<Exclude<SettingsTab, null>, { title: string; description: string }> = {
  pbx: {
    title: 'PBX',
    description: 'SIP/PBX connection settings',
  },
  general: {
    title: 'General',
    description: 'Application-level preferences and defaults',
  },
  media: {
    title: 'Media',
    description: 'Audio and media related settings',
  },
};

function SettingsWorkspace({
  activeTab,
  children,
}: SettingsWorkspaceProps) {
  const currentMeta = activeTab ? SETTINGS_META[activeTab] : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-10 items-center justify-between border-b border-border px-5">
        <span className="text-sm font-medium">Settings</span>
        <ThemeToggle />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/20 p-4">
          <div className="space-y-2">
            <SettingsTabLink
              label="PBX"
              icon={Server}
              to="/settings/pbx"
            />
            <SettingsTabLink
              label="General"
              icon={Server}
              to="/settings/general"
            />
            <SettingsTabLink
              label="Media"
              icon={Server}
              to="/settings/media"
            />
          </div>
        </aside>

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
              <div className="border-b border-border px-6 py-5">
                <h1 className="text-lg font-semibold text-foreground">{currentMeta?.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentMeta?.description}
                </p>
              </div>
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

export function SettingsLayout({
  activeTab,
  children,
}: SettingsLayoutProps) {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <SettingsWorkspace activeTab={activeTab}>
          {children}
        </SettingsWorkspace>
      </main>
    </div>
  );
}
