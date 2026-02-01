import { toNode, type ModelNode } from '@/models/node'
import { fetchExtended, type ApiResponse } from '@/services'

export const getNode = async (
  projectId: string,
  flowId: string,
  nodeId: string,
) => {
  const response = await fetchExtended<ApiResponse<ModelNode>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${projectId}/flows/${flowId}/nodes/${nodeId}`,
    {
      method: 'GET',
    },
  )

  return toNode(response.body.data)
}
