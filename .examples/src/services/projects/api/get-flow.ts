import type { Flow } from '@/models/flow'
import { fetchExtended, type ApiResponse } from '@/services'

export const getFlow = async (projectId: string, flowId: string) => {
  const response = await fetchExtended<ApiResponse<Flow>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}`,
    {
      method: 'GET',
    },
  )

  return response.body.data
}
