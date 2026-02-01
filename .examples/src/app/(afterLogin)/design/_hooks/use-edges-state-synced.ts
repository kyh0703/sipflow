import {
  applyEdgeChanges,
  type AppEdge,
  type OnEdgesChange,
} from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { useYjs } from '../_contexts'
import useYjsData from './use-yjs-data'

export function useEdgesStateSynced(
  initialEdges: AppEdge[],
): [
  AppEdge[],
  React.Dispatch<React.SetStateAction<AppEdge[]>>,
  OnEdgesChange<AppEdge>,
] {
  const { yDoc } = useYjs()
  const { yEdgesMap } = useYjsData(yDoc)

  const [edges, setEdges] = useState<AppEdge[]>([])

  const setEdgesSynced = useCallback(
    (edgesOrUpdater: React.SetStateAction<AppEdge[]>) => {
      const next =
        typeof edgesOrUpdater === 'function'
          ? edgesOrUpdater([...yEdgesMap.values()])
          : edgesOrUpdater
      const seen = new Set<string>()

      next.forEach((edge) => {
        seen.add(edge.id)
        yEdgesMap.set(edge.id, edge)
      })

      for (const edge of yEdgesMap.values()) {
        if (!seen.has(edge.id)) {
          yEdgesMap.delete(edge.id)
        }
      }
    },
    [yEdgesMap],
  )

  const onEdgesChange: OnEdgesChange<AppEdge> = useCallback(
    (changes) => {
      const edges = Array.from(yEdgesMap.values())
      const nextEdges = applyEdgeChanges(changes, edges)

      for (const change of changes) {
        switch (change.type) {
          case 'add':
          case 'replace':
            yEdgesMap.set(change.item.id, change.item)
            break
          case 'remove':
            if (yEdgesMap.has(change.id)) {
              yEdgesMap.delete(change.id)
            }
            break
          default:
            yEdgesMap.set(change.id, nextEdges.find((n) => n.id === change.id)!)
            break
        }
      }
    },
    [yEdgesMap],
  )

  useEffect(() => {
    const observer = () => {
      setEdges(Array.from(yEdgesMap.values()))
    }

    const appEdgeIds = new Set(initialEdges.map((edge) => edge.id))
    initialEdges.forEach((edge) => {
      yEdgesMap.set(edge.id, { ...yEdgesMap.get(edge.id), ...edge })
    })
    for (const edgeId of yEdgesMap.keys()) {
      if (!appEdgeIds.has(edgeId)) {
        yEdgesMap.delete(edgeId)
      }
    }

    setEdges(Array.from(yEdgesMap.values()))
    yEdgesMap.observe(observer)

    return () => {
      yEdgesMap.unobserve(observer)
    }
  }, [yEdgesMap, initialEdges])

  return [edges, setEdgesSynced, onEdgesChange]
}
