import {
  Position,
  type InternalNode,
  type XYPosition
} from '@xyflow/react'

export type CalculatePosition = {
  width?: number
  height?: number
} & XYPosition

export const toPositionByInternalNode = (
  node: InternalNode,
): CalculatePosition => ({
  width: node.measured.width!,
  height: node.measured.height!,
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
})

// this helper function returns the intersection point
// of the line between the center of the intersectionNode and the target node
function getNodeIntersection(
  source: CalculatePosition,
  target: CalculatePosition,
): XYPosition {
  // https://math.stackexchange.com/questions/1724792/an-algorithm-for-finding-the-intersection-point-between-a-center-of-vision-and-a
  if (!source.width && !source.height) {
    return { x: source.x, y: source.y }
  }

  const sw = (source.width ?? 0) / 2
  const sh = (source.height ?? 0) / 2
  const tw = (target.width ?? 0) / 2
  const th = (target.height ?? 0) / 2

  const x2 = source.x + sw
  const y2 = source.y + sh
  const x1 = target.x + tw
  const y1 = target.y + th

  const xx1 = (x1 - x2) / (2 * sw) - (y1 - y2) / (2 * sh)
  const yy1 = (x1 - x2) / (2 * sw) + (y1 - y2) / (2 * sh)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  const x = sw * (xx3 + yy3) + x2
  const y = sh * (-xx3 + yy3) + y2

  return { x, y }
}

// returns the position (top,right,bottom or right) passed node compared to the intersection point
function getEdgePosition(node: CalculatePosition, point: XYPosition) {
  const nx = Math.round(node.x!)
  const ny = Math.round(node.y!)
  const px = Math.round(point.x)
  const py = Math.round(point.y)

  if (px <= nx + 1) {
    return Position.Left
  }
  if (px >= nx + (node.width ?? 0) - 1) {
    return Position.Right
  }
  if (py <= ny + 1) {
    return Position.Top
  }
  if (py >= node.y + (node.height ?? 0) - 1) {
    return Position.Bottom
  }

  return Position.Top
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(
  source: CalculatePosition,
  target: CalculatePosition,
) {
  const sourceIntersectionPoint = getNodeIntersection(source, target)
  const targetIntersectionPoint = getNodeIntersection(target, source)

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint)
  const targetPos = getEdgePosition(target, targetIntersectionPoint)

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  }
}
