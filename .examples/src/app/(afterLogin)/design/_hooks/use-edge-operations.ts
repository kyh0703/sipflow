import {
  MarkerType,
  useReactFlow,
  type AppEdge,
  type AppNode,
  type Connection,
  type ControlPointData,
  type CustomEdgeType,
} from '@xyflow/react'
import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

export function useEdgeOperations() {
  const { getEdges, setEdges } = useReactFlow<AppNode, AppEdge>()

  const edgeFactory = useCallback(
    (
      connection: Connection,
      type: CustomEdgeType,
      condition?: string,
      points: ControlPointData[] = [],
    ) => {
      const newEdge: AppEdge = {
        ...connection,
        id: uuidv4(),
        type,
        data: {
          condition,
        },
        zIndex: 10,
        reconnectable: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }

      return newEdge
    },
    [],
  )

  const getSelectedEdgesByNodes = useCallback((selectedNodes: AppNode[]) => {
    return getEdges().filter(
      (edge) =>
        selectedNodes.some(
          (node) => node.id === edge.source || node.id === edge.target,
        ) || edge.selected,
    )
  }, [])

  const getEdgeBySource = useCallback(
    (nodeId: string) => getEdges().find((edge) => edge.source === nodeId),
    [],
  )

  const getEdgesBySource = useCallback(
    (nodeId: string) => getEdges().filter((edge) => edge.source === nodeId),
    [],
  )

  const getEdgeByTarget = useCallback(
    (nodeId: string) => getEdges().find((edge) => edge.source === nodeId),
    [],
  )

  const getEdgesByTarget = useCallback(
    (nodeId: string) => getEdges().filter((edge) => edge.target === nodeId),
    [],
  )

  const setAnimated = useCallback((id: string, animated: boolean) => {
    setEdges((edges) =>
      edges.map((edge) => (edge.id === id ? { ...edge, animated } : edge)),
    )
  }, [])

  return {
    edgeFactory,
    getSelectedEdgesByNodes,
    getEdgeBySource,
    getEdgesBySource,
    getEdgeByTarget,
    getEdgesByTarget,
    setAnimated,
  }
}
