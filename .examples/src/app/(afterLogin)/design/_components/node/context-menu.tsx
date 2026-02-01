'use client'

import ContextMenu from '@/components/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useReactFlow, type AppEdge, type AppNode } from '@xyflow/react'
import {
  AlignHorizontalSpaceAroundIcon,
  AlignVerticalSpaceAroundIcon,
  TrashIcon,
} from 'lucide-react'
import { useRemove } from '../../_hooks'

export type NodeContextMenuProps = {
  id: string
  mouse: { x: number; y: number }
  onClick?: () => void
}

export function NodeContextMenu({
  id,
  ...props
}: Readonly<NodeContextMenuProps>) {
  const { getNode } = useReactFlow<AppNode, AppEdge>()
  const targetNode = getNode(id)!
  const { removeNodeById } = useRemove()

  return (
    <ContextMenu left={props.mouse.x} top={props.mouse.y}>
      <DropdownMenu open={true} modal={false} onOpenChange={props.onClick}>
        <DropdownMenuTrigger />
        <DropdownMenuContent>
          <DropdownMenuItem
            className="flex gap-3 text-xs"
            disabled={targetNode.type === 'start'}
            onSelect={() => removeNodeById(id)}
          >
            <TrashIcon size={12} />
            Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex gap-3 text-xs"
            disabled={false}
            onSelect={() => {}}
          >
            <AlignHorizontalSpaceAroundIcon size={12} />
            Align Center
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex gap-3 text-xs"
            disabled={false}
            onSelect={() => {}}
          >
            <AlignVerticalSpaceAroundIcon size={12} />
            Align Middle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ContextMenu>
  )
}
