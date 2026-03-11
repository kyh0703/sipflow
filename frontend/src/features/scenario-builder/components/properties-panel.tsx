import { useScenarioFlow } from '../context/scenario-flow-context';
import { SipInstanceProperties } from './properties/sip-instance-properties';
import { CommandProperties } from './properties/command-properties';
import { EventProperties } from './properties/event-properties';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useExecutionReadOnly } from '../hooks/use-execution';
import { FileQuestion } from 'lucide-react';
import type { SipInstanceNode, CommandNode, EventNode } from '../types/scenario';

export function PropertiesPanel() {
  const { selectedNode, sipInstanceNodes, updateNodeData } = useScenarioFlow();
  const isReadOnly = useExecutionReadOnly();

  // Empty state
  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileQuestion className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm text-center px-4">
          Select a node to edit properties
        </p>
      </div>
    );
  }

  // Node type badge color mapping
  const getNodeTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'sipInstance':
        return 'default';
      case 'command':
        return 'secondary';
      case 'event':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getNodeTypeLabel = (type: string): string => {
    switch (type) {
      case 'sipInstance':
        return 'SIP Instance';
      case 'command':
        return 'Command';
      case 'event':
        return 'Event';
      default:
        return type;
    }
  };

  const handleUpdate = (data: Partial<any>) => {
    updateNodeData(selectedNode.id, data);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={getNodeTypeBadgeVariant(selectedNode.type ?? 'command')}>
            {getNodeTypeLabel(selectedNode.type ?? 'command')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {selectedNode.id}
        </p>
      </div>

      <Separator />

      {/* Properties Form */}
      {isReadOnly && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          실행 중에는 속성을 수정할 수 없습니다.
        </div>
      )}

      <div className={isReadOnly ? 'pointer-events-none opacity-60' : undefined}>
        {selectedNode.type === 'sipInstance' && (
          <SipInstanceProperties
            node={selectedNode as SipInstanceNode}
            onUpdate={handleUpdate}
          />
        )}

        {selectedNode.type === 'command' && (
          <CommandProperties
            node={selectedNode as CommandNode}
            sipInstanceNodes={sipInstanceNodes}
            onUpdate={handleUpdate}
          />
        )}

        {selectedNode.type === 'event' && (
          <EventProperties
            node={selectedNode as EventNode}
            sipInstanceNodes={sipInstanceNodes}
            onUpdate={handleUpdate}
          />
        )}
      </div>
    </div>
  );
}
