import type { ModelNode } from '@/models/node'
import { fetchExtended, type ApiResponse } from '@/services'

export const addNodes = async (
  projectId: string,
  flowId: string,
  nodes: ModelNode[],
) => {
  const response = await fetchExtended<ApiResponse<string[]>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/nodes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nodes),
    },
  )

  return response.body.data
}
