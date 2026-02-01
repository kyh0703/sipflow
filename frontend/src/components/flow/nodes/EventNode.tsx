import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Timer } from 'lucide-react'
import type { EventNodeData } from '@/types/nodes'
import { cn } from '@/lib/utils'

/**
 * Event Node Component
 * Represents a wait/delay event in the flow
 */
export function EventNode({ data, selected }: NodeProps) {
  const nodeData = data as EventNodeData
  return (
    <div
      className={cn(
        'rounded-lg border-2 px-4 py-3 min-w-[160px]',
        'flex items-center gap-3',
        'transition-all duration-200',
        selected
          ? 'border-primary shadow-lg'
          : 'border-green-300 bg-green-50'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-green-500 !w-3 !h-3"
      />

      <Timer className="w-5 h-5 text-green-600" />

      <div className="flex flex-col">
        <span className="text-sm font-medium text-green-900">
          {nodeData.label}
        </span>
        {nodeData.timeout && (
          <span className="text-xs text-green-600">{nodeData.timeout}ms</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-500 !w-3 !h-3"
      />
    </div>
  )
}
