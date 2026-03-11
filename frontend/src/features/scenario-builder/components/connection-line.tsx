import { getStraightPath, type ConnectionLineComponentProps } from '@xyflow/react';

export function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: Readonly<ConnectionLineComponentProps>) {
  const [edgePath] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  return (
    <g>
      <path d={edgePath} fill="none" className="stroke-slate-400 stroke-[1.5]" />
      <circle cx={toX} cy={toY} r={3} className="fill-slate-400 stroke-slate-500 stroke-1" />
    </g>
  );
}
