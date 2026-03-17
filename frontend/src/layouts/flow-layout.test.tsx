import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlowLayout } from './flow-layout'

const mocks = vi.hoisted(() => ({
  isDirty: false,
  isConsoleOpen: false,
  consolePanelSize: 38,
  setConsolePanelSize: vi.fn(),
  setBottomTab: vi.fn(),
}))

vi.mock('@/features/scenario/builder/store/flow-editor-context', () => ({
  FlowEditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/scenario/store/scenario-store', () => ({
  useScenarioIsDirty: () => mocks.isDirty,
}))

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

vi.mock('./store/workspace-panel-store', () => ({
  useWorkspaceConsoleOpen: () => mocks.isConsoleOpen,
  useWorkspaceConsolePanelSize: () => mocks.consolePanelSize,
  useWorkspaceConsoleTab: () => 'log',
  useWorkspacePanelActions: () => ({
    setConsolePanelSize: mocks.setConsolePanelSize,
    setBottomTab: mocks.setBottomTab,
  }),
}))

vi.mock('@/features/execution/components/execution-log', () => ({
  ExecutionLog: () => <div>Execution Log</div>,
}))

vi.mock('@/features/execution/components/execution-timeline', () => ({
  ExecutionTimeline: () => <div>Execution Timeline</div>,
}))

vi.mock('./app-sidebar', () => ({
  AppSidebar: () => <aside>Sidebar</aside>,
}))

describe('FlowLayout beforeunload guard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    mocks.isDirty = false
    mocks.isConsoleOpen = false
    mocks.consolePanelSize = 38
    mocks.setConsolePanelSize.mockReset()
    mocks.setBottomTab.mockReset()
  })

  it('prevents browser unload when there are unsaved changes', () => {
    mocks.isDirty = true
    render(<FlowLayout><div>Content</div></FlowLayout>)

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    Object.defineProperty(event, 'returnValue', {
      writable: true,
      value: undefined,
    })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(event.returnValue).toBe('')
  })

  it('renders the execution footer from the layout when the console is open', () => {
    mocks.isConsoleOpen = true

    const { getByText } = render(<FlowLayout><div>Content</div></FlowLayout>)

    expect(getByText('Content')).toBeTruthy()
    expect(getByText('Execution Log')).toBeTruthy()
    expect(getByText('Log')).toBeTruthy()
    expect(getByText('Timeline')).toBeTruthy()
  })
})
