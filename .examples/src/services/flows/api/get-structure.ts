import { toEdge, type ModelEdge } from '@/models/edge'
import { toNode, type ModelNode } from '@/models/node'
import { fetchExtended, type ApiResponse } from '@/services'

export const getStructure = async (projectId: string, flowId: string) => {
  const response = await fetchExtended<
    ApiResponse<{
      nodes: ModelNode[]
      edges: ModelEdge[]
    }>
  >(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/structure`,
    {
      method: 'GET',
    },
  )

  return {
    nodes: response.body.data.nodes.map((node) => toNode(node)),
    edges: response.body.data.edges.map((edge) => toEdge(edge)),
  }
}
