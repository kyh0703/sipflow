import type { Flow } from '@/models/flow'
import type { ApiResponse } from '@/services'
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { addFlow } from '../api'
import { projectKey } from '../keys'

type Response = { id: string; updateTime: Date }
type Variables = { projectId: string; flow: Omit<Flow, 'id'> }
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useAddFlow = (options?: MutationOptions) => {
  const queryClient = useQueryClient()

  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: ({ projectId, flow }) => {
      return addFlow(projectId, flow)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: [projectKey.flows(variables.projectId)],
      })

      if (options?.onSuccess) {
        options?.onSuccess(data, variables, context)
      }

      return data
    },
    onError: (error, variables, context) => {
      toast.error(error.message)

      if (options?.onError) {
        options?.onError(error, variables, context)
      }
    },
  })
}
