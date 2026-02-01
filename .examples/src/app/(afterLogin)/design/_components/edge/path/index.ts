import { Position, type XYPosition } from '@xyflow/react'

export function getPath(
  points: XYPosition[],
  sides = { fromSide: Position.Left, toSide: Position.Right },
) {
  if (points.length < 2) return ''

  const [from, ...rest] = points
  const to = rest.pop() || from

  const fromX = from.x
  const fromY = from.y
  const toX = to.x
  const toY = to.y

  // Create a straight line path between the two points
  return `M${fromX},${fromY} L${toX},${toY}`
}
