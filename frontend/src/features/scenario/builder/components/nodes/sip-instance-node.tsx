import type { NodeProps } from '@xyflow/react';
import { Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useExecutionStatus } from '@/features/execution/store/execution-store';
import { usePbxInstances, type PbxInstanceSettings } from '@/features/settings/store/app-settings-store';
import type { SipInstanceNode } from '../../types/scenario';
import { DEFAULT_CODECS } from '../../types/scenario';
import { useFlowEditorValidationErrors } from '../../store/flow-editor-context';
import { NodeShell } from './node-shell';

function getSipInstanceLabel(instance: PbxInstanceSettings) {
  if (instance.name.trim()) {
    return instance.name;
  }

  if (instance.host.trim()) {
    return `${instance.host}:${instance.port || '5060'}`;
  }

  return 'Unnamed SIP';
}

export function SipInstanceNode({ data, id, selected }: NodeProps<SipInstanceNode>) {
  const validationErrors = useFlowEditorValidationErrors();
  const sipInstances = usePbxInstances();
  const hasError = validationErrors.some((error) => error.nodeId === id);
  const status = useExecutionStatus();
  const isActive = status === 'running';
  const displayName = data.dn || data.label || 'SIP Instance';
  const codecs = data.codecs && data.codecs.length > 0 ? data.codecs : DEFAULT_CODECS;
  const selectedPbxInstanceId = data.pbxInstanceId || data.serverId;
  const selectedSipInstance = selectedPbxInstanceId
    ? sipInstances.find((instance) => instance.id === selectedPbxInstanceId)
    : null;
  const sipLabel = selectedSipInstance ? getSipInstanceLabel(selectedSipInstance) : 'No SIP instance';
  const sipEndpoint = selectedSipInstance?.host
    ? `${selectedSipInstance.host}:${selectedSipInstance.port || '5060'}`
    : null;

  return (
    <NodeShell
      nodeId={id}
      category="SIP / Instance"
      source={data.register ? 'Register On' : 'Register Off'}
      title={displayName}
      icon={<Smartphone className="h-4 w-4" />}
      selected={selected}
      status={hasError ? 'error' : isActive ? 'running' : null}
      summary={sipLabel}
      showTargetHandle={false}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
            {data.register ? 'Register On' : 'Register Off'}
          </Badge>
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
            {sipLabel}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">SIP</span>
          <span className="max-w-[148px] truncate font-medium text-card-foreground" title={sipEndpoint ?? sipLabel}>
            {sipEndpoint ?? sipLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Codecs</span>
          <span className="max-w-[148px] truncate font-medium text-card-foreground" title={codecs.join(', ')}>
            {codecs.join(', ')}
          </span>
        </div>
      </div>
    </NodeShell>
  );
}
