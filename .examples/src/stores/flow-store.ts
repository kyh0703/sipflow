import { createStore } from '@/lib/store'
import type { XYPosition } from '@xyflow/react'

export type CursorMode = 'grab' | 'pointer' | 'link'

interface FlowState {
  selectedNodeId: string | null
  cursorMode: CursorMode
  connectionLinePath: XYPosition[]
  actions: {
    setCursorMode: (mode: CursorMode) => void
    setSelectedNodeId: (nodeId: string | null) => void
    setConnectionLinePath: (path: XYPosition[]) => void
  }
}

const useFlowStore = createStore<FlowState>(
  (set) => ({
    selectedNodeId: null,
    cursorMode: 'grab',
    connectionLinePath: [],
    actions: {
      setCursorMode: (mode: CursorMode) =>
        set(
          (state) => {
            state.cursorMode = mode
          },
          false,
          'setCursorMode',
        ),
      setSelectedNodeId: (nodeId: string | null) =>
        set(
          (state) => {
            state.selectedNodeId = nodeId
          },
          false,
          'setSelectedNodeId',
        ),
      setConnectionLinePath: (path: XYPosition[]) =>
        set(
          (state) => {
            state.connectionLinePath = path
          },
          false,
          'setConnectionLinePath',
        ),
    },
  }),
  { name: 'FlowStore' },
)

export const useSelectedNodeId = () =>
  useFlowStore((state) => state.selectedNodeId)
export const useCursor = () => useFlowStore((state) => state.cursorMode)
export const useConnectionLinePath = () =>
  useFlowStore((state) => state.connectionLinePath)
export const useFlowActions = () => useFlowStore((state) => state.actions)
