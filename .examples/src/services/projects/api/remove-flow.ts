import { fetchExtended, type ApiResponse } from '@/services'

export const removeFlow = async (projectId: string, flowId: string) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}`,
    {
      method: 'DELETE',
    },
  )

  return response.body
}
