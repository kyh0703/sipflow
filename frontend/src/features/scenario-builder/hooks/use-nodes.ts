import { useCallback } from 'react';
import { useReactFlow, type Edge, type Node } from '@xyflow/react';

export function useNodes() {
  const { getNode, getNodes } = useReactFlow<Node, Edge>();

  const getNodeType = useCallback(
    (id: string) => {
      const node = getNode(id);
      return node?.type;
    },
    [getNode]
  );

  const getSelectedNodes = useCallback(() => {
    return getNodes().filter((node) => node.selected);
  }, [getNodes]);

  return {
    getNodeType,
    getSelectedNodes,
  };
}
