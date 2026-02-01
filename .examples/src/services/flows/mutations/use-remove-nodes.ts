import type { ApiResponse } from '@/services/types'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { removeNodes } from '..'

type Response = ApiResponse<null>
type Variables = { projectId: string; flowId: string; ids: string[] }
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useRemoveNodes = (options?: MutationOptions) => {
  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: ({ projectId, flowId, ids }) => {
      return removeNodes(projectId, flowId, ids)
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
