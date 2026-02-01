import { KeyCode, useKeyPress } from '@xyflow/react'
import { useEffect, useState } from 'react'

export function useShortcut(keyCode: KeyCode, callback: Function): void {
  const [didRun, setDidRun] = useState(false)
  const shouldRun = useKeyPress(keyCode, {
    target: window.document.getElementById('design-flow'),
  })

  useEffect(() => {
    if (shouldRun && !didRun) {
      callback()
      setDidRun(true)
    } else {
      setDidRun(shouldRun)
    }
  }, [shouldRun, didRun, callback])
}
