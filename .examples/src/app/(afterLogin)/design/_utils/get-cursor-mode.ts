import type { CursorMode } from '@/stores/flow-store'

export const getCursorClass = (mode: CursorMode) => {
  switch (mode) {
    case 'grab':
      return 'cursor-grab'
    case 'pointer':
      return 'cursor-crosshair'
    case 'link':
      return 'cursor-default'
    default:
      return 'cursor-auto'
  }
}
