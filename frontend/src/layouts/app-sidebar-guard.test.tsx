import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

const mocks = vi.hoisted(() => ({
  pathname: '/flow/scenario',
  toggleConsole: vi.fn(),
  navigate: vi.fn(),
  isDirty: false,
  showConfirmModal: vi.fn<(...args: any[]) => Promise<boolean>>(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, title, 'aria-label': ariaLabel, className }: any) => (
    <a href={to} onClick={onClick} title={title} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: mocks.pathname }),
  useNavigate: () => mocks.navigate,
}))

vi.mock('./store/workspace-panel-store', () => ({
  useWorkspaceConsoleOpen: () => false,
  useWorkspacePanelActions: () => ({ toggleConsole: mocks.toggleConsole }),
}))

vi.mock('@/features/scenario/store/scenario-store', () => ({
  useScenarioIsDirty: () => mocks.isDirty,
}))

vi.mock('@/components/modal/confirm-modal', () => ({
  showConfirmModal: mocks.showConfirmModal,
}))

describe('AppSidebar unsaved changes route guard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    mocks.pathname = '/flow/scenario'
    mocks.isDirty = false
    mocks.toggleConsole.mockReset()
    mocks.navigate.mockReset()
    mocks.showConfirmModal.mockReset()
  })

  it('does not navigate when user cancels the route change', async () => {
    mocks.isDirty = true
    mocks.showConfirmModal.mockResolvedValue(false)

    render(<AppSidebar />)
    fireEvent.click(screen.getByLabelText('Settings'))

    await waitFor(() => {
      expect(mocks.showConfirmModal).toHaveBeenCalled()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('navigates when user confirms the route change', async () => {
    mocks.isDirty = true
    mocks.showConfirmModal.mockResolvedValue(true)

    render(<AppSidebar />)
    fireEvent.click(screen.getByLabelText('Settings'))

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/settings/pbx' })
    })
  })
})
