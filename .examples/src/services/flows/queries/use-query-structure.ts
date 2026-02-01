import { getStructure } from '../api'
import { flowKey } from '../keys'

export const useQueryStructure = (projectId: string, flowId: string) => ({
  queryKey: [flowKey.structure],
  queryFn: () => getStructure(projectId, flowId),
})
