import { createContext, useContext } from 'react';
import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';
import type { ValidationError } from '../lib/validation';

export interface ScenarioFlowContextValue {
  currentScenarioId: string | null;
  currentScenarioName: string | null;
  selectedNodeId: string | null;
  isDirty: boolean;
  saveStatus: 'saved' | 'modified' | 'saving';
  validationErrors: ValidationError[];
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  sipInstanceNodes: Node[];
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  setSelectedNode: (nodeId: string | null) => void;
  setCurrentScenario: (id: string | null, name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  deleteSelection: () => void;
  clearCanvas: () => void;
  loadFromJSON: (json: string) => void;
  toFlowJSON: () => string;
  saveNow: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}

export const ScenarioFlowContext = createContext<ScenarioFlowContextValue | null>(null);

export function useScenarioFlow() {
  const context = useContext(ScenarioFlowContext);
  if (!context) {
    throw new Error('useScenarioFlow must be used within ScenarioFlowContext provider');
  }
  return context;
}
