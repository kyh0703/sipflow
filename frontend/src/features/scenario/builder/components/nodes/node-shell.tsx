import type { ReactNode } from 'react';
import { Position, useStore, type ReactFlowState } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LimitHandle } from '../limit-handle';

type NodeStatus = 'running' | 'completed' | 'failed' | 'error' | null;

interface NodeShellProps {
  nodeId: string;
  category: string;
  source?: string;
  title: string;
  icon: ReactNode;
  selected?: boolean;
  status?: NodeStatus;
  summary?: ReactNode;
  children?: ReactNode;
  showTargetHandle?: boolean;
}

const connectionNodeIdSelector = (state: ReactFlowState) =>
  state.connection.fromHandle?.nodeId;

function getStatusBadge(status: NodeStatus) {
  switch (status) {
    case 'running':
      return {
        label: 'Running',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'completed':
      return {
        label: 'Done',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'failed':
    case 'error':
      return {
        label: 'Issue',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    default:
      return null;
  }
}

function getRingClassName(status: NodeStatus) {
  switch (status) {
    case 'running':
      return 'ring-2 ring-amber-200';
    case 'completed':
      return 'ring-2 ring-emerald-200';
    case 'failed':
    case 'error':
      return 'ring-2 ring-rose-200';
    default:
      return '';
  }
}

export function NodeShell({
  nodeId,
  category,
  source,
  title,
  icon,
  selected = false,
  status = null,
  summary,
  children,
  showTargetHandle = true,
}: NodeShellProps) {
  const statusBadge = getStatusBadge(status);
  const connectionNodeId = useStore(connectionNodeIdSelector);
  const isConnecting = Boolean(connectionNodeId);
  const isSourceNode = connectionNodeId === nodeId;
  const isTarget = Boolean(connectionNodeId) && connectionNodeId !== nodeId;

  return (
    <div
      className={cn(
        'relative min-w-[220px] rounded-[18px] border border-border bg-card text-left shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_28px_rgba(15,23,42,0.06)] transition-[box-shadow,border-color,transform] duration-150',
        selected &&
          'border-dashed border-primary/80 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_12px_32px_rgba(15,23,42,0.12)] ring-2 ring-primary/20',
        getRingClassName(status),
        isTarget && 'border-blue-400 ring-2 ring-blue-200',
        isSourceNode && 'border-slate-400'
      )}
    >
      {showTargetHandle && (
        <LimitHandle
          type="target"
          position={Position.Top}
          id="target"
          connectionCount={1}
          className={cn(
            '!h-3 !w-3 !rounded-full !border-2 !border-background !shadow-sm transition-all',
            isTarget ? '!bg-blue-500 scale-110' : '!bg-slate-300'
          )}
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: isTarget ? 3 : 1,
          }}
        />
      )}

      <div className="px-4 pt-3 pb-3">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full bg-slate-400 transition-colors',
                selected && 'bg-primary',
                isTarget && 'bg-blue-500'
              )}
            />
            <span className="truncate">{category}</span>
          </div>
          {source ? <span className="truncate">{source}</span> : null}
        </div>

        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors',
              selected && 'border-primary/30 bg-primary/10 text-primary'
            )}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-card-foreground">{title}</div>
              </div>
              {statusBadge ? (
                <Badge
                  variant="outline"
                  className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px]', statusBadge.className)}
                >
                  {statusBadge.label}
                </Badge>
              ) : null}
            </div>

            {summary ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{summary}</div> : null}
          </div>
        </div>
      </div>

      {children ? <div className="border-t border-border/70 px-4 py-3">{children}</div> : null}

      {(!isConnecting || isSourceNode) && (
        <LimitHandle
          type="source"
          position={Position.Bottom}
          id="source"
          connectionCount={1}
          className="!h-3 !w-3 !rounded-full !border-2 !border-background !shadow-sm"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#cbd5e1',
          }}
        />
      )}
    </div>
  );
}
