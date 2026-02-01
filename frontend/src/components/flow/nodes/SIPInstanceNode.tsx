import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Phone } from 'lucide-react'
import type { SIPInstanceNodeData } from '@/types/nodes'
import { cn } from '@/lib/utils'

/**
 * SIP Instance Node Component
 * Represents a SIP UA instance in the flow
 */
export function SIPInstanceNode({ data, selected }: NodeProps) {
  const nodeData = data as SIPInstanceNodeData
  return (
    <div
      className={cn(
        'rounded-lg border-2 px-4 py-3 min-w-[160px]',
        'flex items-center gap-3',
        'transition-all duration-200',
        selected
          ? 'border-primary shadow-lg'
          : 'border-blue-300 bg-blue-50'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !w-3 !h-3"
      />

      <Phone className="w-5 h-5 text-blue-600" />

      <div className="flex flex-col">
        <span className="text-sm font-medium text-blue-900">
          {nodeData.label}
        </span>
        {nodeData.server && (
          <span className="text-xs text-blue-600">{nodeData.server}</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  )
}
