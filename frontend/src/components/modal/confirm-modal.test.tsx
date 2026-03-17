import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from './confirm-modal'

describe('ConfirmModal', () => {
  it('renders confirm actions and returns false/true through onClose', () => {
    const onClose = vi.fn()
    render(<ConfirmModal content="Discard unsaved changes?" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(onClose.mock.calls).toEqual([[false], [true]])
  })

  it('submits on Enter key', () => {
    const onClose = vi.fn()
    render(<ConfirmModal content="Discard unsaved changes?" onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Enter' })

    expect(onClose).toHaveBeenCalledWith(true)
  })
})
