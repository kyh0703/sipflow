import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScenarioTree } from './scenario-tree'

const mocks = vi.hoisted(() => ({
  isDirty: false,
  currentScenarioId: 'scenario-1',
  setCurrentScenario: vi.fn(),
  showConfirmModal: vi.fn<(...args: any[]) => Promise<boolean>>(),
  listScenarios: vi.fn<(...args: any[]) => Promise<any[]>>(),
  createScenario: vi.fn(),
  renameScenario: vi.fn(),
  deleteScenario: vi.fn(),
}))

vi.mock('../hooks/use-scenario-api', () => ({
  useScenarioApi: () => ({
    listScenarios: mocks.listScenarios,
    createScenario: mocks.createScenario,
    renameScenario: mocks.renameScenario,
    deleteScenario: mocks.deleteScenario,
  }),
}))

vi.mock('../store/scenario-store', () => ({
  useScenarioCurrentScenarioId: () => mocks.currentScenarioId,
  useScenarioIsDirty: () => mocks.isDirty,
  useScenarioActions: () => ({
    setCurrentScenario: mocks.setCurrentScenario,
  }),
}))


vi.mock('@/components/modal/confirm-modal', () => ({
  showConfirmModal: mocks.showConfirmModal,
}))

describe('ScenarioTree unsaved changes guard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mocks.isDirty = false
    mocks.currentScenarioId = 'scenario-1'
    mocks.setCurrentScenario.mockReset()
    mocks.showConfirmModal.mockReset()
    mocks.listScenarios.mockReset()
    mocks.createScenario.mockReset()
    mocks.renameScenario.mockReset()
    mocks.deleteScenario.mockReset()

    mocks.listScenarios.mockResolvedValue([
      { id: 'scenario-1', name: 'Scenario 1' },
      { id: 'scenario-2', name: 'Scenario 2' },
    ])
  })

  it('does not switch when user cancels the discard confirmation', async () => {
    mocks.isDirty = true
    mocks.showConfirmModal.mockResolvedValue(false)

    render(<ScenarioTree />)

    await screen.findAllByText('Scenario 2')
    fireEvent.click(screen.getAllByText('Scenario 2')[0])

    await waitFor(() => {
      expect(mocks.showConfirmModal).toHaveBeenCalled()
    })
    expect(mocks.setCurrentScenario).not.toHaveBeenCalledWith('scenario-2', 'Scenario 2')
  })


  it('does not delete when user cancels the delete confirmation', async () => {
    mocks.showConfirmModal.mockResolvedValue(false)

    render(<ScenarioTree />)

    await screen.findAllByText('Scenario 2')
    fireEvent.click(screen.getAllByTitle('Delete')[0])

    await waitFor(() => {
      expect(mocks.showConfirmModal).toHaveBeenCalled()
    })
    expect(mocks.deleteScenario).not.toHaveBeenCalled()
  })

  it('deletes when user confirms the delete confirmation', async () => {
    mocks.showConfirmModal.mockResolvedValue(true)

    render(<ScenarioTree />)

    await screen.findAllByText('Scenario 2')
    fireEvent.click(screen.getAllByTitle('Delete')[0])

    await waitFor(() => {
      expect(mocks.deleteScenario).toHaveBeenCalledWith('scenario-1')
    })
  })

  it('switches when user confirms discarding unsaved changes', async () => {
    mocks.isDirty = true
    mocks.showConfirmModal.mockResolvedValue(true)

    render(<ScenarioTree />)

    await screen.findAllByText('Scenario 2')
    fireEvent.click(screen.getAllByText('Scenario 2')[0])

    await waitFor(() => {
      expect(mocks.setCurrentScenario).toHaveBeenCalledWith('scenario-2', 'Scenario 2')
    })
  })
})
