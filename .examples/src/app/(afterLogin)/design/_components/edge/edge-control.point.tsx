'use client'

import {
  useReactFlow,
  useStore,
  type AppEdge,
  type AppNode,
  type ControlPointData,
} from '@xyflow/react'
import { useRef, useState } from 'react'

type ControlPointProps = {
  id: string
  index: number
  x: number
  y: number
  color: string
  active?: boolean
  setControlPoint: (
    update: (points: ControlPointData[]) => ControlPointData[],
  ) => void
}

export function ControlPoint({
  id,
  index,
  x,
  y,
  color,
  active,
  setControlPoint,
}: Readonly<ControlPointProps>) {
  const ref = useRef<SVGCircleElement>(null)
  const container = useStore((store) => store.domNode)
  const { screenToFlowPosition } = useReactFlow<AppNode, AppEdge>()
  const [dragging, setDragging] = useState(false)

  return (
    <circle
      ref={ref}
      className={'nopan nodrag' + (active ? ' active' : '')}
      tabIndex={0}
      id={id}
      cx={x}
      cy={y}
      r={active ? 4 : 3}
      strokeOpacity={active ? 1 : 0.3}
      stroke={color}
      fill={active ? color : 'transparent'}
    />
  )
}
