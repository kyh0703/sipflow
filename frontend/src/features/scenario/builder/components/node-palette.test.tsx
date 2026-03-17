import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NodePalette } from './node-palette'

function createDragEvent() {
  const store = new Map<string, string>()

  return {
    dataTransfer: {
      effectAllowed: '',
      setData: (format: string, value: string) => {
        store.set(format, value)
      },
      getData: (format: string) => store.get(format) ?? '',
    },
  }
}

describe('NodePalette drag and drop', () => {
  it('uses the React Flow dataTransfer payload without requiring a provider', () => {
    render(<NodePalette />)

    const item = screen.getByText('MakeCall').closest('[draggable="true"]')
    expect(item).not.toBeNull()

    const dragEvent = createDragEvent()
    fireEvent.dragStart(item as Element, dragEvent)

    expect(dragEvent.dataTransfer.getData('application/reactflow')).toBe('command-MakeCall')
    expect(dragEvent.dataTransfer.effectAllowed).toBe('move')
  })
})
