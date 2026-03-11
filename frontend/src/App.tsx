import { Cog, FolderTree, Puzzle, Server } from 'lucide-react';
import type { ComponentType } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import {
  useActiveNavView,
  useActiveSettingsTab,
  useLayoutActions,
  type SettingsTab,
} from '@/store/layout-store';
import { ScenarioBuilder } from './features/scenario-builder/components/scenario-builder';
import { SettingsPanel } from './features/scenario-builder/components/settings-panel';
import { FlowEditorProvider } from './features/scenario-builder/store/flow-editor-context';
import './App.css';

function AppNavButton({
  isActive,
  label,
  icon: Icon,
  onClick,
}: {
  isActive: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function SettingsTabButton({
  isActive,
  label,
  icon: Icon,
  onClick,
}: {
  isActive: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function SettingsWorkspace({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: 'pbx') => void;
}) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-10 items-center border-b border-border px-5">
        <span className="text-sm font-medium">Settings</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/20 p-4">
          <div className="space-y-2">
            <SettingsTabButton
              isActive={activeTab === 'pbx'}
              label="PBX"
              icon={Server}
              onClick={() => onTabChange('pbx')}
            />
          </div>
        </aside>

        <div
          className="flex-1 overflow-auto p-6"
          style={{
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {activeTab === null ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/80 px-6 py-10 text-sm text-muted-foreground shadow-sm">
                왼쪽 세로 탭에서 설정 카테고리를 선택해 주세요.
              </div>
            ) : null}

            {activeTab === 'pbx' ? (
              <div className="rounded-3xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold text-foreground">PBX</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    SIP/PBX connection settings
                  </p>
                </div>
                <SettingsPanel />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const activeView = useActiveNavView();
  const activeSettingsTab = useActiveSettingsTab();
  const { setActiveNavView, setActiveSettingsTab } = useLayoutActions();

  return (
    <FlowEditorProvider>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <Toaster position="bottom-right" richColors />
        <aside className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/30 px-2 py-3">
          <nav className="mt-1 flex flex-col gap-1.5">
            <AppNavButton
              isActive={activeView === 'scenario'}
              label="Tree"
              icon={FolderTree}
              onClick={() => setActiveNavView('scenario')}
            />
            <AppNavButton
              isActive={activeView === 'palette'}
              label="Components"
              icon={Puzzle}
              onClick={() => setActiveNavView('palette')}
            />
          </nav>

          <div className="mt-auto flex flex-col items-center gap-1.5">
            <AppNavButton
              isActive={activeView === 'settings'}
              label="Settings"
              icon={Cog}
              onClick={() => setActiveNavView('settings')}
            />
            <ThemeToggle className="mx-auto h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {activeView === 'settings' ? (
            <SettingsWorkspace
              activeTab={activeSettingsTab}
              onTabChange={setActiveSettingsTab}
            />
          ) : (
            <ScenarioBuilder activePanel={activeView} />
          )}
        </main>
      </div>
    </FlowEditorProvider>
  );
}

export default App;
