import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsLayout } from './settings-layout'

const mocks = vi.hoisted(() => ({
  isConsoleOpen: false,
  consolePanelSize: 33,
  setConsolePanelSize: vi.fn(),
  setBottomTab: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
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
    toggleConsole: vi.fn(),
  }),
}))

vi.mock('@/features/scenario/store/scenario-store', () => ({
  useScenarioIsDirty: () => false,
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

describe('SettingsLayout', () => {
  beforeEach(() => {
    mocks.isConsoleOpen = false
    mocks.consolePanelSize = 33
    mocks.setConsolePanelSize.mockReset()
    mocks.setBottomTab.mockReset()
  })

  it('renders settings content without the console when closed', () => {
    const { getByText, queryByText } = render(
      <SettingsLayout activeTab="general">
        <div>Settings Content</div>
      </SettingsLayout>
    )

    expect(getByText('Settings Content')).toBeTruthy()
    expect(queryByText('Execution Log')).toBeNull()
  })

  it('renders the shared console panel when open', () => {
    mocks.isConsoleOpen = true

    const { getByText } = render(
      <SettingsLayout activeTab="general">
        <div>Settings Content</div>
      </SettingsLayout>
    )

    expect(getByText('Settings Content')).toBeTruthy()
    expect(getByText('Execution Log')).toBeTruthy()
    expect(getByText('Log')).toBeTruthy()
    expect(getByText('Timeline')).toBeTruthy()
  })
})
