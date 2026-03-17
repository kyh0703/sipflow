import {
  useFlowEditorActions,
  useFlowEditorNodes,
  useFlowEditorSelectedNodeId,
} from '../store/flow-editor-context';
import { SipInstanceProperties } from './properties/sip-instance-properties';
import { CommandProperties } from './properties/command-properties';
import { EventProperties } from './properties/event-properties';
import { FileQuestion } from 'lucide-react';
import type { SipInstanceNode, CommandNode, EventNode } from '../types/scenario';

export function PropertiesPanel() {
  const selectedNodeId = useFlowEditorSelectedNodeId();
  const nodes = useFlowEditorNodes();
  const { updateNodeData } = useFlowEditorActions();

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

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

  const handleUpdate = (data: Partial<any>) => {
    updateNodeData(selectedNode.id, data);
  };

  return (
    <div className="space-y-4">
      {/* Properties Form */}
      {selectedNode.type === 'sipInstance' && (
        <SipInstanceProperties
          node={selectedNode as SipInstanceNode}
          onUpdate={handleUpdate}
        />
      )}

      {selectedNode.type === 'command' && (
        <CommandProperties
          node={selectedNode as CommandNode}
          onUpdate={handleUpdate}
        />
      )}

      {selectedNode.type === 'event' && (
        <EventProperties
          node={selectedNode as EventNode}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
