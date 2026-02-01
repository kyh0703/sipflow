'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { EdgeLabelRenderer, useNodes } from '@xyflow/react'

type NodeInfoProps = {
  id: string
  type: string
  parentId?: string
  selected?: boolean
  x: number
  y: number
  width?: number
  height?: number
  data: any
}

function NodeInfo({
  id,
  type,
  parentId,
  selected,
  x,
  y,
  width,
  height,
  data,
}: Readonly<NodeInfoProps>) {
  if (!width || !height) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(${x}px, ${y + height}px)`,
        width: width * 2,
      }}
    >
      <div>id: {id}</div>
      <div>type: {type}</div>
      <div>parent: {parentId}</div>
      <div>selected: {selected ? 'true' : 'false'}</div>
      <div>
        position: {x.toFixed(1)}, {y.toFixed(1)}
      </div>
      <div>
        dimensions: {width} × {height}
      </div>
      <div>data: {JSON.stringify(data, null, 2)}</div>
    </div>
  )
}

export function NodeInspector() {
  const nodes = useNodes()

  return (
    <EdgeLabelRenderer>
      <ScrollArea>
        {nodes.map((node) => {
          const x = node.position.x || 0
          const y = node.position.y || 0
          const width = node.measured?.width ?? 0
          const height = node.measured?.height ?? 0

          return (
            <NodeInfo
              key={node.id}
              id={node.id}
              parentId={node.parentId}
              selected={node.selected}
              type={node.type ?? 'default'}
              x={x}
              y={y}
              width={width}
              height={height}
              data={node.data}
            />
          )
        })}
      </ScrollArea>
    </EdgeLabelRenderer>
  )
}
