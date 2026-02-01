import { useRemove, useSelect, useShortcut } from '.'

export function useKeyBind() {
  const { selectAll } = useSelect()
  const { removeSelectedNodes } = useRemove()

  useShortcut(['Meta+a', 'Control+a'], selectAll)
  useShortcut(['Delete'], removeSelectedNodes)
}
