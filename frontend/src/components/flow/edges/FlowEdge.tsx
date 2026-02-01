import {
  BaseEdge,
  getStraightPath,
  type EdgeProps,
  MarkerType,
} from '@xyflow/react'
import type { SIPFlowEdgeData } from '@/types/nodes'

/**
 * Custom Flow Edge Component
 * Renders a straight line with arrow marker
 * Shows red color for invalid connections
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  const edgeData = data as SIPFlowEdgeData | undefined
  const isValid = edgeData?.isValid !== false

  const markerEndId = `arrow-${isValid ? 'valid' : 'invalid'}`

  return (
    <>
      <defs>
        <marker
          id={markerEndId}
          markerWidth="20"
          markerHeight="20"
          refX="10"
          refY="10"
          orient="auto"
        >
          <polyline
            points="0,0 20,10 0,20"
            fill="none"
            stroke={isValid ? 'currentColor' : 'rgb(239 68 68)'}
            strokeWidth="2"
          />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isValid ? 'currentColor' : 'rgb(239 68 68)',
          strokeWidth: 2,
        }}
        markerEnd={`url(#${markerEndId})`}
      />
    </>
  )
}
