import { fromEdge } from '@/models'
import { fetchExtended, type ApiResponse } from '@/services'
import type { AppEdge } from '@xyflow/react'

export const updateEdges = async (
  projectId: string,
  flowId: string,
  edges: AppEdge[],
) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/edges`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edges.map((edge) => fromEdge(edge))),
    },
  )

  return response.body
}
