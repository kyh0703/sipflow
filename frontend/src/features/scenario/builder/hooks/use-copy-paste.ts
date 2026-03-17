import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type Edge, type Node, useReactFlow } from '@xyflow/react';
import { useFlowEditorActions } from '../store/flow-editor-context';
import { useNodes } from './use-nodes';

const PASTE_OFFSET = 40;

interface ClipboardSnapshot {
  nodes: Node[];
  edges: Edge[];
  pasteCount: number;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneNode(node: Node): Node {
  return {
    ...node,
    data: cloneValue(node.data),
    position: { ...node.position },
  };
}

function cloneEdge(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? cloneValue(edge.data) : edge.data,
  };
}

function buildEdgeID(source: string, target: string): string {
  return `${source}-${target}`;
}

function getReferencePosition(nodes: Node[]) {
  if (nodes.length === 0) {
    return { x: 0, y: 0 };
  }

  return nodes.reduce(
    (acc, node) => ({
      x: Math.min(acc.x, node.position.x),
      y: Math.min(acc.y, node.position.y),
    }),
    { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }
  );
}

export function useCopyPaste() {
  const clipboardRef = useRef<ClipboardSnapshot | null>(null);
  const { getEdges } = useReactFlow<Node, Edge>();
  const { getSelectedNodes } = useNodes();
  const { addElements, removeSelectedElements, setSelectedNode } = useFlowEditorActions();

  const copy = useCallback(() => {
    const selectedNodes = getSelectedNodes().map(cloneNode);

    if (selectedNodes.length === 0) {
      return;
    }

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = getEdges()
      .filter(
        (edge) =>
          selectedNodeIds.has(edge.source) &&
          selectedNodeIds.has(edge.target)
      )
      .map(cloneEdge);

    clipboardRef.current = {
      nodes: selectedNodes,
      edges: selectedEdges,
      pasteCount: 0,
    };
  }, [getEdges, getSelectedNodes]);

  const cut = useCallback(() => {
    const selectedNodes = getSelectedNodes();

    if (selectedNodes.length === 0) {
      return;
    }

    copy();
    setSelectedNode(null);
    removeSelectedElements();
  }, [copy, getSelectedNodes, removeSelectedElements, setSelectedNode]);

  const paste = useCallback(() => {
    const snapshot = clipboardRef.current;

    if (!snapshot || snapshot.nodes.length === 0) {
      return;
    }

    snapshot.pasteCount += 1;

    const idMap = new Map<string, string>();
    const reference = getReferencePosition(snapshot.nodes);
    const offset = snapshot.pasteCount * PASTE_OFFSET;

    const nextNodes = snapshot.nodes.map((node) => {
      const nextId = uuidv4();
      idMap.set(node.id, nextId);

      return {
        ...cloneNode(node),
        id: nextId,
        selected: true,
        position: {
          x: node.position.x - reference.x + reference.x + offset,
          y: node.position.y - reference.y + reference.y + offset,
        },
      };
    });

    const nextEdges = snapshot.edges.reduce<Edge[]>((acc, edge) => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);

        if (!source || !target) {
          return acc;
        }

        acc.push({
          ...cloneEdge(edge),
          id: buildEdgeID(source, target),
          source,
          target,
          selected: true,
        });

        return acc;
      }, []);

    addElements(nextNodes, nextEdges);
    setSelectedNode(nextNodes.length === 1 ? nextNodes[0].id : null);
  }, [addElements, setSelectedNode]);

  return {
    copy,
    cut,
    paste,
  };
}
