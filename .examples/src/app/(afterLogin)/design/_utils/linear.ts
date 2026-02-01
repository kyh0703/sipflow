import type { ControlPointData, XYPosition } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { isControlPoint } from './control-point'

export function getLinearPath(points: XYPosition[]) {
  if (points.length < 1) {
    return ''
  }

  let path = `M ${points[0].x} ${points[0].y}`
  for (const element of points) {
    path += ` L ${element.x} ${element.y}`
  }

  return path
}

export function getLinearControlPoints(
  points: (ControlPointData | XYPosition)[],
) {
  const controlPoints: ControlPointData[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]

    if (isControlPoint(p1)) {
      controlPoints.push(p1)
    }

    controlPoints.push({
      prev: 'id' in p1 ? p1.id : undefined,
      id: uuidv4(),
      active: false,
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    })
  }

  return controlPoints
}

export function getLinearLabelXY(
  points: (ControlPointData | XYPosition)[],
): XYPosition {
  if (points.length < 2) {
    throw new Error('getLinearLabelXY: points.length < 2')
  }

  if (points.length === 2) {
    const p1 = points[0]
    const p2 = points[1]
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2 - 10,
    }
  }

  const index = Math.floor(points.length / 2)
  if (index % 2 === 0 && points.length % 2 === 0) {
    const p1 = points[index - 1]
    const p2 = points[index]
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2 - 10,
    }
  }

  const p1 = points[index]
  return {
    x: p1.x,
    y: p1.y - 10,
  }
}
