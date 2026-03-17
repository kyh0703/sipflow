import type { NodeProps } from '@xyflow/react';
import { Phone, PhoneIncoming, PhoneOff, Volume2, Hash, Pause, Play, ArrowRightLeft } from 'lucide-react';
import type { CommandNode as CommandNodeType } from '../../types/scenario';
import {
  useFlowEditorNodes,
  useFlowEditorValidationErrors,
} from '../../store/flow-editor-context';
import { useExecutionNodeState } from '@/features/execution/store/execution-store';
import { NodeShell } from './node-shell';

const COMMAND_ICONS = {
  MakeCall: Phone,
  Answer: PhoneIncoming,
  Release: PhoneOff,
  PlayAudio: Volume2,
  SendDTMF: Hash,
  Hold: Pause,
  Retrieve: Play,
  BlindTransfer: ArrowRightLeft,
  MuteTransfer: ArrowRightLeft,
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

function getCommandSummary(data: CommandNodeType['data']): string | null {
  switch (data.command) {
    case 'MakeCall':
      return data.targetUri ?? null;
    case 'PlayAudio':
      return data.filePath?.split(/[\\/]/).pop() ?? null;
    case 'SendDTMF':
      return data.digits ? `Digits ${data.digits}` : null;
    case 'BlindTransfer':
      return data.targetUser
        ? `${data.targetUser}${data.targetHost ? `@${data.targetHost}` : ''}`
        : null;
    case 'MuteTransfer':
      return 'Consult transfer';
    default:
      return null;
  }
}

export function CommandNode({ data, id, selected }: NodeProps<CommandNodeType>) {
  const Icon = COMMAND_ICONS[data.command as keyof typeof COMMAND_ICONS] ?? Phone;
  const validationErrors = useFlowEditorValidationErrors();
  const nodes = useFlowEditorNodes();
  const hasError = validationErrors.some((error) => error.nodeId === id);
  const nodeExecState = useExecutionNodeState(id);
  const instanceNode = data.sipInstanceId
    ? nodes.find((node) => node.id === data.sipInstanceId)
    : null;
  const instanceLabel =
    typeof instanceNode?.data?.dn === 'string' && instanceNode.data.dn.length > 0
      ? instanceNode.data.dn
      : typeof instanceNode?.data?.label === 'string' && instanceNode.data.label.length > 0
      ? instanceNode.data.label
      : data.sipInstanceId
      ? 'Linked instance'
      : 'No instance';
  const details = [
    data.callId ? { label: 'Call ID', value: data.callId } : null,
    data.timeout ? { label: 'Timeout', value: `${data.timeout}ms` } : null,
    data.primaryCallId ? { label: 'Primary', value: data.primaryCallId } : null,
    data.consultCallId ? { label: 'Consult', value: data.consultCallId } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <NodeShell
      nodeId={id}
      category="Action / Command"
      source={instanceLabel}
      title={data.label}
      icon={<Icon className="h-4 w-4" />}
      selected={selected}
      status={nodeExecState?.status ? getExecutionState(nodeExecState.status) : hasError ? 'error' : null}
      summary={getCommandSummary(data)}
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
