import { useEffect } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';
import {
  useExecutionActions,
  useExecutionEdgeAnimations,
} from '../store/execution-store';
import { getEdgeParams, toPositionByInternalNode } from '../lib/easy-connection';

export function AnimatedMessageEdge({
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
  const edgeAnimations = useExecutionEdgeAnimations(id);
  const { removeEdgeAnimation } = useExecutionActions();
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

  useEffect(() => {
    if (edgeAnimations.length === 0) return;

    const timers = edgeAnimations.map((anim) =>
      setTimeout(() => {
        removeEdgeAnimation(anim.id);
      }, anim.duration)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [edgeAnimations, removeEdgeAnimation]);

  return (
    <>
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
      {edgeAnimations.map((anim) => (
        <circle key={anim.id} r="4" fill="#94a3b8" opacity="0.95">
          <animateMotion
            dur={`${anim.duration / 1000}s`}
            path={edgePath}
            fill="remove"
          />
        </circle>
      ))}
    </>
  );
}
