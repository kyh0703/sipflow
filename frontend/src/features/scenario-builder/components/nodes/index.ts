import { SipInstanceNode } from './sip-instance-node';
import { CommandNode } from './command-node';
import { EventNode } from './event-node';

// ReactFlow requires nodeTypes to be a stable reference (defined outside components)
export const nodeTypes = {
  sipInstance: SipInstanceNode,
  command: CommandNode,
  event: EventNode,
};

// Re-export node components
export { SipInstanceNode, CommandNode, EventNode };
