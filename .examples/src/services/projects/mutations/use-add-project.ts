import type { Project } from '@/models/project'
import type { ApiResponse } from '@/services'
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { addProject } from '../api'
import { projectKey } from '../keys'

type Response = { id: string; updateTime: Date }
type Variables = Omit<Project, 'id'>
type MutationOptions = UseMutationOptions<
  Response,
  ApiResponse<null>,
  Variables
>

export const useAddProject = (options?: MutationOptions) => {
  const queryClient = useQueryClient()

  return useMutation<Response, ApiResponse<null>, Variables>({
    ...options,
    mutationFn: (project) => {
      return addProject(project)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [projectKey.all] })

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
