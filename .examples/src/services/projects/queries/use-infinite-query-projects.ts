import type { Project } from '@/models/project'
import type { PaginationResponse } from '@/services/types'
import { getProjects } from '../api'
import { projectKey } from '../keys'

export const useInfiniteQueryProjects = () => ({
  queryKey: [projectKey.all],
  queryFn: ({ pageParam = 1 }) => getProjects(pageParam, 10),
  initialPageParam: 1,
  getNextPageParam: (lastPage: PaginationResponse<Project>) => {
    if (!lastPage.meta.hasNext) return undefined
    return lastPage.meta.page + 1
  },
})
