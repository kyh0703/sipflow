import type { Flow } from '@/models/flow'
import { fetchExtended, type ApiResponse } from '@/services'

export const updateFlow = async (
  projectId: string,
  flowId: string,
  data: Partial<Flow>,
) => {
  const response = await fetchExtended<ApiResponse<Flow>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  )

  return response.body
}
