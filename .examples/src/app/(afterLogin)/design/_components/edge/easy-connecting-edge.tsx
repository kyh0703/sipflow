'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useInternalNode,
  type CustomEdgeProps,
} from '@xyflow/react'
import { getEdgeParams } from '../../_utils'

export function EasyConnectingEdge({
  id,
  selected,
  source,
  sourceX,
  sourceY,
  sourcePosition,
  target,
  targetX,
  targetY,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  data,
  selectable,
  deletable,
  sourceHandleId,
  targetHandleId,
  pathOptions,
  ...props
}: CustomEdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null
  const shouldShowPoints =
    selected || sourceNode.selected || targetNode.selected

  const { sx, sy, tx, ty } = getEdgeParams(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  )

  const [edgePath] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        {...props}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 1,
          strokeDasharray: selected ? '5 5' : style?.strokeDasharray,
        }}
      />
      {!selected && (
        <EdgeLabelRenderer>
          <div
            // style={{
            //   transform: `translate(-50%, 50%) translate(${labelXY.x}px,${labelXY.y}px)`,
            // }}
            className="nodrag nopan text-bs text-background absolute z-10 rounded px-[1px] font-bold"
          >
            {data?.condition}
          </div>
        </EdgeLabelRenderer>
      )}
      {data?.points && <g></g>}
    </>
  )
}
