import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

const mocks = vi.hoisted(() => ({
  pathname: '/flow/scenario',
  toggleConsole: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, title, 'aria-label': ariaLabel, className }: any) => (
    <a href={to} title={title} aria-label={ariaLabel} className={className}>
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
  useScenarioIsDirty: () => false,
}))

vi.mock('@/components/modal/confirm-modal', () => ({
  showConfirmModal: vi.fn(),
}))

afterEach(() => {
  cleanup()
})

describe('AppSidebar', () => {
  beforeEach(() => {
    mocks.pathname = '/flow/scenario'
    mocks.toggleConsole.mockReset()
    mocks.navigate.mockReset()
  })

  it('keeps the settings button as the bottom-most footer control on flow routes', () => {
    const { container } = render(<AppSidebar />)

    const aside = container.querySelector('aside')
    const footerGroup = aside?.lastElementChild as HTMLElement
    const consoleButton = screen.getByLabelText('Console')
    const settingsLink = screen.getByLabelText('Settings')

    expect(footerGroup.firstElementChild).toBe(consoleButton)
    expect(footerGroup.lastElementChild).toBe(settingsLink)
  })

  it('shows only the settings button in the footer on settings routes', () => {
    mocks.pathname = '/settings/pbx'

    const { container } = render(<AppSidebar />)

    const aside = container.querySelector('aside')
    const footerGroup = aside?.lastElementChild as HTMLElement

    expect(screen.queryByLabelText('Console')).toBeNull()
    expect(footerGroup.childElementCount).toBe(1)
    expect(footerGroup.lastElementChild).toBe(screen.getByLabelText('Settings'))
  })
})
