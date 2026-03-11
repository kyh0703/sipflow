import type { Node, NodePositionChange, XYPosition } from '@xyflow/react';

interface HelperLineResult {
  horizontal?: number;
  vertical?: number;
  snapPosition: Partial<XYPosition>;
}

export function getHelperLines(
  change: NodePositionChange,
  nodes: Node[],
  distance = 5
): HelperLineResult {
  const defaultResult: HelperLineResult = {
    horizontal: undefined,
    vertical: undefined,
    snapPosition: { x: undefined, y: undefined },
  };

  const currentNode = nodes.find((node) => node.id === change.id);
  if (!currentNode || !change.position) {
    return defaultResult;
  }

  const currentBounds = {
    left: change.position.x,
    right: change.position.x + (currentNode.measured?.width ?? 0),
    top: change.position.y,
    bottom: change.position.y + (currentNode.measured?.height ?? 0),
    width: currentNode.measured?.width ?? 0,
    height: currentNode.measured?.height ?? 0,
  };

  let horizontalDistance = distance;
  let verticalDistance = distance;

  return nodes
    .filter((node) => node.id !== currentNode.id)
    .reduce<HelperLineResult>((result, node) => {
      const targetBounds = {
        left: node.position.x,
        right: node.position.x + (node.measured?.width ?? 0),
        top: node.position.y,
        bottom: node.position.y + (node.measured?.height ?? 0),
        width: node.measured?.width ?? 0,
        height: node.measured?.height ?? 0,
      };

      const distanceLeftLeft = Math.abs(currentBounds.left - targetBounds.left);
      if (distanceLeftLeft < verticalDistance) {
        result.snapPosition.x = targetBounds.left;
        result.vertical = targetBounds.left;
        verticalDistance = distanceLeftLeft;
      }

      const distanceRightRight = Math.abs(currentBounds.right - targetBounds.right);
      if (distanceRightRight < verticalDistance) {
        result.snapPosition.x = targetBounds.right - currentBounds.width;
        result.vertical = targetBounds.right;
        verticalDistance = distanceRightRight;
      }

      const distanceLeftRight = Math.abs(currentBounds.left - targetBounds.right);
      if (distanceLeftRight < verticalDistance) {
        result.snapPosition.x = targetBounds.right;
        result.vertical = targetBounds.right;
        verticalDistance = distanceLeftRight;
      }

      const distanceRightLeft = Math.abs(currentBounds.right - targetBounds.left);
      if (distanceRightLeft < verticalDistance) {
        result.snapPosition.x = targetBounds.left - currentBounds.width;
        result.vertical = targetBounds.left;
        verticalDistance = distanceRightLeft;
      }

      const distanceTopTop = Math.abs(currentBounds.top - targetBounds.top);
      if (distanceTopTop < horizontalDistance) {
        result.snapPosition.y = targetBounds.top;
        result.horizontal = targetBounds.top;
        horizontalDistance = distanceTopTop;
      }

      const distanceBottomTop = Math.abs(currentBounds.bottom - targetBounds.top);
      if (distanceBottomTop < horizontalDistance) {
        result.snapPosition.y = targetBounds.top - currentBounds.height;
        result.horizontal = targetBounds.top;
        horizontalDistance = distanceBottomTop;
      }

      const distanceBottomBottom = Math.abs(currentBounds.bottom - targetBounds.bottom);
      if (distanceBottomBottom < horizontalDistance) {
        result.snapPosition.y = targetBounds.bottom - currentBounds.height;
        result.horizontal = targetBounds.bottom;
        horizontalDistance = distanceBottomBottom;
      }

      const distanceTopBottom = Math.abs(currentBounds.top - targetBounds.bottom);
      if (distanceTopBottom < horizontalDistance) {
        result.snapPosition.y = targetBounds.bottom;
        result.horizontal = targetBounds.bottom;
        horizontalDistance = distanceTopBottom;
      }

      return result;
    }, defaultResult);
}
