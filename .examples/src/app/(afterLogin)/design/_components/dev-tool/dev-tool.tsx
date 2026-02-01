'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Panel } from '@xyflow/react'
import {
  useState,
  type Dispatch,
  type HTMLAttributes,
  type ReactNode,
  type SetStateAction,
} from 'react'
import ChangeLogger from './change-logger'
import { EdgeInspector } from './edge-inspector'
import { NodeInspector } from './node-inspector'
import ViewportLogger from './viewport-logger'

export default function DevTools() {
  const [viewportLoggerActive, setViewportLoggerActive] = useState(true)
  const [changeLoggerActive, setChangeLoggerActive] = useState(true)
  const [nodeInspectorActive, setNodeInspectorActive] = useState(true)
  const [edgeInspectorActive, setEdgeInspectorActive] = useState(true)

  return (
    <div className="text-xxs">
      <Panel position="top-center">
        <DevToolButton
          setActive={setViewportLoggerActive}
          active={viewportLoggerActive}
          title="Toggle Viewport Logger"
        >
          Viewport Logger
        </DevToolButton>
        <DevToolButton
          setActive={setChangeLoggerActive}
          active={changeLoggerActive}
          title="Toggle Change Logger"
        >
          Change Logger
        </DevToolButton>
        <DevToolButton
          setActive={setNodeInspectorActive}
          active={nodeInspectorActive}
          title="Toggle Node Inspector"
        >
          Node Inspector
        </DevToolButton>
        <DevToolButton
          setActive={setEdgeInspectorActive}
          active={edgeInspectorActive}
          title="Toggle Edge Inspector"
        >
          Edge Inspector
        </DevToolButton>
      </Panel>
      {viewportLoggerActive && <ViewportLogger />}
      {changeLoggerActive && <ChangeLogger />}
      {nodeInspectorActive && <NodeInspector />}
      {edgeInspectorActive && <EdgeInspector />}
    </div>
  )
}

function DevToolButton({
  active,
  setActive,
  children,
  ...rest
}: {
  active: boolean
  setActive: Dispatch<SetStateAction<boolean>>
  children: ReactNode
} & HTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      onClick={() => setActive((a) => !a)}
      className={cn(active ? 'active' : '')}
      {...rest}
    >
      {children}
    </Button>
  )
}
