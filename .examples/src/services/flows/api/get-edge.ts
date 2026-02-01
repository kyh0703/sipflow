import { toEdge, type ModelEdge } from '@/models/edge'
import { fetchExtended, type ApiResponse } from '@/services'

export const getEdge = async (
  projectId: string,
  flowId: string,
  edgeId: string,
) => {
  const response = await fetchExtended<ApiResponse<ModelEdge>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/edges/${edgeId}`,
    {
      method: 'GET',
    },
  )

  return toEdge(response.body.data)
}
