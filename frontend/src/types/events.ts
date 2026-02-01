/**
 * Event names following "domain:action" convention
 */
export const EVENTS = {
  FRONTEND_READY: 'frontend:ready',
  BACKEND_READY: 'backend:ready',
  FLOW_SAVED: 'flow:saved',
  FLOW_LOADED: 'flow:loaded',
  SIMULATION_NODE_STARTED: 'simulation:node-started',
  SIMULATION_NODE_COMPLETED: 'simulation:node-completed',
} as const

/**
 * Event payload types
 */
export interface FrontendReadyPayload {
  timestamp: number
}

export interface BackendReadyPayload {
  timestamp: number
}

export interface FlowSavedPayload {
  flowId: number
  name: string
}

export interface FlowLoadedPayload {
  flowId: number
  name: string
  nodeCount: number
  edgeCount: number
}

export interface SimulationNodeStartedPayload {
  nodeId: string
  timestamp: number
}

export interface SimulationNodeCompletedPayload {
  nodeId: string
  timestamp: number
  success: boolean
}
