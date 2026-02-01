import type { EdgeTypes } from '@xyflow/react'
import { FlowEdge } from './FlowEdge'

/**
 * Module-level edgeTypes definition
 * Must be defined at module level to prevent re-creation on every render
 */
export const edgeTypes = {
  flowEdge: FlowEdge,
} satisfies EdgeTypes
