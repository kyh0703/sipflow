'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import {
  type NodeChange,
  type OnNodesChange,
  Panel,
  useStore,
  useStoreApi,
} from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

type ChangeLoggerProps = {
  color?: string
  limit?: number
}

type ChangeInfoProps = {
  change: NodeChange
}

function ChangeInfo({ change }: Readonly<ChangeInfoProps>) {
  const id = 'id' in change ? change.id : '-'
  const { type } = change

  return (
    <div>
      <div>node id: {id}</div>
      <div>
        {type === 'add' ? JSON.stringify(change.item, null, 2) : null}
        {type === 'dimensions'
          ? `dimensions: ${change.dimensions?.width} × ${change.dimensions?.height}`
          : null}
        {type === 'position'
          ? `position: ${change.position?.x.toFixed(
              1,
            )}, ${change.position?.y.toFixed(1)}`
          : null}
        {type === 'remove' ? 'remove' : null}
        {type === 'select' ? (change.selected ? 'select' : 'unselect') : null}
      </div>
    </div>
  )
}

export default function ChangeLogger({
  limit = 20,
}: Readonly<ChangeLoggerProps>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [changes, setChanges] = useState<NodeChange[]>([])
  const onNodesChangeIntercepted = useRef(false)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const store = useStoreApi()

  useEffect(() => {
    if (!onNodesChange || onNodesChangeIntercepted.current) {
      return
    }

    onNodesChangeIntercepted.current = true
    const userOnNodesChange = onNodesChange

    const onNodesChangeLogger: OnNodesChange = (changes) => {
      userOnNodesChange(changes)

      setChanges((oldChanges) => [...changes, ...oldChanges].slice(0, limit))
    }

    store.setState({ onNodesChange: onNodesChangeLogger })
  }, [onNodesChange, limit, store])

  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    )

    const scrollToBottom = () => {
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth',
        })
      }
    }

    scrollToBottom()
  }, [changes])

  return (
    <Panel position="top-left">
      <div>🏷️Change Logger🏷️</div>
      {changes.length === 0 ? (
        <>no changes triggered</>
      ) : (
        <ScrollArea ref={scrollRef} className="h-[200px]">
          {changes.map((change) => (
            <ChangeInfo key={change.type + uuidv4()} change={change} />
          ))}
        </ScrollArea>
      )}
    </Panel>
  )
}
