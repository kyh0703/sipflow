import { useEffect, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';
import { getEdgeParams, toPositionByInternalNode } from '../lib/easy-connection';
import {
  useExecutionActions,
  useExecutionEdgeAnimations,
} from '@/features/execution/store/execution-store';
import type { BranchEdgeData } from '../types/scenario';

function getStraightEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
) {
  return {
    path: `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2 - 10,
  };
}

export function BranchEdge({
  id,
  selected,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
  markerStart,
  style,
}: EdgeProps) {
  const edgeAnimations = useExecutionEdgeAnimations(id);
  const { removeEdgeAnimation } = useExecutionActions();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeGeometry = useMemo(() => {
    const fallback = getStraightEdgePath(sourceX, sourceY, targetX, targetY);

    if (!sourceNode || !targetNode) {
      return fallback;
    }

    const { sx, sy, tx, ty } = getEdgeParams(
      toPositionByInternalNode(sourceNode),
      toPositionByInternalNode(targetNode)
    );

    return getStraightEdgePath(sx, sy, tx, ty);
  }, [sourceNode, sourceX, sourceY, targetNode, targetX, targetY]);

  const edgeData = data as BranchEdgeData | undefined;
  const branchType = edgeData?.branchType;
  const color = branchType === 'failure' ? '#e7a7b3' : '#cbd5e1';
  const strokeDasharray = selected ? '5 5' : branchType === 'failure' ? '6 6' : undefined;
  const label = edgeData?.condition ?? (branchType === 'failure' ? 'failure' : undefined);

  useEffect(() => {
    if (edgeAnimations.length === 0) {
      return;
    }

    const timers = edgeAnimations.map((animation) =>
      setTimeout(() => {
        removeEdgeAnimation(animation.id);
      }, animation.duration)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [edgeAnimations, removeEdgeAnimation]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgeGeometry.path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray,
          strokeLinecap: 'round',
        }}
      />
      {!selected && label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${edgeGeometry.labelX}px, ${edgeGeometry.labelY}px)`,
              background: color,
            }}
            className="nodrag nopan absolute rounded px-1 py-0.5 text-[10px] font-semibold text-slate-950 shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {edgeAnimations.map((animation) => (
        <circle key={animation.id} r="4" fill={color} opacity="0.95">
          <animateMotion
            dur={`${animation.duration / 1000}s`}
            path={edgeGeometry.path}
            fill="remove"
          />
        </circle>
      ))}
    </>
  );
}

export const edgeTypes = {
  branch: BranchEdge,
};
