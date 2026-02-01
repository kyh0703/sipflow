'use client'

import { Handle, useNodeConnections, type HandleProps } from '@xyflow/react'

type LimitHandleProps = {
  connectionCount: number
} & HandleProps

export function LimitHandle(props: Readonly<LimitHandleProps>) {
  const connections = useNodeConnections({
    handleType: props.type,
  })

  return (
    <Handle
      {...props}
      isConnectable={connections.length < props.connectionCount}
    />
  )
}
