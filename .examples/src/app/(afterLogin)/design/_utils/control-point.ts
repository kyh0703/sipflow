import type { ControlPointData, XYPosition } from '@xyflow/react'
import { getEdgeParams } from '.'

export const isControlPoint = (
  point: ControlPointData | XYPosition,
): point is ControlPointData => 'id' in point

export const getPathPoint = (positions: any[]) => {
  const points: any[] = []
  for (let i = 0; i < positions.length - 1; i++) {
    const source = positions[i]
    const target = positions[i + 1]
    const { sx, sy, tx, ty } = getEdgeParams(source, target)
    points.push({ ...source, x: sx, y: sy })
    if (i === positions.length - 2) {
      points.push({ ...target, x: tx, y: ty })
    }
  }
  return points
}
