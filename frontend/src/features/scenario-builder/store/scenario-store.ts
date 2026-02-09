import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
} from '@xyflow/react';
import type { ScenarioNode, BranchEdgeData } from '../types/scenario';

interface ScenarioState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearCanvas: () => void;
  getInstanceNodes: () => Node[];
  getInstanceColor: (instanceId: string) => string;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    const branchType = connection.sourceHandle === 'success' ? 'success' : 'failure';
    const newEdge = {
      ...connection,
      type: 'branch',
      data: { branchType } as BranchEdgeData,
    };

    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setNodes: (nodes) => {
    set({ nodes });
  },

  setEdges: (edges) => {
    set({ edges });
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
    });
  },

  getInstanceNodes: () => {
    return get().nodes.filter((node) => node.type === 'sipInstance');
  },

  getInstanceColor: (instanceId: string) => {
    const instance = get().nodes.find((node) => node.id === instanceId && node.type === 'sipInstance');
    if (instance && instance.data && typeof instance.data.color === 'string') {
      return instance.data.color;
    }
    return '#94a3b8'; // gray default
  },
}));
