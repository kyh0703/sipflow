import { useEffect } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useExecutionStore } from '../store/execution-store';

export function AnimatedMessageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  // Filter animations for this specific edge using useShallow for performance
  const edgeAnimations = useExecutionStore(
    useShallow((state) => state.edgeAnimations.filter((a) => a.edgeId === id))
  );
  const removeEdgeAnimation = useExecutionStore((state) => state.removeEdgeAnimation);

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Branch color logic (same as BranchEdge for compatibility)
  const branchType = (data as any)?.branchType;
  const color =
    branchType === 'success'
      ? '#22c55e' // green
      : branchType === 'failure'
      ? '#ef4444' // red
      : '#94a3b8'; // gray

  // Auto-remove animations after their duration (memory leak prevention)
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
          strokeWidth: 2,
        }}
      />
      {edgeAnimations.map((anim) => (
        <circle key={anim.id} r="5" fill="#3b82f6" opacity="0.9">
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
