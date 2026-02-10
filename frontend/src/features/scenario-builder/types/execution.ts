// 노드 실행 상태
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

// 시나리오 실행 상태
export type ScenarioExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

// Wails 이벤트 이름 상수
export const EXECUTION_EVENTS = {
  NODE_STATE: 'scenario:node-state',
  ACTION_LOG: 'scenario:action-log',
  STARTED: 'scenario:started',
  COMPLETED: 'scenario:completed',
  FAILED: 'scenario:failed',
  STOPPED: 'scenario:stopped',
} as const;

// Go -> Frontend 이벤트 페이로드 타입
export interface NodeStateEvent {
  nodeId: string;
  previousState: NodeExecutionStatus;
  newState: NodeExecutionStatus;
  timestamp: number;
}

export interface ActionLogEvent {
  timestamp: number;
  nodeId: string;
  instanceId: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

export interface ScenarioStartedEvent {
  scenarioId: string;
  timestamp: number;
}

export interface ScenarioCompletedEvent {
  timestamp: number;
}

export interface ScenarioFailedEvent {
  timestamp: number;
  error: string;
}

export interface ScenarioStoppedEvent {
  timestamp: number;
}

// Store에서 사용하는 노드 상태
export interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: number;
  completedAt?: number;
}

// Store에서 사용하는 액션 로그
export interface ActionLog {
  id: string;  // 고유 ID (timestamp + index)
  timestamp: number;
  nodeId: string;
  instanceId: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}
