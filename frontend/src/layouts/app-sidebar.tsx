import { FolderTree, Puzzle, SlidersHorizontal } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

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

export function AppSidebar() {
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
        <AppNavLink
          label="Settings"
          icon={SlidersHorizontal}
          to="/settings/pbx"
        />
      </div>
    </aside>
  );
}
