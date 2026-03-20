import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsPanel } from './settings-panel'

const mocks = vi.hoisted(() => ({
  pbxInstances: [
    {
      id: 'pbx-1',
      name: 'SIP 1',
      host: '127.0.0.1',
      port: '5060',
      transport: 'UDP',
      registerInterval: '300',
    },
  ],
  addPbxInstance: vi.fn(),
  updatePbxInstance: vi.fn(),
  removePbxInstance: vi.fn(),
  showConfirmModal: vi.fn<(...args: any[]) => Promise<boolean>>(),
  toastSuccess: vi.fn(),
}))

vi.mock('../store/app-settings-store', () => ({
  usePbxInstances: () => mocks.pbxInstances,
  useAppSettingsActions: () => ({
    addPbxInstance: mocks.addPbxInstance,
    updatePbxInstance: mocks.updatePbxInstance,
    removePbxInstance: mocks.removePbxInstance,
  }),
}))

vi.mock('@/components/modal/confirm-modal', () => ({
  showConfirmModal: mocks.showConfirmModal,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => <span>Select</span>,
}))

describe('SettingsPanel delete confirmation', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mocks.removePbxInstance.mockReset()
    mocks.showConfirmModal.mockReset()
    mocks.toastSuccess.mockReset()
  })

  it('does not delete when the user cancels the confirm modal', async () => {
    mocks.showConfirmModal.mockResolvedValue(false)

    render(<SettingsPanel />)
    fireEvent.click(screen.getByLabelText('Delete SIP instance'))

    await waitFor(() => {
      expect(mocks.showConfirmModal).toHaveBeenCalled()
    })
    expect(mocks.removePbxInstance).not.toHaveBeenCalled()
  })

  it('deletes when the user confirms', async () => {
    mocks.showConfirmModal.mockResolvedValue(true)

    render(<SettingsPanel />)
    fireEvent.click(screen.getAllByLabelText('Delete SIP instance')[0])

    await waitFor(() => {
      expect(mocks.removePbxInstance).toHaveBeenCalledWith('pbx-1')
    })
  })
})
