import { FolderTree, Puzzle, SlidersHorizontal, SquareTerminal } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useWorkspaceConsoleOpen, useWorkspacePanelActions } from '@/features/scenario-builder/store/workspace-panel-store';

function AppNavLink({
  label,
  icon: Icon,
  to,
  exact = false,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: '/flow/scenario' | '/flow/palette' | '/settings/pbx';
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      title={label}
      aria-label={label}
      className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
      activeProps={{
        className: cn(
          'mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          'bg-primary text-primary-foreground shadow-sm'
        ),
      }}
      inactiveProps={{
        className: cn(
          'mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground'
        ),
      }}
    >
      <Icon className="h-5 w-5" />
    </Link>
  );
}

function AppActionButton({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
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

export function AppSidebar() {
  const location = useLocation();
  const isConsoleOpen = useWorkspaceConsoleOpen();
  const { toggleConsole } = useWorkspacePanelActions();
  const isFlowRoute = location.pathname.startsWith('/flow');

  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/30 px-2 py-3">
      <nav className="mt-1 flex flex-col gap-1.5">
        <AppNavLink
          label="Tree"
          icon={FolderTree}
          to="/flow/scenario"
          exact
        />
        <AppNavLink
          label="Components"
          icon={Puzzle}
          to="/flow/palette"
          exact
        />
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        {isFlowRoute ? (
          <AppActionButton
            label="Console"
            icon={SquareTerminal}
            isActive={isConsoleOpen}
            onClick={toggleConsole}
          />
        ) : null}
        <AppNavLink
          label="Settings"
          icon={SlidersHorizontal}
          to="/settings/pbx"
        />
      </div>
    </aside>
  );
}
