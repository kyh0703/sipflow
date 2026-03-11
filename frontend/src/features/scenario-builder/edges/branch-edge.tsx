import {
  BaseEdge,
  getSmoothStepPath,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';
import { AnimatedMessageEdge } from './animated-message-edge';
import { getEdgeParams, toPositionByInternalNode } from '../lib/easy-connection';

export function BranchEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeParams =
    sourceNode && targetNode
      ? getEdgeParams(
          toPositionByInternalNode(sourceNode),
          toPositionByInternalNode(targetNode)
        )
      : null;

  const [edgePath] = getSmoothStepPath({
    sourceX: edgeParams?.sx ?? sourceX,
    sourceY: edgeParams?.sy ?? sourceY,
    sourcePosition: edgeParams?.sourcePos ?? sourcePosition,
    targetX: edgeParams?.tx ?? targetX,
    targetY: edgeParams?.ty ?? targetY,
    targetPosition: edgeParams?.targetPos ?? targetPosition,
  });

  const branchType = (data as any)?.branchType;
  const color = branchType === 'failure' ? '#e7a7b3' : '#cbd5e1';
  const strokeDasharray = branchType === 'failure' ? '6 6' : undefined;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: 1.5,
        strokeDasharray,
        strokeLinecap: 'round',
      }}
    />
  );
}

export const edgeTypes = {
  branch: AnimatedMessageEdge,
};
