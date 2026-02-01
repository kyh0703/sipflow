import type { Cursor } from '@/types/collaboration'
import type { AppEdge, AppNode } from '@xyflow/react'
import { useMemo } from 'react'
import * as Y from 'yjs'

export default function useYjsData(yDoc: Y.Doc) {
  const yCursorsMap = useMemo(() => yDoc.getMap<Cursor>('cursors'), [yDoc])
  const yNodesMap = useMemo(() => yDoc.getMap<AppNode>('nodes'), [yDoc])
  const yEdgesMap = useMemo(() => yDoc.getMap<AppEdge>('edges'), [yDoc])

  return {
    yCursorsMap,
    yNodesMap,
    yEdgesMap,
  }
}
