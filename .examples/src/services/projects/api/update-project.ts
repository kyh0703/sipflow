import type { Project } from '@/models/project'
import { fetchExtended, type ApiResponse } from '@/services'

export const updateProject = async (id: string, data: Partial<Project>) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${id}`,
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
