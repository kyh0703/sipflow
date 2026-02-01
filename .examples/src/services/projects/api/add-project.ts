import type { Project } from '@/models/project'
import { fetchExtended, type ApiResponse } from '@/services'

export const addProject = async (project: Omit<Project, 'id'>) => {
  const response = await fetchExtended<
    ApiResponse<{ id: string; updateTime: Date }>
  >(`${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(project),
  })

  return response.body.data
}
