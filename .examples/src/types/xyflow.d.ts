import {
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react'

declare module '@xyflow/react' {
  type HelperLine = number | undefined

  type Group = {
    width: number
    height: number
    collapsed: boolean
  }

  type Style = {
    color: string
    backgroundColor: string
    borderColor: string
    borderStyle: string
    opacity: string
    fontSize: string
    hidden: boolean
  }

  type CustomNodeData = {
    label: string
    updateAt: string
    createAt: string
  }

  type CustomNodeType = 'start' | 'jenkins'

  type AppNode = Node<Partial<CustomNodeData>, CustomNodeType>
  type CustomNodeProps = NodeProps<AppNode>

  type ControlPointData = XYPosition & {
    id: string
    active?: boolean
    prev?: string
  }

  type CustomEdgeData = {
    flowId: number
    databaseId: number
    condition: string
    points: ControlPointData[]
  }

  type CustomEdgeType = 'start' | BuiltInEdge

  type AppEdge = Edge<Partial<CustomEdgeData>, CustomEdgeType>
  type CustomEdgeProps = EdgeProps<AppEdge>
}
