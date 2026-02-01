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
   * List all flows ordered by updated_at descending
   * @returns Promise with Response containing Flow array or error
   */
  async listFlows(): Promise<handler.Response____sipflow_ent_Flow_> {
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
 * Re-export Flow type for convenience
 */
export type Flow = ent.Flow
export type FlowEdges = ent.FlowEdges
