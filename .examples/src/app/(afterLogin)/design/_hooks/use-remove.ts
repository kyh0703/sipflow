import logger from '@/lib/logger'
import { useRemoveEdges, useRemoveNodes } from '@/services/flows'
import { useReactFlow, type AppEdge, type AppNode } from '@xyflow/react'
import { useCallback, useRef } from 'react'
import { useYjs } from '../_contexts'
import { useEdgeOperations } from './use-edge-operations'
import { useNodeOperations } from './use-node-operations'

export function useRemove() {
  const processRef = useRef<boolean>(false)
  const { projectId, flowId } = useYjs()
  const { getNode, getNodes, getEdges, deleteElements } = useReactFlow<
    AppNode,
    AppEdge
  >()

  const { getSelectedNodes } = useNodeOperations()
  const { getSelectedEdgesByNodes } = useEdgeOperations()

  const { mutateAsync: removeNodes } = useRemoveNodes()
  const { mutateAsync: removeEdges } = useRemoveEdges()

  const canRemove = useCallback((): boolean => {
    return (
      getNodes().some((node) => node.selected) ||
      getEdges().some((edge) => edge.selected)
    )
  }, [getEdges, getNodes])

  const removeNodeById = useCallback(
    async (nodeId: string) => {
      if (processRef.current) return
      processRef.current = true

      try {
        const node = getNode(nodeId)
        if (!node) return

        const selectedNodes = [node]
        const selectedEdges = getSelectedEdgesByNodes(selectedNodes)
        const selectedNodesIds = selectedNodes.map((node) => node.id)
        const selectedEdgesIds = selectedEdges.map((edge) => edge.id)

        if (selectedNodesIds.length === 0 && selectedEdgesIds.length === 0) {
          return
        }
        if (selectedNodesIds.length > 0) {
          await removeNodes({ projectId, flowId, ids: selectedNodesIds })
        }
        if (selectedEdgesIds.length > 0) {
          await removeEdges({ projectId, flowId, ids: selectedEdgesIds })
        }

        deleteElements({ nodes: selectedNodes, edges: selectedEdges })
      } catch (error) {
        logger.error(error)
      } finally {
        processRef.current = false
      }
    },
    [deleteElements, getNode],
  )

  const removeSelectedNodes = useCallback(async () => {
    if (processRef.current) return
    processRef.current = true

    try {
      const selectedNodes = getSelectedNodes()
      const selectedEdges = getSelectedEdgesByNodes(selectedNodes)
      const selectedNodesIds = selectedNodes.map((node) => node.id)
      const selectedEdgesIds = selectedEdges.map((edge) => edge.id)

      if (selectedNodesIds.length === 0 && selectedEdgesIds.length === 0) {
        return
      }
      if (selectedNodesIds.length > 0) {
        await removeNodes({ projectId, flowId, ids: selectedNodesIds })
      }
      if (selectedEdgesIds.length > 0) {
        await removeEdges({ projectId, flowId, ids: selectedEdgesIds })
      }

      deleteElements({ nodes: selectedNodes, edges: selectedEdges })
    } catch (error) {
      logger.error('failed to remove nodes and edges', error)
    } finally {
      processRef.current = false
    }
  }, [deleteElements, getSelectedNodes])

  return {
    canRemove,
    removeNodeById,
    removeSelectedNodes,
  }
}
