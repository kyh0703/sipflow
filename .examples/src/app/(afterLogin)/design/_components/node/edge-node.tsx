'use client'

import {
  Position,
  useStore,
  type CustomNodeProps,
  type ReactFlowState,
} from '@xyflow/react'
import { useNodeDimensions } from '../../_hooks'
import { LimitHandle } from '../tools'

const selector = (state: ReactFlowState) => ({
  connectOnClick: state.connectOnClick,
  noPanClassName: state.noPanClassName,
  rfId: state.rfId,
})

export function EdgeNode({ id }: Readonly<CustomNodeProps>) {
  const { width, height } = useNodeDimensions(id)
  const store = useStore(selector)
  store.connectOnClick = false

  return (
    <div
      className="bg-foreground text-background relative flex rounded-full"
      style={{ width, height }}
    >
      <LimitHandle
        className="top-1/2! left-1/2! h-1/3! w-1/3! -translate-x-1/2! -translate-y-1/2! transform!"
        position={Position.Top}
        isConnectable={false}
        type="source"
        connectionCount={1}
      />
      <LimitHandle
        className="top-1/2! left-1/2! h-1/3! w-1/3! -translate-x-1/2! -translate-y-1/2! transform!"
        position={Position.Top}
        type="target"
        isConnectable={false}
        connectionCount={1}
      />
    </div>
  )
}
