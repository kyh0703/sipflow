import { fromEdge } from '@/models/edge'
import type { ApiResponse } from '@/services'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { AppEdge } from '@xyflow/react'
import { addEdges } from '..'
import { toast } from 'sonner'

type Response = string[]
type Variables = { projectId: string; flowId: string; edges: AppEdge[] }
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useAddEdges = (options?: MutationOptions) => {
  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: ({ projectId, flowId, edges }) => {
      return addEdges(
        projectId,
        flowId,
        edges.map((edge) => fromEdge(edge)),
      )
    },
    onSuccess: (data, variables, context) => {
      if (options?.onSuccess) {
        options?.onSuccess(data, variables, context)
      }
    },
    onError: (error, variables, context) => {
      toast.error(error.message)

      if (options?.onError) {
        options?.onError(error, variables, context)
      }
    },
  })
}
