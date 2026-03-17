import {
  Position,
  type InternalNode,
  type XYPosition,
} from '@xyflow/react';

export type CalculatePosition = {
  width?: number;
  height?: number;
} & XYPosition;

export function toPositionByInternalNode(node: InternalNode): CalculatePosition {
  return {
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
  };
}

function getNodeIntersection(
  source: CalculatePosition,
  target: CalculatePosition
): XYPosition {
  if (!source.width && !source.height) {
    return { x: source.x, y: source.y };
  }

  const sw = (source.width ?? 0) / 2;
  const sh = (source.height ?? 0) / 2;
  const tw = (target.width ?? 0) / 2;
  const th = (target.height ?? 0) / 2;

  const x2 = source.x + sw;
  const y2 = source.y + sh;
  const x1 = target.x + tw;
  const y1 = target.y + th;

  const xx1 = (x1 - x2) / (2 * sw || 1) - (y1 - y2) / (2 * sh || 1);
  const yy1 = (x1 - x2) / (2 * sw || 1) + (y1 - y2) / (2 * sh || 1);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return {
    x: sw * (xx3 + yy3) + x2,
    y: sh * (-xx3 + yy3) + y2,
  };
}

function getEdgePosition(node: CalculatePosition, point: XYPosition) {
  const nx = Math.round(node.x);
  const ny = Math.round(node.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + (node.width ?? 0) - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + (node.height ?? 0) - 1) {
    return Position.Bottom;
  }

  return Position.Top;
}

export function getEdgeParams(source: CalculatePosition, target: CalculatePosition) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos: getEdgePosition(source, sourceIntersectionPoint),
    targetPos: getEdgePosition(target, targetIntersectionPoint),
  };
}
