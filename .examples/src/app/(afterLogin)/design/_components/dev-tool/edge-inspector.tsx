'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Panel, useEdges } from '@xyflow/react'

type EdgeInfoProps = {
  id: string
  type?: string
  source: string
  target: string
}

function EdgeInfo({ id, type, source, target }: Readonly<EdgeInfoProps>) {
  return (
    <div className="text-xs">
      <div>
        👣 {type} {id}
      </div>
      <div>source: {source}</div>
      <div>target: {target}</div>
    </div>
  )
}

export function EdgeInspector() {
  const edges = useEdges()

  return (
    <Panel position="center-left">
      <ScrollArea className="h-[200px]">
        {edges.map((edge) => {
          const source = edge.source
          const target = edge.target

          return (
            <EdgeInfo
              key={edge.id}
              id={edge.id}
              type={edge.type}
              source={source}
              target={target}
            />
          )
        })}
      </ScrollArea>
    </Panel>
  )
}
