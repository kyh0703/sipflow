import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExecutionStore } from '../store/execution-store';

const logLevelStyles: Record<string, string> = {
  info: 'text-foreground',
  warning: 'text-yellow-600',
  error: 'text-red-600',
};

function formatTimestamp(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  } catch {
    return String(timestamp);
  }
}

export function ExecutionLog() {
  const actionLogs = useExecutionStore(useShallow((state) => state.actionLogs));
  const status = useExecutionStore((state) => state.status);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Log level filtering
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['info', 'warning', 'error'])
  );

  const toggleFilter = (level: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // Filter logs based on active filters
  const filteredLogs = actionLogs.filter((log) => activeFilters.has(log.level));

  // Check if user is at bottom (for smart auto-scroll)
  const checkIfAtBottom = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
  };

  // Auto-scroll to bottom when new logs arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottom && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actionLogs, isAtBottom]);

  // Hide when idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="border-t border-border bg-background">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Execution Log</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleFilter('info')}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                activeFilters.has('info')
                  ? 'bg-blue-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
              title="Toggle info logs"
            >
              INFO
            </button>
            <button
              onClick={() => toggleFilter('warning')}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                activeFilters.has('warning')
                  ? 'bg-yellow-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
              title="Toggle warning logs"
            >
              WARN
            </button>
            <button
              onClick={() => toggleFilter('error')}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                activeFilters.has('error')
                  ? 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
              title="Toggle error logs"
            >
              ERROR
            </button>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredLogs.length} / {actionLogs.length} entries
        </span>
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={checkIfAtBottom}
        className="max-h-[200px] overflow-y-auto p-2 font-mono text-xs"
      >
        {filteredLogs.map((log) => (
          <div key={log.id} className={`py-0.5 ${logLevelStyles[log.level] || logLevelStyles.info}`}>
            <span className="text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
            {' '}
            <span className="text-blue-600">[{log.instanceId || 'system'}]</span>
            {' '}
            {log.message}
            {log.sipMessage && (
              <span className="text-purple-600">
                {' '}
                {log.sipMessage.direction === 'sent' ? '->' : '<-'}
                {' '}
                {log.sipMessage.method}
                {log.sipMessage.responseCode ? ` ${log.sipMessage.responseCode}` : ''}
              </span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
