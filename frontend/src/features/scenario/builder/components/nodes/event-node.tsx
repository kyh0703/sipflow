import type { NodeProps } from '@xyflow/react';
import {
  Bell,
  PhoneMissed,
  BellRing,
  Clock,
  Pause,
  Play,
  ArrowRightLeft,
  Ear,
} from 'lucide-react';
import type { EventNode as EventNodeType } from '../../types/scenario';
import {
  useFlowEditorNodes,
  useFlowEditorValidationErrors,
} from '../../store/flow-editor-context';
import { useExecutionNodeState } from '@/features/execution/store/execution-store';
import { formatEventLabel } from '../../lib/event-label';
import { NodeShell } from './node-shell';

const EVENT_ICONS = {
  INCOMING: Bell,
  DISCONNECTED: PhoneMissed,
  RINGING: BellRing,
  TIMEOUT: Clock,
  HELD: Pause,
  RETRIEVED: Play,
  TRANSFERRED: ArrowRightLeft,
  DTMFReceived: Ear,
} as const;

function getExecutionState(status?: string): 'running' | 'completed' | 'failed' | null {
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

function getEventSummary(data: EventNodeType['data']): string | null {
  switch (data.event) {
    case 'TIMEOUT':
      return data.timeout ? `Wait ${data.timeout}ms` : 'Waiting for timeout';
    case 'DTMFReceived':
      return data.expectedDigit ? `Expect ${data.expectedDigit}` : 'Expect any digit';
    case 'INCOMING':
      return data.number ? `Wait for ${data.number}` : 'Wait for inbound call';
    default:
      return null;
  }
}

export function EventNode({ data, id, selected }: NodeProps<EventNodeType>) {
  const Icon = EVENT_ICONS[data.event as keyof typeof EVENT_ICONS] ?? Bell;
  const validationErrors = useFlowEditorValidationErrors();
  const nodes = useFlowEditorNodes();
  const hasError = validationErrors.some((error) => error.nodeId === id);
  const nodeExecState = useExecutionNodeState(id);
  const instanceNode = data.sipInstanceId
    ? nodes.find((node) => node.id === data.sipInstanceId)
    : null;
  const instanceLabel =
    data.event === 'INCOMING' && data.number
      ? data.number
      : typeof instanceNode?.data?.dn === 'string' && instanceNode.data.dn.length > 0
      ? instanceNode.data.dn
      : typeof instanceNode?.data?.label === 'string' && instanceNode.data.label.length > 0
      ? instanceNode.data.label
      : data.sipInstanceId
      ? 'Linked instance'
      : 'No instance';
  const details = [data.callId ? { label: 'Call ID', value: data.callId } : null].filter(Boolean) as Array<{
    label: string;
    value: string;
  }>;

  return (
    <NodeShell
      nodeId={id}
      category="Event / Wait"
      source={instanceLabel}
      title={formatEventLabel(data.event)}
      icon={<Icon className="h-4 w-4" />}
      selected={selected}
      status={nodeExecState?.status ? getExecutionState(nodeExecState.status) : hasError ? 'error' : null}
      summary={getEventSummary(data)}
    >
      {details.length > 0 ? (
        <div className="space-y-2">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{detail.label}</span>
              <span className="max-w-[132px] truncate font-medium text-card-foreground" title={detail.value}>
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </NodeShell>
  );
}
