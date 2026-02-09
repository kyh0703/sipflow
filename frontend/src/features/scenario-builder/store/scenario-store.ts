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
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  isDirty: boolean;
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
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  toFlowJSON: () => string;
  loadFromJSON: (json: string) => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentScenarioId: null,
  currentScenarioName: null,
  isDirty: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
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
      isDirty: true,
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
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

  setCurrentScenario: (id: string | null, name: string | null) => {
    set({
      currentScenarioId: id,
      currentScenarioName: name,
    });
  },

  setDirty: (dirty: boolean) => {
    set({ isDirty: dirty });
  },

  toFlowJSON: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges });
  },

  loadFromJSON: (json: string) => {
    try {
      const { nodes, edges } = JSON.parse(json);
      set({
        nodes: nodes || [],
        edges: edges || [],
        isDirty: false,
      });
    } catch (error) {
      console.error('Failed to parse flow JSON:', error);
      throw error;
    }
  },
}));
