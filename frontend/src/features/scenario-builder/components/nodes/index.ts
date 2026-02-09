import { SipInstanceNode } from './SipInstanceNode';
import { CommandNode } from './CommandNode';
import { EventNode } from './EventNode';

// ReactFlow requires nodeTypes to be a stable reference (defined outside components)
export const nodeTypes = {
  sipInstance: SipInstanceNode,
  command: CommandNode,
  event: EventNode,
};

// Re-export node components
export { SipInstanceNode, CommandNode, EventNode };
