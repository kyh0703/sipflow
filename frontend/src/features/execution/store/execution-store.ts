import { useShallow } from 'zustand/react/shallow';
import { createStore } from '@/lib/store';
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

interface ExecutionStoreState {
  status: ScenarioExecutionStatus;
  nodeStates: Record<string, NodeExecutionState>;
  actionLogs: ActionLog[];
  sipMessages: ActionLog[];
  edgeAnimations: EdgeAnimationMessage[];
  scenarioError: string | null;
}

interface ExecutionStoreActions {
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

type ExecutionStore = ExecutionStoreState & {
  actions: ExecutionStoreActions;
};

const MAX_ACTION_LOGS = 500;

export const useExecutionStore = createStore<ExecutionStore>(
  (set, get) => ({
    status: 'idle',
    nodeStates: {},
    actionLogs: [],
    sipMessages: [],
    edgeAnimations: [],
    scenarioError: null,
    actions: {
      startListening: () => {
        EventsOn(EXECUTION_EVENTS.NODE_STATE, (event: NodeStateEvent) => {
          get().actions.updateNodeState(event);
        });

        EventsOn(EXECUTION_EVENTS.ACTION_LOG, (event: ActionLogEvent) => {
          get().actions.addActionLog(event);
        });

        EventsOn(EXECUTION_EVENTS.STARTED, (_event: ScenarioStartedEvent) => {
          set((state) => {
            state.status = 'running';
            state.scenarioError = null;
          });
        });

        EventsOn(EXECUTION_EVENTS.COMPLETED, (_event: ScenarioCompletedEvent) => {
          set((state) => {
            state.status = 'completed';
          });
        });

        EventsOn(EXECUTION_EVENTS.FAILED, (event: ScenarioFailedEvent) => {
          set((state) => {
            state.status = 'failed';
            state.scenarioError = event.error;
          });
        });

        EventsOn(EXECUTION_EVENTS.STOPPED, (_event: ScenarioStoppedEvent) => {
          set((state) => {
            state.status = 'stopped';
          });
        });
      },
      stopListening: () => {
        EventsOff(
          EXECUTION_EVENTS.NODE_STATE,
          EXECUTION_EVENTS.ACTION_LOG,
          EXECUTION_EVENTS.STARTED,
          EXECUTION_EVENTS.COMPLETED,
          EXECUTION_EVENTS.FAILED,
          EXECUTION_EVENTS.STOPPED
        );
      },
      updateNodeState: (event) => {
        set((state) => {
          const existingNode = state.nodeStates[event.nodeId];
          state.nodeStates[event.nodeId] = {
            nodeId: event.nodeId,
            status: event.newState,
            startedAt:
              existingNode?.startedAt ||
              (event.newState === 'running' ? event.timestamp : undefined),
            completedAt:
              event.newState === 'completed' || event.newState === 'failed'
                ? event.timestamp
                : existingNode?.completedAt,
          };
        });
      },
      addActionLog: (event) => {
        set((state) => {
          const sipMessage = event.sipMessage
            ? {
                ...event.sipMessage,
                callId: event.sipMessage.callId || event.callId,
              }
            : undefined;

          const newLog: ActionLog = {
            id: `${event.timestamp}-${state.actionLogs.length}`,
            timestamp: event.timestamp,
            nodeId: event.nodeId,
            instanceId: event.instanceId,
            callId: event.callId,
            message: event.message,
            level: event.level,
            sipMessage,
          };

          state.actionLogs.push(newLog);
          if (state.actionLogs.length > MAX_ACTION_LOGS) {
            state.actionLogs.splice(0, state.actionLogs.length - MAX_ACTION_LOGS);
          }

          if (event.sipMessage) {
            state.sipMessages.push(newLog);
            if (state.sipMessages.length > MAX_ACTION_LOGS) {
              state.sipMessages.splice(0, state.sipMessages.length - MAX_ACTION_LOGS);
            }
          }
        });
      },
      addEdgeAnimation: (animation) => {
        set((state) => {
          state.edgeAnimations.push(animation);
        });
      },
      removeEdgeAnimation: (id) => {
        set((state) => {
          state.edgeAnimations = state.edgeAnimations.filter(
            (anim: EdgeAnimationMessage) => anim.id !== id
          );
        });
      },
      reset: () => {
        set((state) => {
          state.status = 'idle';
          state.nodeStates = {};
          state.actionLogs = [];
          state.sipMessages = [];
          state.edgeAnimations = [];
          state.scenarioError = null;
        });
      },
      getNodeStatus: (nodeId) => get().nodeStates[nodeId],
      isRunning: () => get().status === 'running',
    },
  }),
  {
    name: 'execution-store',
  }
);

export const useExecutionStatus = () =>
  useExecutionStore((state) => state.status);

export const useExecutionActionLogs = () =>
  useExecutionStore((state) => state.actionLogs);

export const useExecutionSipMessages = () =>
  useExecutionStore((state) => state.sipMessages);

export const useExecutionScenarioError = () =>
  useExecutionStore((state) => state.scenarioError);

export const useExecutionNodeState = (nodeId: string) =>
  useExecutionStore((state) => state.nodeStates[nodeId]);

export const useExecutionEdgeAnimations = (edgeId: string) =>
  useExecutionStore(
    useShallow((state) => state.edgeAnimations.filter((animation) => animation.edgeId === edgeId))
  );

export const useExecutionActions = () =>
  useExecutionStore((state) => state.actions);
