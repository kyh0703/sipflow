import type { AppNode, CustomNodeType, XYPosition } from '@xyflow/react'

export interface ModelNode {
  id: string
  type: string
  width: number
  height: number
  position: XYPosition
  hidden: boolean
  updateAt?: string
  createAt?: string
}

export function toNode(node: ModelNode): AppNode {
  return {
    id: node.id,
    type: node.type as CustomNodeType,
    position: node.position,
    width: node.width,
    height: node.height,
    hidden: node.hidden,
    data: {
      updateAt: node.updateAt,
      createAt: node.createAt,
    },
  }
}

export function fromNode(node: AppNode): ModelNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width ?? 0,
    height: node.height ?? 0,
    hidden: node.hidden ?? false,
  }
}
