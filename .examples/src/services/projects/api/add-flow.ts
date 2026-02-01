import type { Flow } from '@/models/flow'
import { fetchExtended, type ApiResponse } from '@/services'

export const addFlow = async (projectId: string, flow: Omit<Flow, 'id'>) => {
  const response = await fetchExtended<
    ApiResponse<{ id: string; updateTime: Date }>
  >(`${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(flow),
  })

  return response.body.data
}
