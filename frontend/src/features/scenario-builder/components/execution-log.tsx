import { useEffect, useRef } from 'react';
import { useExecutionStore } from '../store/execution-store';

const logLevelStyles: Record<string, string> = {
  info: 'text-foreground',
  warning: 'text-yellow-600',
  error: 'text-red-600',
};

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  } catch {
    return timestamp;
  }
}

export function ExecutionLog() {
  const actionLogs = useExecutionStore((state) => state.actionLogs);
  const status = useExecutionStore((state) => state.status);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actionLogs]);

  // Hide when idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="border-t border-border bg-background">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/50">
        <span className="text-xs font-medium">Execution Log</span>
        <span className="text-xs text-muted-foreground">{actionLogs.length} entries</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto p-2 font-mono text-xs">
        {actionLogs.map((log) => (
          <div key={log.id} className={`py-0.5 ${logLevelStyles[log.level] || logLevelStyles.info}`}>
            <span className="text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
            {' '}
            <span className="text-blue-600">[{log.instanceId || 'system'}]</span>
            {' '}
            {log.message}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
