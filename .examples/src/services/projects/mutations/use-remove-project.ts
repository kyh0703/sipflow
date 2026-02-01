import type { ApiResponse } from '@/services'
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { removeProject } from '../api'
import { projectKey } from '../keys'

type Response = ApiResponse<null>
type Variables = string
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useRemoveProject = (options?: MutationOptions) => {
  const queryClient = useQueryClient()

  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: (id) => {
      return removeProject(id)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [projectKey.all] })

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
