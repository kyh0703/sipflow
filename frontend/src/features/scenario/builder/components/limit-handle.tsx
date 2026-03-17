import { useMemo } from 'react';
import { Handle, useNodeId, useStore, type HandleProps, type ReactFlowState } from '@xyflow/react';

type LimitHandleProps = HandleProps & {
  connectionCount: number;
};

export function LimitHandle({ connectionCount, id, type, ...props }: LimitHandleProps) {
  const nodeId = useNodeId();
  const connections = useStore(
    useMemo(
      () =>
        (state: ReactFlowState) =>
          state.edges.filter((edge) => {
            if (!nodeId) {
              return false;
            }

            if (type === 'source') {
              return edge.source === nodeId && (edge.sourceHandle ?? null) === (id ?? null);
            }

            return edge.target === nodeId && (edge.targetHandle ?? null) === (id ?? null);
          }).length,
      [id, nodeId, type]
    )
  );

  return (
    <Handle
      id={id}
      type={type}
      isConnectable={connections < connectionCount}
      {...props}
    />
  );
}
