import type { Project } from '@/models/project'
import { fetchExtended, type ApiResponse } from '@/services'
import type { PaginationResponse } from '@/services/types'

export const getProjects = async (pageParam = 1, pageSize = 10) => {
  const response = await fetchExtended<
    ApiResponse<PaginationResponse<Project>>
  >(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects?page=${pageParam}&pageSize=${pageSize}`,
    {
      method: 'GET',
    },
  )

  return response.body.data
}
