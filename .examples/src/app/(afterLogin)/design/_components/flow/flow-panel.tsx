'use client'

import { useQueryStructure } from '@/services/flows'
import { useSelectedNodeId } from '@/stores/flow-store'
import { useYjs } from '../../_contexts'
import { Flow } from './flow'
import { useSuspenseQuery } from '@tanstack/react-query'

export function FlowPanel() {
  const { projectId, flowId } = useYjs()

  const selectedNodeId = useSelectedNodeId()

  const { data } = useSuspenseQuery(useQueryStructure(projectId, flowId))

  return (
    <div className="flex h-full w-full bg-blue-100">
      <Flow initialNodes={data.nodes} initialEdges={data.edges} />
      {selectedNodeId && <div>Selected Node: {selectedNodeId}</div>}
    </div>
  )
}
