import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExecutionStore } from '../store/execution-store';

function formatTime(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  } catch {
    return String(timestamp);
  }
}

const LANE_WIDTH = 150;
const MESSAGE_HEIGHT = 40;
const HEADER_HEIGHT = 30;
const PADDING = 20;

export function ExecutionTimeline() {
  const sipMessages = useExecutionStore(useShallow((state) => state.sipMessages));
  const status = useExecutionStore((state) => state.status);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Compute unique instances (lanes)
  const lanes = useMemo(() => {
    const uniqueInstances = [...new Set(sipMessages.map((log) => log.instanceId))];
    return uniqueInstances;
  }, [sipMessages]);

  // Check if user is at bottom (for smart auto-scroll)
  const checkIfAtBottom = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
  };

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottom && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [sipMessages, isAtBottom]);

  // Empty state
  if (sipMessages.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No SIP messages yet. Start the scenario to see the message sequence.
      </div>
    );
  }

  // Single instance case: show simple list instead of ladder diagram
  if (lanes.length === 1) {
    return (
      <>
        <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/50">
          <span className="text-xs font-medium">Timeline</span>
          <span className="text-xs text-muted-foreground">
            {sipMessages.length} messages (single instance)
          </span>
        </div>
        <div
          ref={scrollContainerRef}
          onScroll={checkIfAtBottom}
          className="max-h-[200px] overflow-y-auto p-2 font-mono text-xs"
        >
          {sipMessages.map((msg) => (
            <div key={msg.id} className="py-0.5 text-foreground">
              <span className="text-muted-foreground">{formatTime(msg.timestamp)}</span>
              {' '}
              <span className="text-purple-600">
                {msg.sipMessage?.direction === 'sent' ? '->' : '<-'}
                {' '}
                {msg.sipMessage?.method}
                {msg.sipMessage?.responseCode ? ` ${msg.sipMessage.responseCode}` : ''}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Ladder diagram for multiple instances
  const svgWidth = lanes.length * LANE_WIDTH + 2 * PADDING;
  const svgHeight = HEADER_HEIGHT + sipMessages.length * MESSAGE_HEIGHT + PADDING;

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/50">
        <span className="text-xs font-medium">Timeline</span>
        <span className="text-xs text-muted-foreground">
          {sipMessages.length} messages
        </span>
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={checkIfAtBottom}
        className="max-h-[200px] overflow-auto"
      >
        <svg width={svgWidth} height={svgHeight} className="bg-background">
          {/* Arrow marker definitions */}
          <defs>
            <marker
              id="arrowhead-blue"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
            </marker>
            <marker
              id="arrowhead-red"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
            </marker>
          </defs>

          {/* Instance headers and vertical lifelines */}
          {lanes.map((lane, i) => {
            const x = PADDING + i * LANE_WIDTH + LANE_WIDTH / 2;
            return (
              <g key={lane}>
                {/* Header text */}
                <text
                  x={x}
                  y={HEADER_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {lane}
                </text>
                {/* Vertical lifeline */}
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={svgHeight - PADDING}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="stroke-muted-foreground"
                  strokeDasharray="4,2"
                />
              </g>
            );
          })}

          {/* Message arrows */}
          {sipMessages.map((msg, i) => {
            if (!msg.sipMessage) return null;

            const fromIndex = lanes.indexOf(msg.instanceId);
            if (fromIndex === -1) return null;

            // Determine target lane based on direction
            // For simplicity, assume 'sent' goes right, 'received' comes from left
            // This is a simplification - in real SIP, we'd need actual from/to instance mapping
            const toIndex = msg.sipMessage.direction === 'sent'
              ? (fromIndex + 1) % lanes.length
              : (fromIndex - 1 + lanes.length) % lanes.length;

            const y = HEADER_HEIGHT + i * MESSAGE_HEIGHT + MESSAGE_HEIGHT / 2;
            const x1 = PADDING + fromIndex * LANE_WIDTH + LANE_WIDTH / 2;
            const x2 = PADDING + toIndex * LANE_WIDTH + LANE_WIDTH / 2;

            // Determine color: red for error responses (4xx, 5xx, 6xx), blue otherwise
            const isError = msg.sipMessage.responseCode && msg.sipMessage.responseCode >= 400;
            const arrowColor = isError ? '#ef4444' : '#3b82f6';
            const markerId = isError ? 'url(#arrowhead-red)' : 'url(#arrowhead-blue)';

            // Label: method or responseCode
            const label = msg.sipMessage.method || String(msg.sipMessage.responseCode || '');
            const labelX = (x1 + x2) / 2;
            const labelY = y - 5;

            // Timestamp on the left
            const timeLabel = formatTime(msg.timestamp);

            return (
              <g key={msg.id}>
                {/* Timestamp */}
                <text
                  x={5}
                  y={y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {timeLabel}
                </text>

                {/* Message arrow */}
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={arrowColor}
                  strokeWidth={1.5}
                  markerEnd={markerId}
                />

                {/* Method/Response label */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-medium"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
