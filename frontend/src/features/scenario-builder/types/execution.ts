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

// SIP 메시지 상세 정보
export interface SIPMessageDetail {
  direction: 'sent' | 'received';
  method?: string;          // INVITE, BYE, ACK, CANCEL
  responseCode?: number;    // 200, 180, 404, 0 (해당없음)
  callId?: string;
  from?: string;
  to?: string;
}

// 엣지 애니메이션 메시지
export interface EdgeAnimationMessage {
  id: string;           // 고유 ID
  edgeId: string;       // XYFlow edge ID
  method: string;       // SIP 메서드 (INVITE, BYE 등)
  timestamp: number;    // 시작 타임스탬프
  duration: number;     // 애니메이션 지속 시간 (ms), 기본 1000
}

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
  sipMessage?: SIPMessageDetail;
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
  sipMessage?: SIPMessageDetail;
}
