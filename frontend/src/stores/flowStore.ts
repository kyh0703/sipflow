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
import { useProjectStore } from '@/stores/projectStore'

/**
 * Mark project as dirty (unsaved changes).
 * Uses getState() pattern for cross-store communication (non-component context).
 */
function markDirty() {
  useProjectStore.getState().actions.markDirty()
}

/**
 * Valid connection sequences based on node types
 * Defines allowed target node types for each source node type
 */
const validSequences: Record<string, string[]> = {
  sipInstance: ['command'],
  command: ['event', 'command'],
  event: ['command'],
}

/**
 * Validates if connection between source and target node types is allowed
 */
function validateConnection(sourceType: string, targetType: string): boolean {
  const allowedTargets = validSequences[sourceType]
  if (!allowedTargets) {
    return false
  }
  return allowedTargets.includes(targetType)
}

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

  return validateConnection(sourceNode.type || '', targetNode.type || '')
}

/**
 * Flow state interface
 */
interface FlowState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  sidebarOpen: boolean
  viewport: { x: number; y: number; zoom: number }

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
    setViewport: (viewport: { x: number; y: number; zoom: number }) => void
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
  viewport: { x: 0, y: 0, zoom: 1 },

  actions: {
    // React Flow change handlers - use xyflow utilities for drag, select, delete
    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      }))
      // Mark dirty for user-initiated changes (drag, delete, resize)
      // Filter out selection-only changes to avoid false dirty
      const hasMutatingChange = changes.some(
        (c) => c.type !== 'select'
      )
      if (hasMutatingChange) {
        markDirty()
      }
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }))
      const hasMutatingChange = changes.some(
        (c) => c.type !== 'select'
      )
      if (hasMutatingChange) {
        markDirty()
      }
    },

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

        markDirty()
        return { edges: updatedEdges }
      }),

    // Manual node/edge manipulation (mark dirty for user-initiated changes)
    addNode: (node) => {
      set((state) => ({
        nodes: [...state.nodes, node],
      }))
      markDirty()
    },

    removeNode: (nodeId) => {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
        selectedNodeId:
          state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      }))
      markDirty()
    },

    updateNodeData: (nodeId, data) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
      }))
      markDirty()
    },

    addEdge: (edge) => {
      set((state) => ({
        edges: [...state.edges, edge],
      }))
      markDirty()
    },

    removeEdge: (edgeId) => {
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
      }))
      markDirty()
    },

    setNodes: (nodes) => set({ nodes }),

    setEdges: (edges) => set({ edges }),

    setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

    toggleSidebar: () =>
      set((state) => ({
        sidebarOpen: !state.sidebarOpen,
      })),

    setViewport: (viewport) => set({ viewport }),
  },
}))
