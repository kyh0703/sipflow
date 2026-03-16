import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';

export interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface UseUndoRedoParams {
  nodesRef: MutableRefObject<Node[]>;
  edgesRef: MutableRefObject<Edge[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setDirty: (dirty: boolean) => void;
}

function cloneNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  }));
}

function cloneEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
  }));
}

function createSnapshot(nodes: Node[], edges: Edge[]): FlowSnapshot {
  return {
    nodes: cloneNodes(nodes),
    edges: cloneEdges(edges),
  };
}

export function useUndoRedo({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  setSelectedNodeId,
  setDirty,
}: UseUndoRedoParams) {
  const [historyPast, setHistoryPast] = useState<FlowSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<FlowSnapshot[]>([]);

  const resetHistory = useCallback(() => {
    setHistoryPast([]);
    setHistoryFuture([]);
  }, []);

  const pushHistory = useCallback(() => {
    const snapshot = createSnapshot(nodesRef.current, edgesRef.current);
    setHistoryPast((prev) => [...prev, snapshot].slice(-50));
    setHistoryFuture([]);
  }, [edgesRef, nodesRef]);

  const undo = useCallback(() => {
    if (historyPast.length === 0) {
      return;
    }

    const previous = historyPast[historyPast.length - 1];
    const currentSnapshot = createSnapshot(nodesRef.current, edgesRef.current);

    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [...prev, currentSnapshot].slice(-50));
    setNodes(cloneNodes(previous.nodes));
    setEdges(cloneEdges(previous.edges));
    setSelectedNodeId(null);
    setDirty(true);
  }, [edgesRef, historyPast, nodesRef, setDirty, setEdges, setNodes, setSelectedNodeId]);

  const redo = useCallback(() => {
    if (historyFuture.length === 0) {
      return;
    }

    const next = historyFuture[historyFuture.length - 1];
    const currentSnapshot = createSnapshot(nodesRef.current, edgesRef.current);

    setHistoryPast((prev) => [...prev, currentSnapshot].slice(-50));
    setHistoryFuture((prev) => prev.slice(0, -1));
    setNodes(cloneNodes(next.nodes));
    setEdges(cloneEdges(next.edges));
    setSelectedNodeId(null);
    setDirty(true);
  }, [edgesRef, historyFuture, nodesRef, setDirty, setEdges, setNodes, setSelectedNodeId]);

  return {
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    pushHistory,
    resetHistory,
    undo,
    redo,
  };
}
