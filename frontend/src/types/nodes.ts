import { Node, Edge } from '@xyflow/react'

/**
 * SIP Instance Node Data
 * Represents a SIP UA instance with server configuration
 */
export interface SIPInstanceNodeData extends Record<string, unknown> {
  label: string
  server?: string
  transport?: 'UDP' | 'TCP' | 'TLS'
}

/**
 * Command types available in SIP flow
 */
export type CommandType =
  | 'makeCall'
  | 'hold'
  | 'retrieve'
  | 'blindTransfer'
  | 'muteTransfer'
  | 'bye'
  | 'cancel'
  | 'busy'

/**
 * Command Node Data
 * Represents a SIP command action with type-specific fields
 */
export interface CommandNodeData extends Record<string, unknown> {
  label: string
  command: CommandType
  // Command-specific fields
  targetUri?: string // for makeCall
  sessionId?: string // for hold, retrieve, bye
  transferTarget?: string // for transfers
}

/**
 * Event types available in SIP flow
 */
export type EventType = 'wait'

/**
 * Event Node Data
 * Represents a wait/delay event in the flow
 */
export interface EventNodeData extends Record<string, unknown> {
  label: string
  eventType: EventType
  timeout?: number // milliseconds
}

/**
 * Discriminated union of all SIP flow node types
 */
export type SIPFlowNode =
  | Node<SIPInstanceNodeData, 'sipInstance'>
  | Node<CommandNodeData, 'command'>
  | Node<EventNodeData, 'event'>

/**
 * SIP Flow Edge with validation state
 */
export interface SIPFlowEdgeData extends Record<string, unknown> {
  isValid?: boolean
}

export type SIPFlowEdge = Edge<SIPFlowEdgeData>
