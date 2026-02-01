import { fromNode } from '@/models'
import { fetchExtended, type ApiResponse } from '@/services'
import type { AppNode } from '@xyflow/react'

export const updateNodes = async (
  projectId: string,
  flowId: string,
  nodes: AppNode[],
) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/nodes`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nodes.map((node) => fromNode(node))),
    },
  )

  return response.body
}
