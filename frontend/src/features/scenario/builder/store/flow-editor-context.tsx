import { createContext, useContext, type ReactNode } from 'react';
import {
  useFlowEditorController,
  type FlowEditorContextValue,
} from '../hooks/use-flow-editor-controller';

const FlowEditorContext = createContext<FlowEditorContextValue | null>(null);

export function FlowEditorProvider({ children }: { children: ReactNode }) {
  const value = useFlowEditorController();

  return <FlowEditorContext.Provider value={value}>{children}</FlowEditorContext.Provider>;
}

function useFlowEditorContext() {
  const context = useContext(FlowEditorContext);

  if (!context) {
    throw new Error('FlowEditorProvider is missing from the component tree.');
  }

  return context;
}

export function useFlowEditorNodes() {
  return useFlowEditorContext().nodes;
}

export function useFlowEditorEdges() {
  return useFlowEditorContext().edges;
}

export function useFlowEditorSelectedNodeId() {
  return useFlowEditorContext().selectedNodeId;
}

export function useFlowEditorValidationErrors() {
  return useFlowEditorContext().validationErrors;
}

export function useFlowEditorCanUndo() {
  return useFlowEditorContext().canUndo;
}

export function useFlowEditorCanRedo() {
  return useFlowEditorContext().canRedo;
}

export function useFlowEditorActions() {
  return useFlowEditorContext().actions;
}

export function useFlowEditorHorizontalLine() {
  return useFlowEditorContext().horizontalLine;
}

export function useFlowEditorVerticalLine() {
  return useFlowEditorContext().verticalLine;
}
