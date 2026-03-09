import { useShallow } from 'zustand/react/shallow';
import { useExecutionStore } from '../store/execution-store';

export function useExecutionStatus() {
  return useExecutionStore((state) => state.status);
}

export function useExecutionReadOnly() {
  return useExecutionStore((state) => state.status === 'running');
}

export function useExecutionActions() {
  return useExecutionStore(
    useShallow((state) => ({
      startListening: state.startListening,
      stopListening: state.stopListening,
      reset: state.reset,
      addEdgeAnimation: state.addEdgeAnimation,
      removeEdgeAnimation: state.removeEdgeAnimation,
    }))
  );
}

export function useExecutionActionLogs() {
  return useExecutionStore((state) => state.actionLogs);
}

export function useExecutionSipMessages() {
  return useExecutionStore((state) => state.sipMessages);
}

export function useExecutionNodeState(nodeId: string) {
  return useExecutionStore((state) => state.nodeStates[nodeId]);
}

export function useExecutionEdgeAnimations(edgeId: string) {
  return useExecutionStore(
    useShallow((state) => state.edgeAnimations.filter((animation) => animation.edgeId === edgeId))
  );
}
