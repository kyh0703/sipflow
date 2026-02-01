'use client'

import { cn } from '@/lib'
import { useConnectionLinePath, useFlowActions } from '@/stores/flow-store'
import {
  type ConnectionLineComponentProps,
  getStraightPath,
} from '@xyflow/react'
import { useState } from 'react'

const DISTANCE = 25

export function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: Readonly<ConnectionLineComponentProps>) {
  const connectionLinePath = useConnectionLinePath()
  const { setConnectionLinePath } = useFlowActions()
  const [freeDrawing, setFreeDrawing] = useState(false)

  // Check how far the cursor is from the last point in the path
  // and add a new point if it's far enough
  const prev = connectionLinePath[connectionLinePath.length - 1] ?? {
    x: fromX,
    y: fromY,
  }
  const distance = Math.hypot(prev.x - toX, prev.y - toY)
  const shouldAppPoint = freeDrawing && distance > DISTANCE

  const path = ''

  return (
    <g>
      <path
        className={cn(
          'stroke-foreground stroke-1',
          connectionStatus === 'valid' ? '' : 'animated',
        )}
        d={path}
        fill="none"
      />
      <circle
        className="stroke-foreground stroke-1"
        cx={toX}
        cy={toY}
        r={3}
        strokeWidth={1.5}
      />
    </g>
  )
}
