import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CommandNodeData } from '@/types/nodes'
import { commandIcons } from './commandIcons'
import { cn } from '@/lib/utils'

/**
 * Command Node Component
 * Represents a SIP command action in the flow
 */
export function CommandNode({ data, selected }: NodeProps) {
  const nodeData = data as CommandNodeData
  const Icon = commandIcons[nodeData.command]

  return (
    <div
      className={cn(
        'rounded-lg border-2 px-4 py-3 min-w-[160px]',
        'flex items-center gap-3',
        'transition-all duration-200',
        selected
          ? 'border-primary shadow-lg'
          : 'border-orange-300 bg-orange-50'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500 !w-3 !h-3"
      />

      <Icon className="w-5 h-5 text-orange-600" />

      <div className="flex flex-col">
        <span className="text-sm font-medium text-orange-900">
          {nodeData.label}
        </span>
        <span className="text-xs text-orange-600 capitalize">
          {nodeData.command}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-orange-500 !w-3 !h-3"
      />
    </div>
  )
}
