import type { NodeProps } from '@xyflow/react';
import { Phone } from 'lucide-react';
import type { SipInstanceNode } from '../../types/scenario';
import { DEFAULT_CODECS } from '../../types/scenario';
import { useFlowEditorValidationErrors } from '../../store/flow-editor-context';
import { useExecutionStatus } from '../../store/execution-store';
import { Badge } from '@/components/ui/badge';
import { NodeShell } from './node-shell';
import { usePbxInstances, type PbxInstanceSettings } from '../../store/app-settings-store';

function getPbxInstanceLabel(instance: PbxInstanceSettings) {
  if (instance.name.trim()) {
    return instance.name;
  }

  if (instance.host.trim()) {
    return `${instance.host}:${instance.port || '5060'}`;
  }

  return 'Unnamed PBX';
}

export function SipInstanceNode({ data, id }: NodeProps<SipInstanceNode>) {
  const validationErrors = useFlowEditorValidationErrors();
  const pbxInstances = usePbxInstances();
  const hasError = validationErrors.some((error) => error.nodeId === id);
  const status = useExecutionStatus();
  const isActive = status === 'running';
  const displayName = data.dn || data.label || 'SIP Instance';
  const codecs = data.codecs && data.codecs.length > 0 ? data.codecs : DEFAULT_CODECS;
  const selectedPbxInstanceId = data.pbxInstanceId || data.serverId;
  const selectedPbxInstance = selectedPbxInstanceId
    ? pbxInstances.find((instance) => instance.id === selectedPbxInstanceId)
    : null;
  const pbxLabel = selectedPbxInstance ? getPbxInstanceLabel(selectedPbxInstance) : 'No PBX instance';
  const pbxEndpoint = selectedPbxInstance?.host
    ? `${selectedPbxInstance.host}:${selectedPbxInstance.port || '5060'}`
    : null;

  return (
    <NodeShell
      nodeId={id}
      category="SIP / Instance"
      source={data.mode}
      title={displayName}
      icon={<Phone className="h-4 w-4" />}
      status={hasError ? 'error' : isActive ? 'running' : null}
      summary={pbxLabel}
      showTargetHandle={false}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
            {data.mode}
          </Badge>
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
            {pbxLabel}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">PBX</span>
          <span className="max-w-[148px] truncate font-medium text-card-foreground" title={pbxEndpoint ?? pbxLabel}>
            {pbxEndpoint ?? pbxLabel}
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
