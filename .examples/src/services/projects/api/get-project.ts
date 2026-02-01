import type { Project } from '@/models/project'
import { fetchExtended, type ApiResponse } from '@/services'

export const getProject = async (id: string) => {
  const response = await fetchExtended<ApiResponse<Project>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${id}`,
    {
      method: 'GET',
    },
  )

  return response.body.data
}
