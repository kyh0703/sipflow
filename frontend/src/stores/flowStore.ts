import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as addEdgeUtil,
} from '@xyflow/react'
import type { SIPFlowNode, SIPFlowEdge } from '@/types/nodes'

/**
 * Helper to validate edge connection based on node types
 * SIP Instance -> Command -> Event -> Command... pattern
 */
function validateEdge(
  sourceId: string,
  targetId: string,
  nodes: Node[]
): boolean {
  const sourceNode = nodes.find((n) => n.id === sourceId)
  const targetNode = nodes.find((n) => n.id === targetId)

  if (!sourceNode || !targetNode) {
    return false
  }

  // Basic validation: allow all connections for now
  // More specific validation will be added in property panel phase
  return true
}

/**
 * Flow state interface
 */
interface FlowState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  sidebarOpen: boolean

  // Actions grouped in object to keep references stable (prevents re-renders)
  actions: {
    // React Flow change handlers (critical for drag, select, delete)
    onNodesChange: (changes: NodeChange[]) => void
    onEdgesChange: (changes: EdgeChange[]) => void
    onConnect: (connection: Connection) => void

    // Manual node/edge manipulation
    addNode: (node: Node) => void
    removeNode: (nodeId: string) => void
    updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
    addEdge: (edge: Edge) => void
    removeEdge: (edgeId: string) => void
    setNodes: (nodes: Node[]) => void
    setEdges: (edges: Edge[]) => void
    setSelectedNode: (nodeId: string | null) => void
    toggleSidebar: () => void
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
 * const onNodesChange = useFlowStore(state => state.actions.onNodesChange)
 * ```
 */
export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  sidebarOpen: true,

  actions: {
    // React Flow change handlers - use xyflow utilities for drag, select, delete
    onNodesChange: (changes) =>
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      })),

    onEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),

    onConnect: (connection) =>
      set((state) => {
        const isValid = validateEdge(
          connection.source,
          connection.target,
          state.nodes
        )

        const newEdges = addEdgeUtil(
          connection,
          state.edges
        )

        // Update the newly created edge with custom type and validation data
        const updatedEdges = newEdges.map((edge) => {
          // Find the edge that was just added (last one or match by source/target)
          if (
            edge.source === connection.source &&
            edge.target === connection.target &&
            !edge.type
          ) {
            return {
              ...edge,
              type: 'flowEdge',
              data: { isValid },
            }
          }
          return edge
        })

        return { edges: updatedEdges }
      }),

    // Manual node/edge manipulation (for programmatic changes)
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

    toggleSidebar: () =>
      set((state) => ({
        sidebarOpen: !state.sidebarOpen,
      })),
  },
}))
