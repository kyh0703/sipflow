export const flowKey = {
  structure: 'structure' as const,
  nodes: 'nodes' as const,
  nodeProperty: (nodeId: string) =>
    [flowKey.nodes, nodeId, 'property'] as const,
}
