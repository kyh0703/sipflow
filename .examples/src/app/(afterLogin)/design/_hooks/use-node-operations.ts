import {
  useReactFlow,
  type AppEdge,
  type AppNode,
  type CustomNodeType,
  type XYPosition,
} from '@xyflow/react'
import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

export function useNodeOperations() {
  const { setNodes, getNodes } = useReactFlow<AppNode, AppEdge>()

  const nodeFactory = useCallback(
    (position: XYPosition, type: CustomNodeType) => {
      const newNode: AppNode = {
        id: uuidv4(),
        position,
        width: 40,
        height: 40,
        zIndex: 0,
        type,
        data: {
          label: '',
        },
      }

      return newNode
    },
    [],
  )

  const getNodeType = useCallback(
    (id: string): CustomNodeType | undefined => {
      const node = getNodes().find((node) => node.id === id)
      return node?.type
    },
    [getNodes],
  )

  const getSelectedNodes = useCallback(() => {
    const nodeMap = new Map<string, AppNode>()

    getNodes().forEach((node) => {
      if (node.selected) {
        nodeMap.set(node.id, node)
      }
    })

    return Array.from(nodeMap.values())
  }, [getNodes])

  const setLabel = useCallback((id: string, label: string) => {
    setNodes((nodes) => {
      return nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node,
      )
    })
  }, [])

  return {
    nodeFactory,
    setLabel,
    getNodeType,
    getSelectedNodes,
  }
}
