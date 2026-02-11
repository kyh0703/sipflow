import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { AnimatedMessageEdge } from './animated-message-edge';

export function BranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const branchType = (data as any)?.branchType;
  const color = branchType === 'success'
    ? '#22c55e' // green
    : branchType === 'failure'
    ? '#ef4444' // red
    : '#94a3b8'; // gray

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: 2,
      }}
    />
  );
}

export const edgeTypes = {
  branch: AnimatedMessageEdge,
};
