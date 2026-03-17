import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScenarioBuilder } from './scenario-builder'

const mocks = vi.hoisted(() => ({
  collapse: vi.fn(),
  expand: vi.fn(),
  selectedNodeId: null as string | null,
  saveNow: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children, panelRef }: { children: React.ReactNode; panelRef?: { current: unknown } }) => {
    if (panelRef) {
      panelRef.current = {
        collapse: mocks.collapse,
        expand: mocks.expand,
      }
    }

    return <div>{children}</div>
  },
  ResizableHandle: () => <div />,
}))

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <div>Theme Toggle</div>,
}))

vi.mock('./canvas', () => ({
  Canvas: () => <div>Canvas</div>,
}))

vi.mock('./node-palette', () => ({
  NodePalette: () => <div>Node Palette</div>,
}))

vi.mock('./properties-panel', () => ({
  PropertiesPanel: () => <div>Properties Panel</div>,
}))

vi.mock('@/features/scenario/components/scenario-tree', () => ({
  ScenarioTree: () => <div>Scenario Tree</div>,
}))

vi.mock('@/features/execution/components/execution-toolbar', () => ({
  ExecutionToolbar: () => <div>Execution Toolbar</div>,
}))

vi.mock('../lib/backend-contract', () => ({
  validateBackendContract: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/scenario/store/scenario-store', () => ({
  useScenarioCurrentScenarioId: () => 'scenario-1',
  useScenarioCurrentScenarioName: () => 'Scenario 1',
  useScenarioSaveStatus: () => 'saved',
}))

vi.mock('../store/flow-editor-context', () => ({
  useFlowEditorActions: () => ({ saveNow: mocks.saveNow }),
  useFlowEditorSelectedNodeId: () => mocks.selectedNodeId,
}))

describe('ScenarioBuilder properties panel', () => {
  beforeEach(() => {
    mocks.collapse.mockReset()
    mocks.expand.mockReset()
    mocks.selectedNodeId = null
    mocks.saveNow.mockReset()
  })

  it('starts with the properties panel collapsed', async () => {
    render(<ScenarioBuilder activePanel="scenario" />)

    await waitFor(() => {
      expect(mocks.collapse).toHaveBeenCalledTimes(1)
    })

    expect(mocks.expand).not.toHaveBeenCalled()
  })

  it('expands the properties panel when a node is selected after mount', async () => {
    const { rerender } = render(<ScenarioBuilder activePanel="scenario" />)

    await waitFor(() => {
      expect(mocks.collapse).toHaveBeenCalledTimes(1)
    })

    mocks.selectedNodeId = 'node-1'
    rerender(<ScenarioBuilder activePanel="scenario" />)

    await waitFor(() => {
      expect(mocks.expand).toHaveBeenCalledTimes(1)
    })
  })
})
