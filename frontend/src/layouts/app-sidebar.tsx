import { FolderTree, Puzzle, Settings, SquareTerminal } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { showConfirmModal } from '@/components/modal/confirm-modal';
import { cn } from '@/lib/utils';
import { useScenarioIsDirty } from '@/features/scenario/store/scenario-store';
import { useWorkspaceConsoleOpen, useWorkspacePanelActions } from './store/workspace-panel-store';

function AppNavLink({
  label,
  icon: Icon,
  to,
  exact = false,
  onNavigate,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: '/flow/scenario' | '/flow/palette' | '/settings/general';
  exact?: boolean;
  onNavigate: (to: '/flow/scenario' | '/flow/palette' | '/settings/general') => void;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(to);
      }}
      title={label}
      aria-label={label}
      className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      activeProps={{
        className: cn(
          'mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          'bg-primary text-primary-foreground shadow-sm'
        ),
      }}
      inactiveProps={{
        className: cn(
          'mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground'
        ),
      }}
    >
      <Icon className="h-4 w-4" />
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
        'mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDirty = useScenarioIsDirty();
  const isConsoleOpen = useWorkspaceConsoleOpen();
  const { toggleConsole } = useWorkspacePanelActions();

  const handleNavigate = async (
    to: '/flow/scenario' | '/flow/palette' | '/settings/general'
  ) => {
    if (location.pathname === to) {
      return;
    }

    if (isDirty) {
      const shouldDiscard = await showConfirmModal(
        '저장되지 않은 변경사항이 있습니다.\n변경사항을 저장하지 않고 이동하면 현재 작업이 사라집니다.'
      );

      if (!shouldDiscard) {
        return;
      }
    }

    await navigate({ to });
  };

  return (
    <aside className="flex w-12 shrink-0 flex-col border-r border-border bg-muted/30 px-1.5 py-2">
      <nav className="mt-1 flex flex-col gap-1">
        <AppNavLink
          label="Tree"
          icon={FolderTree}
          to="/flow/scenario"
          exact
          onNavigate={(to) => {
            void handleNavigate(to);
          }}
        />
        <AppNavLink
          label="Components"
          icon={Puzzle}
          to="/flow/palette"
          exact
          onNavigate={(to) => {
            void handleNavigate(to);
          }}
        />
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <AppActionButton
          label="Console"
          icon={SquareTerminal}
          isActive={isConsoleOpen}
          onClick={toggleConsole}
        />
        <AppNavLink
          label="Settings"
          icon={Settings}
          to="/settings/general"
          onNavigate={(to) => {
            void handleNavigate(to);
          }}
        />
      </div>
    </aside>
  );
}
