import type { AppEdge, Connection, IsValidConnection } from '@xyflow/react'

export const isValidConnection: IsValidConnection<AppEdge> = (
  edge: AppEdge | Connection,
) => {
  if (edge.source === edge.target) {
    return false
  }
  return true
}
