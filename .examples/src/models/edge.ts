import type { AppEdge } from '@xyflow/react'

export interface ModelEdge {
  id: string
  source: string
  target: string
  type: string
  label: string
  hidden: boolean
  markerEnd?: {
    width: number
    height: number
    type: string
    color: string
  }
  updateAt?: string
  createAt?: string
}

export function toEdge(edge: ModelEdge): AppEdge {
  const appEdge: AppEdge = {
    id: edge.id,
    type: edge.type,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    hidden: edge.hidden ?? false,
  }
  return appEdge
}

export function fromEdge(edge: AppEdge): ModelEdge {
  const modelEdge: ModelEdge = {
    id: edge.id,
    type: edge.type,
    source: edge.source,
    target: edge.target,
    label: edge.data?.condition ?? '',
    hidden: edge.hidden ?? false,
  }

  if (edge.markerEnd && typeof edge.markerEnd === 'object') {
    modelEdge.markerEnd = {
      width: edge.markerEnd.width!,
      height: edge.markerEnd.height!,
      type: edge.markerEnd.type,
      color: edge.markerEnd.color!,
    }
  }

  return modelEdge
}
