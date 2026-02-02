import * as FlowServiceBindings from '../../wailsjs/go/handler/FlowService'
import type { ent, handler } from '../../wailsjs/go/models'

/**
 * Flow service wrapper providing typed access to backend FlowService
 */
export const flowService = {
  /**
   * Create a new flow
   * @param name - Flow name (required)
   * @param description - Flow description (optional)
   * @returns Promise with Response containing created Flow or error
   */
  async createFlow(
    name: string,
    description: string = ''
  ): Promise<handler.Response__sipflow_ent_Flow_> {
    return FlowServiceBindings.CreateFlow(name, description)
  },

  /**
   * Get a flow by ID with eager-loaded nodes and edges
   * @param id - Flow ID
   * @returns Promise with Response containing Flow or error
   */
  async getFlow(id: number): Promise<handler.Response__sipflow_ent_Flow_> {
    return FlowServiceBindings.GetFlow(id)
  },

  /**
   * List all flows as lightweight metadata ordered by updated_at descending
   * @returns Promise with Response containing FlowMeta array or error
   */
  async listFlows(): Promise<handler.Response_FlowMeta_> {
    return FlowServiceBindings.ListFlows()
  },

  /**
   * Delete a flow by ID
   * @param id - Flow ID
   * @returns Promise with Response containing boolean success or error
   */
  async deleteFlow(id: number): Promise<handler.Response_bool_> {
    return FlowServiceBindings.DeleteFlow(id)
  },

  /**
   * Save complete xyflow canvas state (nodes, edges, viewport) atomically
   * @param req - SaveFlowRequest with flowId (0 for new), name, nodes, edges, viewport
   * @returns Promise with Response containing flow ID or error
   */
  async saveFlow(req: handler.SaveFlowRequest): Promise<handler.Response_int_> {
    return FlowServiceBindings.SaveFlow(req)
  },

  /**
   * Load complete xyflow-compatible canvas state for a flow
   * @param id - Flow ID
   * @returns Promise with Response containing FlowState or error
   */
  async loadFlow(id: number): Promise<handler.Response_FlowState_> {
    return FlowServiceBindings.LoadFlow(id)
  },

  /**
   * Update the name of an existing flow
   * @param id - Flow ID
   * @param name - New flow name
   * @returns Promise with Response containing boolean success or error
   */
  async updateFlowName(id: number, name: string): Promise<handler.Response_bool_> {
    return FlowServiceBindings.UpdateFlowName(id, name)
  },
}

/**
 * Type guard to check if Response is successful
 */
export function isSuccess<T>(
  response: { success: boolean; data?: T; error?: handler.Error }
): response is { success: true; data: T } {
  return response.success
}

/**
 * Type guard to check if Response is an error
 */
export function isError<T>(
  response: { success: boolean; data?: T; error?: handler.Error }
): response is { success: false; error: handler.Error } {
  return !response.success
}

/**
 * Re-export types for convenience
 */
export type Flow = ent.Flow
export type FlowEdges = ent.FlowEdges
export type FlowMeta = handler.FlowMeta
export type FlowState = handler.FlowState
export type FlowNodeData = handler.FlowNodeData
export type FlowEdgeData = handler.FlowEdgeData
export type SaveFlowRequest = handler.SaveFlowRequest
