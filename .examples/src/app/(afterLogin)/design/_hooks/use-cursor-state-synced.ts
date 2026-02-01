import type { Cursor } from '@/types/collaboration'
import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useYjs } from '../_contexts'
import { stringToColor } from '../_utils'
import useYjsData from './use-yjs-data'

const MAX_IDLE_TIME = 10000

export function useCursorStateSynced() {
  const { yDoc } = useYjs()
  const { yCursorsMap } = useYjsData(yDoc)

  const [cursors, setCursors] = useState<Cursor[]>([])
  const clientId = yDoc.clientID.toString()
  const { screenToFlowPosition } = useReactFlow()
  const cursorColor = stringToColor(clientId)

  // Flush any cursors that have gone stale.
  const flush = useCallback(() => {
    const now = Date.now()

    for (const [id, cursor] of yCursorsMap) {
      if (now - cursor.timestamp > MAX_IDLE_TIME) {
        yCursorsMap.delete(id)
      }
    }
  }, [yCursorsMap])

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      yCursorsMap.set(clientId, {
        id: clientId,
        color: cursorColor,
        x: position.x,
        y: position.y,
        timestamp: Date.now(),
      })
    },
    [clientId, cursorColor, yCursorsMap, screenToFlowPosition],
  )

  useEffect(() => {
    const timer = window.setInterval(flush, MAX_IDLE_TIME)
    const observer = () => {
      setCursors([...yCursorsMap.values()])
    }

    flush()
    setCursors([...yCursorsMap.values()])
    yCursorsMap.observe(observer)

    return () => {
      yCursorsMap.unobserve(observer)
      window.clearInterval(timer)
    }
  }, [yCursorsMap, flush])

  const cursorsWithoutSelf = useMemo(
    () => cursors.filter(({ id }) => id !== clientId),
    [clientId, cursors],
  )

  return [cursorsWithoutSelf, onMouseMove] as const
}
