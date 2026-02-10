// 컴포넌트에서 사용 시: import { useShallow } from 'zustand/react/shallow'
import { create } from 'zustand';
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
  nodeStates: Record<string, NodeExecutionState>;  // nodeId -> state
  actionLogs: ActionLog[];
  sipMessages: ActionLog[];  // sipMessage 필드가 있는 로그만 필터링
  edgeAnimations: EdgeAnimationMessage[];  // 현재 활성 엣지 애니메이션
  scenarioError: string | null;

  // 이벤트 리스너 관리
  startListening: () => void;
  stopListening: () => void;

  // 상태 업데이트
  updateNodeState: (event: NodeStateEvent) => void;
  addActionLog: (event: ActionLogEvent) => void;
  addEdgeAnimation: (animation: EdgeAnimationMessage) => void;
  removeEdgeAnimation: (id: string) => void;

  // 리셋
  reset: () => void;

  // 유틸리티
  getNodeStatus: (nodeId: string) => NodeExecutionState | undefined;
  isRunning: () => boolean;
}

const MAX_ACTION_LOGS = 500;

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  nodeStates: {},
  actionLogs: [],
  sipMessages: [],
  edgeAnimations: [],
  scenarioError: null,

  startListening: () => {
    // scenario:node-state 이벤트
    EventsOn(EXECUTION_EVENTS.NODE_STATE, (event: NodeStateEvent) => {
      get().updateNodeState(event);
    });

    // scenario:action-log 이벤트
    EventsOn(EXECUTION_EVENTS.ACTION_LOG, (event: ActionLogEvent) => {
      get().addActionLog(event);
    });

    // scenario:started 이벤트
    EventsOn(EXECUTION_EVENTS.STARTED, (event: ScenarioStartedEvent) => {
      set({ status: 'running', scenarioError: null });
    });

    // scenario:completed 이벤트
    EventsOn(EXECUTION_EVENTS.COMPLETED, (event: ScenarioCompletedEvent) => {
      set({ status: 'completed' });
    });

    // scenario:failed 이벤트
    EventsOn(EXECUTION_EVENTS.FAILED, (event: ScenarioFailedEvent) => {
      set({ status: 'failed', scenarioError: event.error });
    });

    // scenario:stopped 이벤트
    EventsOn(EXECUTION_EVENTS.STOPPED, (event: ScenarioStoppedEvent) => {
      set({ status: 'stopped' });
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

  updateNodeState: (event: NodeStateEvent) => {
    set((state) => {
      const existingNode = state.nodeStates[event.nodeId];
      const updatedNode: NodeExecutionState = {
        nodeId: event.nodeId,
        status: event.newState,
        startedAt: existingNode?.startedAt || (event.newState === 'running' ? event.timestamp : undefined),
        completedAt: (event.newState === 'completed' || event.newState === 'failed') ? event.timestamp : existingNode?.completedAt,
      };

      return {
        nodeStates: {
          ...state.nodeStates,
          [event.nodeId]: updatedNode,
        },
      };
    });
  },

  addActionLog: (event: ActionLogEvent) => {
    set((state) => {
      const newLog: ActionLog = {
        id: `${event.timestamp}-${state.actionLogs.length}`,
        timestamp: event.timestamp,
        nodeId: event.nodeId,
        instanceId: event.instanceId,
        message: event.message,
        level: event.level,
        sipMessage: event.sipMessage,
      };

      const updatedLogs = [...state.actionLogs, newLog];

      // 최대 500개 유지 (오래된 것 삭제)
      if (updatedLogs.length > MAX_ACTION_LOGS) {
        updatedLogs.splice(0, updatedLogs.length - MAX_ACTION_LOGS);
      }

      // sipMessage가 있으면 sipMessages 배열에도 추가
      let updatedSipMessages = state.sipMessages;
      if (event.sipMessage) {
        updatedSipMessages = [...state.sipMessages, newLog];
        // sipMessages도 최대 500개 유지
        if (updatedSipMessages.length > MAX_ACTION_LOGS) {
          updatedSipMessages.splice(0, updatedSipMessages.length - MAX_ACTION_LOGS);
        }
      }

      return {
        actionLogs: updatedLogs,
        sipMessages: updatedSipMessages,
      };
    });
  },

  addEdgeAnimation: (animation: EdgeAnimationMessage) => {
    set((state) => ({
      edgeAnimations: [...state.edgeAnimations, animation],
    }));
  },

  removeEdgeAnimation: (id: string) => {
    set((state) => ({
      edgeAnimations: state.edgeAnimations.filter(anim => anim.id !== id),
    }));
  },

  reset: () => {
    set({
      status: 'idle',
      nodeStates: {},
      actionLogs: [],
      sipMessages: [],
      edgeAnimations: [],
      scenarioError: null,
    });
  },

  getNodeStatus: (nodeId: string) => {
    return get().nodeStates[nodeId];
  },

  isRunning: () => {
    return get().status === 'running';
  },
}));
