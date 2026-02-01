'use client'

import type { CustomNodeType } from '@xyflow/react'

export function DragItem({
  type,
  icon,
}: Readonly<{
  type: CustomNodeType
  icon: React.ElementType
}>) {
  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: CustomNodeType,
  ) => {
    event.dataTransfer.setData('application/xyflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      key={type}
      className="hover:bg-muted/50 flex cursor-grab items-center gap-2 rounded-md p-2 active:cursor-grabbing"
      draggable
      onDragStart={(event) => handleDragStart(event, type)}
    >
      <div className="h-3 w-3 rounded-full" />
      <span className="text-xs">{type}</span>
    </div>
  )
}
