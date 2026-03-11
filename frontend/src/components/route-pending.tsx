import { cn } from '@/lib/utils';

export function RoutePending({
  title = 'Loading...',
  description = '화면을 불러오는 중입니다.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full items-center justify-center p-8', className)}>
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="mt-6 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{title}</div>
          <div className="mt-1">{description}</div>
        </div>
      </div>
    </div>
  );
}
