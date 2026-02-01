import type { ApiResponse } from '@/services'
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { removeFlow } from '../api'
import { projectKey } from '../keys'

type Response = ApiResponse<null>
type Variables = { projectId: string; flowId: string }
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useRemoveFlow = (options?: MutationOptions) => {
  const queryClient = useQueryClient()

  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: ({ projectId, flowId }) => {
      return removeFlow(projectId, flowId)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: [projectKey.flows(variables.projectId)],
      })

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
