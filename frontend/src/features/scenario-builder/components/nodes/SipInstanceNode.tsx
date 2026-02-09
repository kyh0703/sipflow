import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import type { SipInstanceNode } from '../../types/scenario';

export function SipInstanceNode({ data }: NodeProps<SipInstanceNode>) {
  return (
    <div
      className="bg-background border-2 border-emerald-400 rounded-lg shadow-md min-w-[160px]"
      style={{ borderLeftWidth: '4px', borderLeftColor: data.color }}
    >
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-2 border-b border-emerald-200 flex items-center gap-2">
        <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
        <span className="text-sm font-bold text-emerald-900">{data.label}</span>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              data.mode === 'DN'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-blue-100 text-blue-700 border border-blue-300'
            }`}
          >
            {data.mode}
          </span>
          {data.register && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
              Register
            </span>
          )}
        </div>
        {data.mode === 'DN' && data.dn && (
          <div className="text-xs text-muted-foreground">DN: {data.dn}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700"
      />
    </div>
  );
}
