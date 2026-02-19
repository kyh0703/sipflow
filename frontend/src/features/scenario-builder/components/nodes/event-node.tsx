import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bell,
  PhoneMissed,
  BellRing,
  Clock,
  Pause,
  Play,
  ArrowRightLeft,
  MessageSquare,
  Ear,
} from 'lucide-react';
import type { EventNode as EventNodeType } from '../../types/scenario';
import { useScenarioStore } from '../../store/scenario-store';
import { useExecutionStore } from '../../store/execution-store';

const EVENT_ICONS = {
  INCOMING: Bell,
  DISCONNECTED: PhoneMissed,
  RINGING: BellRing,
  TIMEOUT: Clock,
  HELD: Pause,
  RETRIEVED: Play,
  TRANSFERRED: ArrowRightLeft,
  NOTIFY: MessageSquare,
  DTMFReceived: Ear,
} as const;

function getExecutionStyle(status?: string): string {
  switch (status) {
    case 'running':
      return 'ring-2 ring-yellow-400 shadow-yellow-200 animate-pulse';
    case 'completed':
      return 'ring-2 ring-green-400 shadow-green-200';
    case 'failed':
      return 'ring-2 ring-red-400 shadow-red-200';
    default:
      return '';
  }
}

export function EventNode({ data, id }: NodeProps<EventNodeType>) {
  const Icon = EVENT_ICONS[data.event as keyof typeof EVENT_ICONS];
  const instanceColor = data.sipInstanceId ? '#f59e0b' : '#6b7280';
  const validationErrors = useScenarioStore((state) => state.validationErrors);
  const hasError = validationErrors.some((error) => error.nodeId === id);
  const nodeExecState = useExecutionStore((state) => state.nodeStates[id]);

  // Execution state takes priority over validation errors
  const ringStyle = nodeExecState?.status
    ? getExecutionStyle(nodeExecState.status)
    : hasError
    ? 'ring-2 ring-red-500 shadow-red-200'
    : '';

  return (
    <div
      className={`bg-amber-50 border-2 border-amber-400 rounded-xl shadow-md min-w-[150px] ${ringStyle}`}
      style={{ borderLeftWidth: '4px', borderLeftColor: instanceColor }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600"
      />

      <div className="px-3 py-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-bold text-amber-900">{data.label}</span>
        {nodeExecState?.status === 'running' && (
          <span className="text-xs text-amber-600 ml-auto">Waiting...</span>
        )}
      </div>

      {data.event === 'TIMEOUT' && data.timeout && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground">Wait: {data.timeout}ms</div>
        </div>
      )}

      {data.event === 'DTMFReceived' && data.expectedDigit && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground">Expect: {data.expectedDigit}</div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="failure"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-red-700"
        style={{ left: '70%' }}
      />
    </div>
  );
}
