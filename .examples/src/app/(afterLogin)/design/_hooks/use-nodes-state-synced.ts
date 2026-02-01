import {
  applyNodeChanges,
  getConnectedEdges,
  type AppNode,
  type HelperLine,
  type OnNodesChange,
} from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { useYjs } from '../_contexts'
import { getHelperLines } from '../_utils'
import useYjsData from './use-yjs-data'

export function useNodesStateSynced(
  initialNodes: AppNode[],
): [
  AppNode[],
  React.Dispatch<React.SetStateAction<AppNode[]>>,
  OnNodesChange<AppNode>,
  HelperLine | undefined,
  HelperLine | undefined,
] {
  const { yDoc } = useYjs()
  const { yNodesMap, yEdgesMap } = useYjsData(yDoc)

  const [nodes, setNodes] = useState<AppNode[]>([])
  const [verticalLine, setVerticalLine] = useState<HelperLine>(undefined)
  const [horizontalLine, setHorizontalLine] = useState<HelperLine>(undefined)

  const setNodesSynced = useCallback(
    (nodesOrUpdater: React.SetStateAction<AppNode[]>) => {
      const next =
        typeof nodesOrUpdater === 'function'
          ? nodesOrUpdater([...yNodesMap.values()])
          : nodesOrUpdater
      const seen = new Set<string>()

      next.forEach((node) => {
        seen.add(node.id)
        yNodesMap.set(node.id, node)
      })

      for (const node of yNodesMap.values()) {
        if (!seen.has(node.id)) {
          yNodesMap.delete(node.id)
        }
      }
    },
    [yNodesMap],
  )

  const makeHelperLine: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      setHorizontalLine(undefined)
      setVerticalLine(undefined)

      if (
        changes.length === 1 &&
        changes[0].type === 'position' &&
        changes[0].dragging &&
        changes[0].position
      ) {
        const helperLines = getHelperLines(changes[0], nodes)

        // if we have a helper line, we snap the node to the helper line position
        // this is being done by manipulating the node position inside the change object
        changes[0].position.x =
          helperLines.snapPosition.x ?? changes[0].position.x
        changes[0].position.y =
          helperLines.snapPosition.y ?? changes[0].position.y

        // if helper lines are returned, we set them so that they can be displayed
        setHorizontalLine(helperLines.horizontal)
        setVerticalLine(helperLines.vertical)
      }
    },
    [nodes],
  )

  // The onNodesChange callback updates nodesMap.
  // When the changes are applied to the map, the observer will be triggered and updates the nodes state.
  const onNodesChanges: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      const nodes = Array.from(yNodesMap.values())
      makeHelperLine(changes)
      const nextNodes = applyNodeChanges(changes, nodes)

      for (const change of changes) {
        switch (change.type) {
          case 'add':
          case 'replace':
            yNodesMap.set(change.item.id, change.item)
            break
          case 'remove':
            if (yNodesMap.has(change.id)) {
              const deletedNode = yNodesMap.get(change.id)!
              yNodesMap.delete(change.id)
              const connectedEdges = getConnectedEdges(
                [deletedNode],
                [...yEdgesMap.values()],
              )
              connectedEdges.forEach((edge) => yEdgesMap.delete(edge.id))
            }
            break
          default:
            yNodesMap.set(change.id, nextNodes.find((n) => n.id === change.id)!)
            break
        }
      }
    },
    [yEdgesMap, makeHelperLine, yNodesMap],
  )

  // here we are observing the nodesMap and updating the nodes state whenever the map changes.
  useEffect(() => {
    const observer = () => {
      setNodes(Array.from(yNodesMap.values()))
    }

    const appNodeIds = new Set(initialNodes.map((node) => node.id))
    initialNodes.forEach((node) => {
      yNodesMap.set(node.id, { ...yNodesMap.get(node.id), ...node })
    })
    for (const nodeId of yNodesMap.keys()) {
      if (!appNodeIds.has(nodeId)) {
        yNodesMap.delete(nodeId)
      }
    }

    setNodes(Array.from(yNodesMap.values()))
    yNodesMap.observe(observer)

    return () => {
      yNodesMap.unobserve(observer)
    }
  }, [initialNodes, yNodesMap])

  return [nodes, setNodesSynced, onNodesChanges, horizontalLine, verticalLine]
}
