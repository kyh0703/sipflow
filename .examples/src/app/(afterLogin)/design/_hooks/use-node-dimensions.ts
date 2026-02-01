import { useInternalNode } from '@xyflow/react'

export function useNodeDimensions(id: string) {
  const node = useInternalNode(id)

  return {
    width: node?.measured?.width ?? 40,
    height: node?.measured?.height ?? 40,
  }
}
