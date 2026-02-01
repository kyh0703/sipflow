import type { Flow } from '@/models/flow'
import { fetchExtended, type ApiResponse } from '@/services'
import type { PaginationResponse } from '@/services/types'

export const getFlows = async (
  projectId: string,
  pageParam = 1,
  pageSize = 10,
) => {
  const response = await fetchExtended<ApiResponse<PaginationResponse<Flow>>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows?page=${pageParam}&pageSize=${pageSize}`,
    {
      method: 'GET',
    },
  )

  return response.body.data
}
