import { memo } from 'react'
import type { NodeTypes } from '@xyflow/react'
import { SIPInstanceNode } from './SIPInstanceNode'
import { CommandNode } from './CommandNode'
import { EventNode } from './EventNode'

/**
 * Module-level nodeTypes definition
 * CRITICAL: Must be defined at module level (not inside component)
 * to prevent ReactFlow performance collapse from re-creating types on every render
 */
export const nodeTypes = {
  sipInstance: memo(SIPInstanceNode),
  command: memo(CommandNode),
  event: memo(EventNode),
} satisfies NodeTypes
