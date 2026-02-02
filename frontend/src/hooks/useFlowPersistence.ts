import { useCallback } from 'react'
import { useReactFlow, type Node, type Edge } from '@xyflow/react'
import { useFlowStore } from '@/stores/flowStore'
import { useProjectStore } from '@/stores/projectStore'
import { flowService, isSuccess } from '@/services/flowService'
import type { FlowNodeData, FlowEdgeData } from '@/services/flowService'
import { handler } from '../../wailsjs/go/models'

/**
 * Convert xyflow Node[] to backend FlowNodeData[]
 * Unwraps position.x/y into positionX/positionY
 */
function nodesToBackend(nodes: Node[]): FlowNodeData[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type || '',
    positionX: node.position.x,
    positionY: node.position.y,
    data: node.data as Record<string, any>,
  }))
}

/**
 * Convert xyflow Edge[] to backend FlowEdgeData[]
 */
function edgesToBackend(edges: Edge[]): FlowEdgeData[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || '',
    targetHandle: edge.targetHandle || '',
    type: edge.type || 'flowEdge',
    data: (edge.data || {}) as Record<string, any>,
  }))
}

/**
 * Convert backend FlowNodeData[] to xyflow Node[]
 * Wraps positionX/positionY into position: { x, y }
 */
function nodesToXyflow(nodes: FlowNodeData[]): Node[] {
  return (nodes || []).map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.positionX, y: node.positionY },
    data: node.data || {},
  }))
}

/**
 * Convert backend FlowEdgeData[] to xyflow Edge[]
 */
function edgesToXyflow(edges: FlowEdgeData[]): Edge[] {
  return (edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    type: edge.type || 'flowEdge',
    data: edge.data || {},
  }))
}

/**
 * Hook for flow persistence operations (save/load/switch).
 * Must be used inside ReactFlowProvider since it uses useReactFlow().
 */
export function useFlowPersistence() {
  const { setViewport } = useReactFlow()

  const saveCurrentFlow = useCallback(async () => {
    const { projectPath, currentFlowId } = useProjectStore.getState()
    const { actions: projectActions } = useProjectStore.getState()

    if (!projectPath) {
      console.warn('No project open. Use File > New or File > Open first.')
      return
    }

    const { nodes, edges, viewport } = useFlowStore.getState()

    // Determine flow name - use existing name or default
    const currentFlow = useProjectStore.getState().flows.find(
      (f) => f.id === currentFlowId
    )
    const flowName = currentFlow?.name || 'Untitled Flow'

    try {
      const response = await flowService.saveFlow(
        handler.SaveFlowRequest.createFrom({
          flowId: currentFlowId || 0,
          name: flowName,
          nodes: nodesToBackend(nodes),
          edges: edgesToBackend(edges),
          viewportX: viewport.x,
          viewportY: viewport.y,
          viewportZoom: viewport.zoom,
        })
      )

      if (isSuccess(response)) {
        // Update currentFlowId if this was a new flow
        if (!currentFlowId && response.data) {
          projectActions.setCurrentFlowId(response.data)
        }
        projectActions.markClean()
        await projectActions.refreshFlowList()
        console.log('Flow saved successfully, ID:', response.data)
      } else {
        console.error('Failed to save flow:', response.error)
      }
    } catch (error) {
      console.error('Failed to save flow:', error)
    }
  }, [])

  const loadFlow = useCallback(async (flowId: number) => {
    try {
      const response = await flowService.loadFlow(flowId)

      if (isSuccess(response) && response.data) {
        const state = response.data
        const flowActions = useFlowStore.getState().actions
        const projectActions = useProjectStore.getState().actions

        // Convert and set nodes/edges
        flowActions.setNodes(nodesToXyflow(state.nodes))
        flowActions.setEdges(edgesToXyflow(state.edges))

        // Restore viewport
        setViewport({
          x: state.viewportX,
          y: state.viewportY,
          zoom: state.viewportZoom || 1,
        })

        // Update project state
        projectActions.setCurrentFlowId(flowId)
        projectActions.markClean()

        console.log('Flow loaded successfully, ID:', flowId)
      } else {
        console.error('Failed to load flow:', response.error)
      }
    } catch (error) {
      console.error('Failed to load flow:', error)
    }
  }, [setViewport])

  const switchFlow = useCallback(async (flowId: number) => {
    const { isDirty } = useProjectStore.getState()

    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Discard and switch flow?'
      )
      if (!confirmed) {
        return
      }
    }

    await loadFlow(flowId)
  }, [loadFlow])

  return { saveCurrentFlow, loadFlow, switchFlow }
}
