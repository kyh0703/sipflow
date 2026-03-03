import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime/runtime';
import type {
  ScenarioExecutionStatus,
  NodeExecutionState,
  ActionLog,
  NodeStateEvent,
  ActionLogEvent,
  ScenarioStartedEvent,
  ScenarioCompletedEvent,
  ScenarioFailedEvent,
  ScenarioStoppedEvent,
  EdgeAnimationMessage,
} from '../types/execution';
import { EXECUTION_EVENTS } from '../types/execution';

interface ExecutionState {
  status: ScenarioExecutionStatus;
  nodeStates: Record<string, NodeExecutionState>;
  actionLogs: ActionLog[];
  sipMessages: ActionLog[];
  edgeAnimations: EdgeAnimationMessage[];
  scenarioError: string | null;
  startListening: () => void;
  stopListening: () => void;
  updateNodeState: (event: NodeStateEvent) => void;
  addActionLog: (event: ActionLogEvent) => void;
  addEdgeAnimation: (animation: EdgeAnimationMessage) => void;
  removeEdgeAnimation: (id: string) => void;
  reset: () => void;
  getNodeStatus: (nodeId: string) => NodeExecutionState | undefined;
  isRunning: () => boolean;
}

const MAX_ACTION_LOGS = 500;

const ExecutionStoreContext = createContext<ExecutionState | null>(null);

export function ExecutionStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ScenarioExecutionStatus>('idle');
  const [nodeStates, setNodeStates] = useState<Record<string, NodeExecutionState>>({});
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [sipMessages, setSipMessages] = useState<ActionLog[]>([]);
  const [edgeAnimations, setEdgeAnimations] = useState<EdgeAnimationMessage[]>([]);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const listeningRef = useRef(false);
  const statusRef = useRef<ScenarioExecutionStatus>('idle');
  const nodeStatesRef = useRef<Record<string, NodeExecutionState>>({});

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    nodeStatesRef.current = nodeStates;
  }, [nodeStates]);

  const updateNodeState = useCallback((event: NodeStateEvent) => {
    setNodeStates((prevNodeStates) => {
      const existingNode = prevNodeStates[event.nodeId];
      const updatedNode: NodeExecutionState = {
        nodeId: event.nodeId,
        status: event.newState,
        startedAt: existingNode?.startedAt || (event.newState === 'running' ? event.timestamp : undefined),
        completedAt:
          event.newState === 'completed' || event.newState === 'failed'
            ? event.timestamp
            : existingNode?.completedAt,
      };

      return {
        ...prevNodeStates,
        [event.nodeId]: updatedNode,
      };
    });
  }, []);

  const addActionLog = useCallback((event: ActionLogEvent) => {
    setActionLogs((prevLogs) => {
      const newLog: ActionLog = {
        id: `${event.timestamp}-${prevLogs.length}`,
        timestamp: event.timestamp,
        nodeId: event.nodeId,
        instanceId: event.instanceId,
        message: event.message,
        level: event.level,
        sipMessage: event.sipMessage,
      };

      const nextLogs = [...prevLogs, newLog];
      if (nextLogs.length > MAX_ACTION_LOGS) {
        return nextLogs.slice(nextLogs.length - MAX_ACTION_LOGS);
      }

      return nextLogs;
    });

    if (!event.sipMessage) {
      return;
    }

    setSipMessages((prevMessages) => {
      const newLog: ActionLog = {
        id: `${event.timestamp}-${prevMessages.length}`,
        timestamp: event.timestamp,
        nodeId: event.nodeId,
        instanceId: event.instanceId,
        message: event.message,
        level: event.level,
        sipMessage: event.sipMessage,
      };

      const nextMessages = [...prevMessages, newLog];
      if (nextMessages.length > MAX_ACTION_LOGS) {
        return nextMessages.slice(nextMessages.length - MAX_ACTION_LOGS);
      }

      return nextMessages;
    });
  }, []);

  const addEdgeAnimation = useCallback((animation: EdgeAnimationMessage) => {
    setEdgeAnimations((prevAnimations) => [...prevAnimations, animation]);
  }, []);

  const removeEdgeAnimation = useCallback((id: string) => {
    setEdgeAnimations((prevAnimations) => prevAnimations.filter((animation) => animation.id !== id));
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setNodeStates({});
    setActionLogs([]);
    setSipMessages([]);
    setEdgeAnimations([]);
    setScenarioError(null);
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) {
      return;
    }

    listeningRef.current = true;

    EventsOn(EXECUTION_EVENTS.NODE_STATE, (event: NodeStateEvent) => {
      updateNodeState(event);
    });

    EventsOn(EXECUTION_EVENTS.ACTION_LOG, (event: ActionLogEvent) => {
      addActionLog(event);
    });

    EventsOn(EXECUTION_EVENTS.STARTED, (_event: ScenarioStartedEvent) => {
      setStatus('running');
      setScenarioError(null);
    });

    EventsOn(EXECUTION_EVENTS.COMPLETED, (_event: ScenarioCompletedEvent) => {
      setStatus('completed');
    });

    EventsOn(EXECUTION_EVENTS.FAILED, (event: ScenarioFailedEvent) => {
      setStatus('failed');
      setScenarioError(event.error);
    });

    EventsOn(EXECUTION_EVENTS.STOPPED, (_event: ScenarioStoppedEvent) => {
      setStatus('stopped');
    });
  }, [addActionLog, updateNodeState]);

  const stopListening = useCallback(() => {
    if (!listeningRef.current) {
      return;
    }

    EventsOff(
      EXECUTION_EVENTS.NODE_STATE,
      EXECUTION_EVENTS.ACTION_LOG,
      EXECUTION_EVENTS.STARTED,
      EXECUTION_EVENTS.COMPLETED,
      EXECUTION_EVENTS.FAILED,
      EXECUTION_EVENTS.STOPPED
    );

    listeningRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const getNodeStatus = useCallback((nodeId: string) => {
    return nodeStatesRef.current[nodeId];
  }, []);

  const isRunning = useCallback(() => {
    return statusRef.current === 'running';
  }, []);

  const state = useMemo<ExecutionState>(
    () => ({
      status,
      nodeStates,
      actionLogs,
      sipMessages,
      edgeAnimations,
      scenarioError,
      startListening,
      stopListening,
      updateNodeState,
      addActionLog,
      addEdgeAnimation,
      removeEdgeAnimation,
      reset,
      getNodeStatus,
      isRunning,
    }),
    [
      actionLogs,
      addActionLog,
      addEdgeAnimation,
      edgeAnimations,
      getNodeStatus,
      isRunning,
      nodeStates,
      removeEdgeAnimation,
      reset,
      scenarioError,
      sipMessages,
      startListening,
      status,
      stopListening,
      updateNodeState,
    ]
  );

  return <ExecutionStoreContext.Provider value={state}>{children}</ExecutionStoreContext.Provider>;
}

export function useExecutionStore<T>(selector: (state: ExecutionState) => T): T {
  const state = useContext(ExecutionStoreContext);

  if (!state) {
    throw new Error('useExecutionStore must be used within ExecutionStoreProvider');
  }

  return selector(state);
}
