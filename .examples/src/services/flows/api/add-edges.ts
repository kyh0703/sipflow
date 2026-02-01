import type { ModelEdge } from '@/models/edge'
import { fetchExtended, type ApiResponse } from '@/services'

export const addEdges = async (
  projectId: string,
  flowId: string,
  edges: ModelEdge[],
) => {
  const response = await fetchExtended<ApiResponse<string[]>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/edges`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edges),
    },
  )

  return response.body.data
}
