import { create } from 'zustand'

/**
 * Generic node type (React Flow will be added in Phase 2)
 */
export interface Node {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/**
 * Generic edge type (React Flow will be added in Phase 2)
 */
export interface Edge {
  id: string
  source: string
  target: string
  type?: string
  data?: Record<string, unknown>
}

/**
 * Flow state interface
 */
interface FlowState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  // Actions grouped in object to keep references stable (prevents re-renders)
  actions: {
    addNode: (node: Node) => void
    removeNode: (nodeId: string) => void
    updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
    addEdge: (edge: Edge) => void
    removeEdge: (edgeId: string) => void
    setNodes: (nodes: Node[]) => void
    setEdges: (edges: Edge[]) => void
    setSelectedNode: (nodeId: string | null) => void
  }
}

/**
 * Zustand store for flow state
 *
 * Usage:
 * ```tsx
 * // Use selectors to prevent unnecessary re-renders
 * const nodes = useFlowStore(state => state.nodes)
 * const addNode = useFlowStore(state => state.actions.addNode)
 * ```
 */
export const useFlowStore = create<FlowState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  actions: {
    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),

    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
        selectedNodeId:
          state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      })),

    updateNodeData: (nodeId, data) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
      })),

    addEdge: (edge) =>
      set((state) => ({
        edges: [...state.edges, edge],
      })),

    removeEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
      })),

    setNodes: (nodes) => set({ nodes }),

    setEdges: (edges) => set({ edges }),

    setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  },
}))
