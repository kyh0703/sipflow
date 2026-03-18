# Phase 03 Research: SIP 엔진

## 1. diago API 분석

### 1.1 기본 아키텍처

**핵심 타입 구조:**
- `Diago`: SIP UA 인스턴스의 엔트리포인트. B2BUA 역할 (Server + Client)
- `DialogSession`: 인터페이스. 통화 세션의 공통 추상화
  - `DialogClientSession`: 발신 세션 (outbound leg)
  - `DialogServerSession`: 수신 세션 (inbound leg)
- `Transport`: SIP 전송 계층 설정 (UDP/TCP/TLS, 바인드 주소/포트)
- `DialogMedia`: 미디어 세션 관리 (RTP/RTCP, 코덱, DTMF)
- `Bridge`: 2자 통화 브릿지 (현재는 2-party만 지원)

**diago 인스턴스 생성 패턴:**
```go
// 1. sipgo UserAgent 생성
ua, _ := sipgo.NewUA()

// 2. Diago 인스턴스 생성 + 옵션 적용
dg := diago.NewDiago(ua,
    diago.WithTransport(diago.Transport{
        Transport: "udp",      // udp, tcp, ws, tls
        BindHost:  "127.0.0.1",
        BindPort:  5060,       // 0 = ephemeral port
    }),
    diago.WithMediaConfig(diago.MediaConfig{
        Codecs: []media.Codec{
            media.CodecAudioUlaw,
            media.CodecAudioAlaw,
            media.CodecTelephoneEvent8000,
        },
    }),
    diago.WithLogger(slog.New(...)),
)

// 3. Serve 호출 (server 역할 시작)
ctx := context.Background()
dg.Serve(ctx, func(inDialog *diago.DialogServerSession) {
    // incoming call handler
})
```

**로컬 모드 포트 할당 전략:**
- `BindPort: 0`으로 설정하면 OS가 ephemeral port 자동 할당
- `Serve()` 내부에서 `sipgo.ListenReadyCtxKey`로 실제 바인딩된 포트를 콜백으로 통지
- 여러 UA 동시 실행 시 각각 독립 포트 자동 할당됨
- **권장 방식**: 5060부터 +2 간격으로 순차 할당 (5060, 5062, 5064...)
  - RTP 포트는 diago/media 패키지가 자동으로 다른 범위에서 할당

### 1.2 Command 실행 API

**MakeCall (발신):**
```go
recipient := sip.Uri{
    User: "100",
    Host: "127.0.0.1",
    Port: 5062,
}

// 방법 1: Invite (헬퍼 함수, Invite + Ack 자동 수행)
dialog, err := dg.Invite(ctx, recipient, diago.InviteOptions{})
if err != nil {
    // 실패 처리 (timeout, 486 Busy, 503 등)
}
defer dialog.Close()
defer dialog.Hangup(ctx)

// 방법 2: NewDialog + Invite + Ack (세밀한 제어)
dialog, err := dg.NewDialog(recipient, diago.NewDialogOptions{})
if err != nil { return err }
err = dialog.Invite(ctx, diago.InviteClientOptions{
    OnResponse: func(res *sip.Response) error {
        // 1xx, 2xx 응답 처리 (예: 183 Session Progress)
        return nil
    },
})
if err != nil {
    // 200 OK (SDP) 수신 실패
    return err
}
err = dialog.Ack(ctx) // ACK 전송
```

**Answer (응답):**
```go
func handleIncoming(inDialog *diago.DialogServerSession) {
    inDialog.Trying()   // 100 Trying
    inDialog.Ringing()  // 180 Ringing

    // Answer 호출 = 200 OK + SDP + 미디어 세션 시작
    if err := inDialog.Answer(); err != nil {
        // 미디어 세션 생성 실패
    }

    // 이제 inDialog.Context()가 활성 상태
    // BYE 수신 시 context 취소됨
}
```

**Release (종료):**
```go
// Hangup = BYE 전송 + 200 OK 대기
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

err := dialog.Hangup(ctx)
if err != nil {
    // BYE 전송 실패 또는 응답 timeout
}

// Close = 리소스 정리 (항상 defer로 호출 권장)
dialog.Close()
```

### 1.3 Event 수신 메커니즘

**Incoming Event (수신 전화):**
```go
dg.Serve(ctx, func(inDialog *diago.DialogServerSession) {
    // 이 함수가 INVITE 수신 시 자동 호출됨
    // inDialog.InviteRequest로 원본 INVITE 접근 가능

    caller := inDialog.FromUser()  // 발신자 번호
    callee := inDialog.ToUser()    // 수신자 번호

    // Event 노드가 이 시점에 트리거됨
})
```

**Disconnected Event (통화 종료):**
```go
// Dialog의 Context()가 통화 lifecycle과 연동됨
dialogCtx := dialog.Context()

// BYE 수신 시 dialogCtx가 Done() 상태가 됨
<-dialogCtx.Done()
// → 이 시점에 DISCONNECTED 이벤트 발행
```

**Ringing Event:**
```go
// InviteClientOptions.OnResponse로 중간 응답 감지
err := dialog.Invite(ctx, diago.InviteClientOptions{
    OnResponse: func(res *sip.Response) error {
        if res.StatusCode == 180 {
            // RINGING 이벤트 발행
        }
        return nil
    },
})
```

**Timeout Event:**
```go
// context.WithTimeout으로 타임아웃 제어
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

err := dialog.Invite(ctx, ...)
if errors.Is(err, context.DeadlineExceeded) {
    // TIMEOUT 이벤트 발행 → failure 분기로
}
```

### 1.4 로컬 모드 UA간 통신

**127.0.0.1 바인딩 검증 (diago_test.go에서 확인):**
- diago는 기본적으로 실제 SIP 메시지를 네트워크를 통해 송수신
- 로컬 모드 = 모든 UA가 127.0.0.1에 바인딩, 서로 다른 포트
- Mock이 아니라 **실제 SIP/RTP 트래픽**이 localhost에서 발생

**예시: 2개 UA 로컬 통신**
```go
// UA A (caller)
uaA, _ := sipgo.NewUA()
dgA := diago.NewDiago(uaA, diago.WithTransport(diago.Transport{
    Transport: "udp",
    BindHost:  "127.0.0.1",
    BindPort:  5060,
}))

// UA B (callee)
uaB, _ := sipgo.NewUA()
dgB := diago.NewDiago(uaB, diago.WithTransport(diago.Transport{
    Transport: "udp",
    BindHost:  "127.0.0.1",
    BindPort:  5062,
}))

// B가 서버로 대기
go dgB.Serve(ctx, func(inDialog *diago.DialogServerSession) {
    inDialog.Answer()
    // ...
})

// A가 B로 전화
recipient := sip.Uri{User: "bob", Host: "127.0.0.1", Port: 5062}
dialog, err := dgA.Invite(ctx, recipient, diago.InviteOptions{})
```

**주요 발견:**
- diago는 sipgo 위에 구축되어 실제 UDP/TCP 소켓 사용
- 127.0.0.1 바인딩으로도 완전한 SIP 프로토콜 동작 (INVITE, ACK, BYE, RTP 등)
- 테스트에서도 실제 네트워크 스택 사용 (mock 없음)

### 1.5 context.Context 기반 취소/타임아웃

**다이얼로그 lifecycle과 context 연동:**
```go
dialog, _ := dg.Invite(ctx, recipient, opts)

// dialog.Context()는 다이얼로그 수명과 연동된 별도 context
dialogCtx := dialog.Context()

// BYE 수신/전송 시 dialogCtx 자동 취소
select {
case <-dialogCtx.Done():
    // 통화 종료됨
}
```

**goroutine 취소 패턴:**
```go
// 인스턴스별 goroutine 실행
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

go func() {
    // 노드 체인 실행
    for _, node := range nodes {
        select {
        case <-ctx.Done():
            return // 시나리오 중단 시 즉시 종료
        default:
            executeNode(node)
        }
    }
}()

// StopScenario 호출 시 cancel()로 모든 goroutine 정리
```

---

## 2. 기존 코드베이스 분석

### 2.1 Go 백엔드 패키지 구조

**현재 구조 (`internal/`):**
```
internal/
├── binding/
│   ├── engine_binding.go      # SIP 엔진 바인딩 (현재 ping/version만)
│   └── scenario_binding.go    # 시나리오 CRUD 바인딩
└── scenario/
    ├── model.go               # Project, Scenario 도메인 모델
    ├── repository.go          # SQLite CRUD 레이어
    └── repository_test.go
```

**`internal/scenario/model.go`:**
```go
type Scenario struct {
    ID        string    `json:"id"`
    ProjectID string    `json:"project_id"`
    Name      string    `json:"name"`
    FlowData  string    `json:"flow_data"` // JSON 직렬화된 그래프
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```
- `FlowData`: 프론트엔드 XYFlow 그래프를 JSON.stringify()한 문자열
- 백엔드에서 파싱 필요: `json.Unmarshal([]byte(scenario.FlowData), &flowData)`

**`internal/binding/engine_binding.go`:**
```go
type EngineBinding struct {
    ctx context.Context
}

func (e *EngineBinding) Ping() string { return "pong" }
func (e *EngineBinding) GetVersion() string { return "0.1.0" }
```
- 현재는 스텁만 구현됨
- Phase 03에서 추가할 메서드:
  - `StartScenario(scenarioId string) error`
  - `StopScenario() error`
  - 내부적으로 `runtime.EventsEmit(ctx, eventName, data)` 호출

**`app.go`:**
```go
type App struct {
    ctx             context.Context
    engineBinding   *binding.EngineBinding
    scenarioBinding *binding.ScenarioBinding
    scenarioRepo    *scenario.Repository
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    a.engineBinding.SetContext(ctx)
    a.scenarioBinding.SetContext(ctx)
}
```
- `ctx`는 Wails runtime context → EventsEmit에 필요
- Multiple Binding Structs 패턴 (Phase 01 결정사항)

### 2.2 프론트엔드 시나리오 데이터 모델

**`frontend/src/features/scenario-builder/types/scenario.ts`:**
```typescript
export const COMMAND_TYPES = ['MakeCall', 'Answer', 'Release'] as const;
export const EVENT_TYPES = [
  'INCOMING', 'DISCONNECTED', 'RINGING', 'TIMEOUT',
  'HELD', 'RETRIEVED', 'TRANSFERRED', 'NOTIFY'
] as const;

export interface SipInstanceNodeData extends Record<string, unknown> {
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string;
}

export interface CommandNodeData extends Record<string, unknown> {
  label: string;
  command: (typeof COMMAND_TYPES)[number];
  sipInstanceId?: string;
  targetUri?: string;   // for MakeCall
  timeout?: number;     // milliseconds
}

export interface EventNodeData extends Record<string, unknown> {
  label: string;
  event: (typeof EVENT_TYPES)[number];
  sipInstanceId?: string;
  timeout?: number;     // for TIMEOUT event
}

export interface BranchEdgeData {
  branchType: 'success' | 'failure';
}
```

**`frontend/src/features/scenario-builder/store/scenario-store.ts`:**
```typescript
interface ScenarioState {
  nodes: Node[];
  edges: Edge[];
  currentScenarioId: string | null;
  isDirty: boolean;
  validationErrors: ValidationError[];
  toFlowJSON: () => string;
  loadFromJSON: (json: string) => void;
}

// 저장 형식
toFlowJSON: () => {
  const { nodes, edges } = get();
  return JSON.stringify({ nodes, edges });
}
```

**저장되는 JSON 구조:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "sipInstance",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": false,
        "color": "#3b82f6"
      }
    },
    {
      "id": "node-2",
      "type": "command",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Call 200",
        "command": "MakeCall",
        "sipInstanceId": "node-1",
        "targetUri": "sip:200@127.0.0.1:5062",
        "timeout": 30000
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "sourceHandle": "success",
      "type": "branch",
      "data": { "branchType": "success" }
    }
  ]
}
```

### 2.3 Wails 바인딩 패턴

**현재 패턴 (ScenarioBinding):**
```go
func (s *ScenarioBinding) SaveScenario(id, flowData string) error {
    runtime.LogInfo(s.ctx, fmt.Sprintf("Saving scenario: %s", id))

    err := s.repo.SaveScenario(id, flowData)
    if err != nil {
        runtime.LogError(s.ctx, fmt.Sprintf("Failed: %v", err))
        return err
    }

    runtime.LogInfo(s.ctx, "Scenario saved")
    return nil
}
```

**프론트엔드 호출 (`use-scenario-api.ts`):**
```typescript
import { SaveScenario } from '../../../../wailsjs/go/binding/ScenarioBinding';

const saveScenario = async (id: string, flowData: string): Promise<void> => {
  try {
    await SaveScenario(id, flowData);
  } catch (error) {
    console.error('Failed to save scenario:', error);
    throw error;
  }
};
```
- Wails가 자동 생성하는 TypeScript 바인딩 사용
- Promise 기반, 에러 자동 전파

**컨텍스트 관리:**
```go
// app.go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    a.engineBinding.SetContext(ctx)
}

// binding/engine_binding.go
func (e *EngineBinding) SetContext(ctx context.Context) {
    e.ctx = ctx
}
```
- `startup()`에서 Wails runtime context 주입
- 모든 바인딩이 `ctx`를 보관하여 EventsEmit/Log 호출 시 사용

### 2.4 Zustand Store 구조

**시나리오 상태 관리:**
```typescript
export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentScenarioId: null,
  isDirty: false,
  validationErrors: [],

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
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
}));
```

**Phase 03에서 추가할 실행 상태 store 구조 (예상):**
```typescript
interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  nodeStates: Map<string, NodeExecutionState>; // nodeId -> state
  actionLogs: ActionLog[];

  // 이벤트 핸들러 등록
  startListening: () => void;
  stopListening: () => void;
}

interface NodeExecutionState {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
}

interface ActionLog {
  timestamp: number;
  nodeId: string;
  instanceId: string;
  message: string;
}
```

### 2.5 Wails 이벤트 사용 패턴 (기존 코드에서 미사용)

**Frontend runtime API (`wailsjs/runtime/runtime.d.ts`):**
```typescript
export function EventsEmit(eventName: string, ...data: any): void;
export function EventsOn(eventName: string, callback: (...data: any) => void): () => void;
export function EventsOff(eventName: string, ...additionalEventNames: string[]): void;
```

**Backend runtime API (wails/v2/pkg/runtime):**
```go
// Go -> Frontend 이벤트 발행
runtime.EventsEmit(ctx, eventName string, optionalData ...interface{})

// 예시:
runtime.EventsEmit(e.ctx, "scenario:node-state", map[string]interface{}{
    "nodeId": "node-2",
    "previousState": "pending",
    "newState": "running",
})
```

**Phase 03에서 구현할 패턴:**
```typescript
// Frontend: store에서 이벤트 리스너 등록
useEffect(() => {
  const unsubscribe = EventsOn("scenario:node-state", (event) => {
    // Zustand store 업데이트
    updateNodeState(event.nodeId, event.newState);
  });

  return () => unsubscribe();
}, []);
```

---

## 3. 시나리오 JSON → Go 실행 그래프 변환 분석

### 3.1 프론트엔드 JSON 스키마

**저장 형식 (XYFlow 그래프):**
```json
{
  "nodes": [
    { "id": "instance-a", "type": "sipInstance", "data": {...} },
    { "id": "cmd-1", "type": "command", "data": {"sipInstanceId": "instance-a", ...} },
    { "id": "evt-1", "type": "event", "data": {"sipInstanceId": "instance-a", ...} }
  ],
  "edges": [
    { "id": "e1", "source": "instance-a", "target": "cmd-1", "data": {"branchType": "success"} },
    { "id": "e2", "source": "cmd-1", "target": "evt-1", "sourceHandle": "success" }
  ]
}
```

**특징:**
- XYFlow 네이티브 형식 (`position`, `type`, `data`, `sourceHandle`)
- `sipInstanceId` 참조로 노드-인스턴스 연결
- Edge의 `sourceHandle` = "success" | "failure"
- Phase 02 검증으로 DAG 구조 보장됨

### 3.2 Go 실행 그래프 데이터 구조 설계

**필요한 Go 타입:**
```go
// internal/engine/graph.go

type ExecutionGraph struct {
    Instances  map[string]*InstanceChain // instanceId -> 노드 체인
    Nodes      map[string]*GraphNode     // nodeId -> 노드
    AllSessions map[string]*diago.DialogSession // cleanup용
}

type InstanceChain struct {
    InstanceID string
    StartNodes []*GraphNode // 시작 노드들 (인스턴스 노드의 자식들)
    UA         *diago.Diago
    Port       int
}

type GraphNode struct {
    ID             string
    Type           string // "command" | "event"
    InstanceID     string

    // Command 전용
    Command        string // "MakeCall" | "Answer" | "Release"
    TargetURI      string

    // Event 전용
    Event          string // "INCOMING" | "DISCONNECTED" | ...
    Timeout        time.Duration

    // 분기
    SuccessNext    *GraphNode
    FailureNext    *GraphNode
}
```

**변환 로직 설계:**
```go
func ParseScenario(flowData string) (*ExecutionGraph, error) {
    var raw struct {
        Nodes []struct {
            ID   string                 `json:"id"`
            Type string                 `json:"type"`
            Data map[string]interface{} `json:"data"`
        } `json:"nodes"`
        Edges []struct {
            ID           string                 `json:"id"`
            Source       string                 `json:"source"`
            Target       string                 `json:"target"`
            SourceHandle string                 `json:"sourceHandle"`
            Data         map[string]interface{} `json:"data"`
        } `json:"edges"`
    }

    if err := json.Unmarshal([]byte(flowData), &raw); err != nil {
        return nil, err
    }

    graph := &ExecutionGraph{
        Instances: make(map[string]*InstanceChain),
        Nodes:     make(map[string]*GraphNode),
    }

    // 1. 모든 노드를 GraphNode로 변환
    for _, n := range raw.Nodes {
        node := &GraphNode{ID: n.ID, Type: n.Type}

        if n.Type == "command" {
            node.Command = n.Data["command"].(string)
            node.TargetURI = n.Data["targetUri"].(string)
            node.InstanceID = n.Data["sipInstanceId"].(string)
        } else if n.Type == "event" {
            node.Event = n.Data["event"].(string)
            node.InstanceID = n.Data["sipInstanceId"].(string)
            if timeout, ok := n.Data["timeout"].(float64); ok {
                node.Timeout = time.Duration(timeout) * time.Millisecond
            } else {
                node.Timeout = 10 * time.Second // 기본값
            }
        }

        graph.Nodes[n.ID] = node
    }

    // 2. Edge로 연결 구축
    for _, e := range raw.Edges {
        sourceNode := graph.Nodes[e.Source]
        targetNode := graph.Nodes[e.Target]

        branchType := "success"
        if e.SourceHandle == "failure" {
            branchType = "failure"
        }

        if branchType == "success" {
            sourceNode.SuccessNext = targetNode
        } else {
            sourceNode.FailureNext = targetNode
        }
    }

    // 3. 인스턴스별로 체인 그룹화
    for _, node := range graph.Nodes {
        if node.Type == "sipInstance" {
            continue // 인스턴스 노드는 실행하지 않음
        }

        instanceID := node.InstanceID
        if _, exists := graph.Instances[instanceID]; !exists {
            graph.Instances[instanceID] = &InstanceChain{
                InstanceID: instanceID,
                StartNodes: []*GraphNode{},
            }
        }

        // 인스턴스 노드로부터 직접 연결된 노드를 StartNodes로
        // (실제로는 인바운드 엣지 체크 필요)
    }

    return graph, nil
}
```

### 3.3 인스턴스별 노드 체인 추출

**알고리즘:**
1. 모든 노드를 `sipInstanceId` 기준으로 그룹화
2. 각 그룹에서 SIP Instance 노드의 직계 자식 노드 찾기 (엣지의 source가 인스턴스 노드)
3. 각 직계 자식을 시작점으로 DFS/BFS로 체인 순회
4. success/failure 분기를 따라 다음 노드로 이동

**예시: 인스턴스 A의 체인**
```
Instance A (node-1)
  └─> MakeCall (node-2, command)
       ├─ success -> WaitRinging (node-3, event)
       │             └─ success -> ...
       └─ failure -> Cleanup (node-4, command)
```

**체인 추출 의사코드:**
```go
func ExtractInstanceChains(graph *ExecutionGraph, edges []Edge) {
    for instanceID, chain := range graph.Instances {
        // 인스턴스 노드에서 나가는 엣지 찾기
        for _, edge := range edges {
            if edge.Source == instanceID {
                startNode := graph.Nodes[edge.Target]
                chain.StartNodes = append(chain.StartNodes, startNode)
            }
        }
    }
}
```

### 3.4 변환 검증 포인트

**필수 검증:**
- [x] Phase 02 검증으로 이미 완료:
  - 모든 Command/Event 노드가 sipInstanceId 보유
  - 순환 참조 없음 (DAG)
  - 고아 노드 없음
- [ ] Phase 03에서 추가 검증:
  - MakeCall 노드의 targetUri 파싱 가능 여부
  - timeout 값이 양수인지 확인
  - Event 노드의 timeout 기본값 10초 적용

---

## 4. Wails 이벤트 시스템

### 4.1 EventsEmit API (Go → Frontend)

**기본 사용법:**
```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

func (e *EngineBinding) StartScenario(scenarioId string) error {
    // 시나리오 시작 이벤트 발행
    runtime.EventsEmit(e.ctx, "scenario:started", map[string]interface{}{
        "scenarioId": scenarioId,
        "timestamp": time.Now().Unix(),
    })

    // 노드 상태 변경 이벤트
    runtime.EventsEmit(e.ctx, "scenario:node-state", map[string]interface{}{
        "nodeId": "node-2",
        "previousState": "pending",
        "newState": "running",
    })

    return nil
}
```

**데이터 직렬화:**
- `interface{}`를 JSON으로 자동 직렬화
- Go struct도 전달 가능 (필드는 exported여야 함)
- 복잡한 타입은 `map[string]interface{}`로 명시적 변환 권장

**성능 특성:**
- 내부 IPC 채널 사용 (WebSocket 아님)
- Emit은 non-blocking (이벤트 큐에 추가)
- 과도한 Emit (초당 수천 건)은 프론트엔드 렌더링 지연 가능
- **권장**: 노드 상태는 모든 변경마다, 액션 로그는 주요 이벤트만

### 4.2 EventsOn API (Frontend 리스너)

**기본 패턴:**
```typescript
import { EventsOn, EventsOff } from '@wailsapp/runtime';

useEffect(() => {
  // 리스너 등록
  const unsubscribe = EventsOn("scenario:node-state", (event: NodeStateEvent) => {
    console.log("Node state changed:", event);
    // Zustand store 업데이트
    useExecutionStore.getState().updateNodeState(event.nodeId, event.newState);
  });

  // cleanup
  return () => {
    unsubscribe();
  };
}, []);
```

**다중 이벤트 리스닝:**
```typescript
useEffect(() => {
  const unsub1 = EventsOn("scenario:node-state", handleNodeState);
  const unsub2 = EventsOn("scenario:action-log", handleActionLog);
  const unsub3 = EventsOn("scenario:status", handleScenarioStatus);

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}, []);
```

**리스너 라이프사이클:**
- `EventsOn` 반환값은 unsubscribe 함수
- React useEffect cleanup에서 호출 필수 (메모리 누수 방지)
- 컴포넌트 unmount 시 자동 정리됨

### 4.3 이벤트 네이밍 컨벤션

**Phase 03 이벤트 설계:**
```
scenario:started         - 시나리오 실행 시작
scenario:stopped         - 시나리오 강제 중단
scenario:completed       - 시나리오 정상 완료
scenario:failed          - 시나리오 실패 종료

scenario:node-state      - 노드 상태 변경 (pending/running/completed/failed)
scenario:action-log      - 액션 로그 (MakeCall 시작, Answer 완료 등)
```

**이벤트 페이로드 타입:**
```typescript
// Frontend 타입 정의
interface ScenarioStartedEvent {
  scenarioId: string;
  timestamp: number;
}

interface NodeStateEvent {
  nodeId: string;
  previousState: 'pending' | 'running' | 'completed' | 'failed';
  newState: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
}

interface ActionLogEvent {
  timestamp: number;
  nodeId: string;
  instanceId: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

interface ScenarioStatusEvent {
  status: 'running' | 'completed' | 'failed' | 'stopped';
  timestamp: number;
  error?: string;
}
```

### 4.4 이벤트 스트림 백프레셔 처리

**문제:**
- 빠른 시나리오 실행 시 초당 수백 개 이벤트 발생 가능
- 프론트엔드 렌더링이 따라가지 못하면 UI 지연

**해결책 (Phase 04에서 고려):**
```typescript
// 디바운스/쓰로틀 적용
import { debounce } from 'lodash';

const handleNodeState = debounce((event: NodeStateEvent) => {
  updateNodeState(event.nodeId, event.newState);
}, 50); // 50ms 단위로 배치 업데이트

useEffect(() => {
  const unsub = EventsOn("scenario:node-state", handleNodeState);
  return () => unsub();
}, []);
```

**Phase 03 권장:**
- 이벤트 스트림만으로 상태 전파 (폴링 API 없음)
- 프론트엔드가 이벤트를 수신하여 Zustand store 업데이트
- 노드 상태 변경과 액션 로그를 별도 이벤트로 분리

---

## 5. 구현 권장사항

### 5.1 패키지 구조 설계

```
internal/
├── engine/
│   ├── engine.go           # Engine 타입, StartScenario/StopScenario
│   ├── graph.go            # ExecutionGraph, GraphNode 파서
│   ├── executor.go         # 노드 실행 로직 (Command/Event)
│   ├── instance_manager.go # diago UA 인스턴스 생성/관리
│   └── events.go           # 이벤트 발행 헬퍼
├── binding/
│   ├── engine_binding.go   # StartScenario/StopScenario 바인딩 추가
│   └── scenario_binding.go # (기존)
└── scenario/
    └── ...                  # (기존)
```

**Engine 타입 설계:**
```go
type Engine struct {
    ctx              context.Context
    currentScenario  string
    executionGraph   *ExecutionGraph
    cancelFunc       context.CancelFunc
    wg               sync.WaitGroup
}

func NewEngine(ctx context.Context) *Engine {
    return &Engine{ctx: ctx}
}

func (e *Engine) StartScenario(scenarioId string) error
func (e *Engine) StopScenario() error
```

### 5.2 시나리오 실행 플로우

**Step 1: 시나리오 로드 + 파싱**
```go
func (e *Engine) StartScenario(scenarioId string) error {
    // 1. DB에서 시나리오 로드
    scenario, err := e.repo.LoadScenario(scenarioId)
    if err != nil { return err }

    // 2. FlowData JSON 파싱 → ExecutionGraph
    graph, err := ParseScenario(scenario.FlowData)
    if err != nil { return err }

    // 3. 인스턴스별 diago UA 생성
    if err := e.createUAInstances(graph); err != nil {
        return err
    }

    e.executionGraph = graph
    e.currentScenario = scenarioId

    // 4. 실행 시작
    return e.executeGraph(graph)
}
```

**Step 2: UA 인스턴스 생성**
```go
func (e *Engine) createUAInstances(graph *ExecutionGraph) error {
    port := 5060
    for instanceID, chain := range graph.Instances {
        ua, _ := sipgo.NewUA()
        dg := diago.NewDiago(ua, diago.WithTransport(diago.Transport{
            Transport: "udp",
            BindHost:  "127.0.0.1",
            BindPort:  port,
        }))

        chain.UA = dg
        chain.Port = port
        port += 2 // 다음 인스턴스는 +2

        // ServeBackground로 Incoming 대기 시작
        ctx := context.Background()
        dg.ServeBackground(ctx, func(inDialog *diago.DialogServerSession) {
            e.handleIncoming(instanceID, inDialog)
        })
    }
    return nil
}
```

**Step 3: 인스턴스별 goroutine 실행**
```go
func (e *Engine) executeGraph(graph *ExecutionGraph) error {
    ctx, cancel := context.WithCancel(e.ctx)
    e.cancelFunc = cancel

    // 각 인스턴스마다 독립 goroutine
    for instanceID, chain := range graph.Instances {
        e.wg.Add(1)
        go func(id string, ch *InstanceChain) {
            defer e.wg.Done()

            for _, startNode := range ch.StartNodes {
                if err := e.executeNode(ctx, id, startNode, ch.UA); err != nil {
                    // 실패 처리
                    e.emitFailed(id, startNode.ID, err)

                    if startNode.FailureNext != nil {
                        e.executeNode(ctx, id, startNode.FailureNext, ch.UA)
                    } else {
                        // failure 분기 없음 → 전체 중단
                        cancel()
                        return
                    }
                }
            }
        }(instanceID, chain)
    }

    // 모든 인스턴스 goroutine 대기
    e.wg.Wait()

    // cleanup
    return e.cleanup(graph)
}
```

**Step 4: 노드 실행**
```go
func (e *Engine) executeNode(ctx context.Context, instanceID string, node *GraphNode, ua *diago.Diago) error {
    e.emitNodeState(node.ID, "pending", "running")

    var err error
    switch node.Type {
    case "command":
        err = e.executeCommand(ctx, instanceID, node, ua)
    case "event":
        err = e.executeEvent(ctx, instanceID, node, ua)
    }

    if err != nil {
        e.emitNodeState(node.ID, "running", "failed")
        return err
    }

    e.emitNodeState(node.ID, "running", "completed")

    // success 분기로 재귀 실행
    if node.SuccessNext != nil {
        return e.executeNode(ctx, instanceID, node.SuccessNext, ua)
    }

    return nil
}
```

**Step 5: Command 실행**
```go
func (e *Engine) executeCommand(ctx context.Context, instanceID string, node *GraphNode, ua *diago.Diago) error {
    e.emitActionLog(node.ID, instanceID, fmt.Sprintf("Executing %s", node.Command))

    switch node.Command {
    case "MakeCall":
        recipient := sip.Uri{}
        sip.ParseUri(node.TargetURI, &recipient)

        dialog, err := ua.Invite(ctx, recipient, diago.InviteOptions{})
        if err != nil {
            return fmt.Errorf("MakeCall failed: %w", err)
        }

        // dialog 보관 (cleanup용)
        e.executionGraph.AllSessions[node.ID] = dialog

        e.emitActionLog(node.ID, instanceID, "MakeCall succeeded")
        return nil

    case "Answer":
        // inDialog는 handleIncoming에서 저장됨
        inDialog := e.executionGraph.AllSessions[instanceID]
        if inDialog == nil {
            return fmt.Errorf("no incoming dialog to answer")
        }

        if err := inDialog.(*diago.DialogServerSession).Answer(); err != nil {
            return fmt.Errorf("Answer failed: %w", err)
        }

        e.emitActionLog(node.ID, instanceID, "Answer succeeded")
        return nil

    case "Release":
        dialog := e.executionGraph.AllSessions[instanceID]
        if dialog == nil {
            return nil // 이미 종료됨
        }

        if err := dialog.Hangup(ctx); err != nil {
            return fmt.Errorf("Release failed: %w", err)
        }

        e.emitActionLog(node.ID, instanceID, "Release succeeded")
        return nil
    }

    return fmt.Errorf("unknown command: %s", node.Command)
}
```

**Step 6: Event 실행**
```go
func (e *Engine) executeEvent(ctx context.Context, instanceID string, node *GraphNode, ua *diago.Diago) error {
    e.emitActionLog(node.ID, instanceID, fmt.Sprintf("Waiting for %s", node.Event))

    timeout := node.Timeout
    if timeout == 0 {
        timeout = 10 * time.Second
    }

    timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()

    switch node.Event {
    case "INCOMING":
        // handleIncoming 콜백에서 채널로 통지
        select {
        case <-e.incomingCh[instanceID]:
            e.emitActionLog(node.ID, instanceID, "INCOMING event received")
            return nil
        case <-timeoutCtx.Done():
            return fmt.Errorf("INCOMING timeout")
        }

    case "DISCONNECTED":
        dialog := e.executionGraph.AllSessions[instanceID]
        if dialog == nil {
            return fmt.Errorf("no dialog for DISCONNECTED")
        }

        select {
        case <-dialog.Context().Done():
            e.emitActionLog(node.ID, instanceID, "DISCONNECTED event received")
            return nil
        case <-timeoutCtx.Done():
            return fmt.Errorf("DISCONNECTED timeout")
        }

    case "RINGING":
        // MakeCall 시 InviteClientOptions.OnResponse로 감지
        // 실제로는 MakeCall 노드에서 처리하고 채널로 통지
        select {
        case <-e.ringingCh[instanceID]:
            e.emitActionLog(node.ID, instanceID, "RINGING event received")
            return nil
        case <-timeoutCtx.Done():
            return fmt.Errorf("RINGING timeout")
        }
    }

    return fmt.Errorf("unknown event: %s", node.Event)
}
```

**Step 7: Cleanup**
```go
func (e *Engine) cleanup(graph *ExecutionGraph) error {
    e.emitActionLog("", "", "Starting cleanup")

    // 모든 활성 세션 Hangup
    for _, session := range graph.AllSessions {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        session.Hangup(ctx)
        cancel()
        session.Close()
    }

    // 모든 UA 종료
    for _, chain := range graph.Instances {
        if chain.UA != nil {
            chain.UA.Close()
        }
    }

    e.emitActionLog("", "", "Cleanup completed")
    return nil
}
```

### 5.3 StopScenario 구현

```go
func (e *Engine) StopScenario() error {
    if e.cancelFunc == nil {
        return fmt.Errorf("no running scenario")
    }

    // context 취소 → 모든 goroutine 중단
    e.cancelFunc()

    // goroutine 종료 대기
    e.wg.Wait()

    // cleanup
    if e.executionGraph != nil {
        e.cleanup(e.executionGraph)
    }

    runtime.EventsEmit(e.ctx, "scenario:stopped", map[string]interface{}{
        "timestamp": time.Now().Unix(),
    })

    return nil
}
```

### 5.4 이벤트 발행 헬퍼

```go
// internal/engine/events.go

func (e *Engine) emitNodeState(nodeId, prevState, newState string) {
    runtime.EventsEmit(e.ctx, "scenario:node-state", map[string]interface{}{
        "nodeId":        nodeId,
        "previousState": prevState,
        "newState":      newState,
        "timestamp":     time.Now().Unix(),
    })
}

func (e *Engine) emitActionLog(nodeId, instanceId, message string) {
    runtime.EventsEmit(e.ctx, "scenario:action-log", map[string]interface{}{
        "timestamp":  time.Now().Unix(),
        "nodeId":     nodeId,
        "instanceId": instanceId,
        "message":    message,
        "level":      "info",
    })
}

func (e *Engine) emitFailed(instanceId, nodeId string, err error) {
    e.emitActionLog(nodeId, instanceId, fmt.Sprintf("ERROR: %v", err))
    runtime.EventsEmit(e.ctx, "scenario:failed", map[string]interface{}{
        "timestamp": time.Now().Unix(),
        "error":     err.Error(),
    })
}
```

### 5.5 프론트엔드 통합

**ExecutionStore 생성 (새 파일):**
```typescript
// frontend/src/features/scenario-builder/store/execution-store.ts
import { create } from 'zustand';
import { EventsOn, EventsOff } from '@wailsapp/runtime';

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  nodeStates: Map<string, NodeExecutionState>;
  actionLogs: ActionLog[];

  startListening: () => void;
  stopListening: () => void;
  updateNodeState: (nodeId: string, newState: string) => void;
  addActionLog: (log: ActionLog) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  nodeStates: new Map(),
  actionLogs: [],

  startListening: () => {
    EventsOn("scenario:node-state", (event) => {
      get().updateNodeState(event.nodeId, event.newState);
    });

    EventsOn("scenario:action-log", (event) => {
      get().addActionLog(event);
    });

    EventsOn("scenario:status", (event) => {
      set({ status: event.status });
    });
  },

  stopListening: () => {
    EventsOff("scenario:node-state", "scenario:action-log", "scenario:status");
  },

  updateNodeState: (nodeId, newState) => {
    set((state) => {
      const newMap = new Map(state.nodeStates);
      newMap.set(nodeId, {
        nodeId,
        status: newState,
        timestamp: Date.now(),
      });
      return { nodeStates: newMap };
    });
  },

  addActionLog: (log) => {
    set((state) => ({
      actionLogs: [...state.actionLogs, log],
    }));
  },

  reset: () => {
    set({
      status: 'idle',
      nodeStates: new Map(),
      actionLogs: [],
    });
  },
}));
```

**실행 버튼 컴포넌트:**
```typescript
import { StartScenario, StopScenario } from '@wailsjs/go/binding/EngineBinding';
import { useExecutionStore } from '../store/execution-store';

export function ExecutionControls() {
  const { status, startListening, stopListening, reset } = useExecutionStore();
  const { currentScenarioId } = useScenarioStore();

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, []);

  const handleStart = async () => {
    if (!currentScenarioId) return;

    reset();
    try {
      await StartScenario(currentScenarioId);
    } catch (error) {
      console.error("Failed to start scenario:", error);
    }
  };

  const handleStop = async () => {
    try {
      await StopScenario();
    } catch (error) {
      console.error("Failed to stop scenario:", error);
    }
  };

  return (
    <div>
      <button onClick={handleStart} disabled={status === 'running'}>
        Start
      </button>
      <button onClick={handleStop} disabled={status !== 'running'}>
        Stop
      </button>
      <span>Status: {status}</span>
    </div>
  );
}
```

---

## 6. 리스크 및 주의사항

### 6.1 기술적 리스크

**1. diago 동시성 이슈**
- **리스크**: 여러 goroutine에서 동일 Dialog 객체 동시 접근 시 race condition
- **완화**:
  - 각 Dialog는 단일 goroutine에서만 조작 (인스턴스별 goroutine 격리)
  - `sync.Mutex`로 AllSessions 맵 보호
  - `go run -race`로 테스트 시 검증

**2. context 취소 타이밍**
- **리스크**: StopScenario 호출 시 goroutine이 즉시 종료되지 않음
- **완화**:
  - 모든 블로킹 호출 (Invite, Answer 등)에 context 전달
  - `select` 구문에서 `ctx.Done()` 체크
  - `sync.WaitGroup`으로 모든 goroutine 종료 대기

**3. 포트 충돌**
- **리스크**: 5060 포트가 이미 사용 중일 경우 바인딩 실패
- **완화**:
  - 포트 바인딩 실패 시 자동으로 다음 포트(5062, 5064...) 시도
  - 최대 10회 재시도 후 에러 반환
  - 사용 중인 포트 목록을 Engine에서 관리

**4. 메모리 누수**
- **리스크**: Dialog, UA 객체를 Close()하지 않으면 고루틴/소켓 누수
- **완화**:
  - `defer dialog.Close()` 패턴 엄수
  - cleanup() 함수에서 모든 리소스 정리
  - 종료 시 반드시 cleanup 호출

**5. 이벤트 스트림 과부하**
- **리스크**: 빠른 시나리오 실행 시 초당 수백 개 이벤트 → 프론트엔드 렌더링 지연
- **완화**:
  - Phase 03에서는 이벤트 필터링 없이 모두 발행 (단순 구현 우선)
  - Phase 04에서 프론트엔드 디바운싱/쓰로틀링 추가
  - 액션 로그는 주요 이벤트만 발행 (RTP 패킷 단위는 제외)

### 6.2 설계 리스크

**1. Event 노드 트리거 복잡도**
- **리스크**: INCOMING, DISCONNECTED 등 이벤트를 채널/콜백으로 감지하는 로직이 복잡
- **완화**:
  - Phase 03에서는 INCOMING, DISCONNECTED만 우선 구현
  - 나머지 이벤트 (HELD, TRANSFERRED 등)는 Phase 4 이후
  - 채널 기반 통지 패턴 통일 (e.g., `incomingCh`, `disconnectedCh`)

**2. 실패 분기 처리**
- **리스크**: failure 분기가 없는 경우 전체 시나리오 중단 로직이 복잡
- **완화**:
  - executeNode에서 에러 반환 시 failure 분기 체크
  - failure 분기 없으면 `cancelFunc()` 호출 → 모든 goroutine 중단
  - cleanup 함수에서 모든 UA/Dialog 정리

**3. 시나리오 완료 판단**
- **리스크**: 모든 인스턴스의 노드 체인이 종료되었는지 판단 어려움
- **완화**:
  - `sync.WaitGroup`으로 모든 인스턴스 goroutine 종료 대기
  - cleanup 완료 후 `scenario:completed` 이벤트 발행
  - 타임아웃 (30초) 후에도 종료되지 않으면 강제 중단

**4. JSON 파싱 에러 처리**
- **리스크**: 프론트엔드 FlowData가 손상되었을 경우 파싱 실패
- **완화**:
  - Phase 02 검증으로 저장 전 검증 완료
  - ParseScenario에서 추가 검증 (필수 필드 존재 여부)
  - 파싱 실패 시 명확한 에러 메시지 반환

### 6.3 UX 리스크

**1. 실행 중 시나리오 수정**
- **리스크**: 사용자가 실행 중인 시나리오를 편집하면 불일치 발생
- **완화**:
  - Phase 03에서는 실행 중 편집 차단 (UI에서 캔버스 비활성화)
  - StopScenario 후에만 편집 가능
  - Phase 04에서 "실행 중" 상태 표시 추가

**2. 에러 메시지 가독성**
- **리스크**: diago 에러 메시지가 너무 기술적 (예: "SIP 486 Busy Here")
- **완화**:
  - Phase 03에서는 원본 에러 그대로 전달
  - Phase 04에서 사용자 친화적 메시지 변환
  - 액션 로그에 에러 상세 포함

**3. 실행 이력 부재**
- **리스크**: 앱 재시작 시 이전 실행 기록 사라짐
- **완화**:
  - Phase 03에서는 메모리만 (결정사항)
  - 향후 Phase에서 SQLite에 실행 이력 저장

### 6.4 테스트 전략

**Phase 03 필수 테스트:**
1. **단순 시나리오 (1 인스턴스, MakeCall → Release)**
   - A가 B로 전화 → 즉시 끊기
   - 검증: MakeCall 성공, Release 성공, 이벤트 순서

2. **2자 통화 시나리오 (2 인스턴스, Incoming → Answer)**
   - A가 B로 전화 → B가 응답
   - 검증: INCOMING 이벤트, Answer 성공, 양방향 미디어

3. **실패 분기 테스트 (MakeCall 실패 → failure 경로)**
   - A가 존재하지 않는 번호로 전화 → failure 분기 실행
   - 검증: failure 분기로 이동, 노드 상태 = failed

4. **타임아웃 테스트 (Event 노드 타임아웃)**
   - INCOMING 대기 → 10초 타임아웃 → failure 분기
   - 검증: TIMEOUT 이벤트, failure 분기 실행

5. **StopScenario 테스트**
   - 실행 중 강제 중단
   - 검증: 모든 goroutine 종료, UA 정리, 이벤트 "stopped"

---

## RESEARCH COMPLETE

**핵심 발견사항 요약:**

1. **diago는 실제 SIP 프로토콜 구현**
   - 127.0.0.1 바인딩으로도 완전한 SIP/RTP 통신 가능
   - Mock이 아닌 실제 네트워크 스택 사용
   - 포트 자동 할당 지원 (ephemeral port)

2. **DialogSession 인터페이스 기반 추상화**
   - Client/Server 세션 공통 인터페이스
   - context.Context와 lifecycle 연동
   - Hangup, Close 패턴 명확

3. **프론트엔드 JSON 구조는 XYFlow 네이티브**
   - nodes, edges 배열 형태
   - sipInstanceId로 노드-인스턴스 연결
   - Phase 02 검증으로 DAG 보장

4. **Wails 이벤트 시스템은 간단명료**
   - EventsEmit (Go) → EventsOn (TS)
   - 내부 IPC, non-blocking
   - 자동 JSON 직렬화

5. **인스턴스별 독립 goroutine 패턴 적합**
   - 각 SIP Instance가 독립적으로 노드 체인 실행
   - context 취소로 전체 중단 가능
   - sync.WaitGroup으로 완료 대기

**다음 단계 (plan-phase):**
- EngineBinding에 StartScenario/StopScenario 추가
- internal/engine 패키지 생성 (graph, executor, instance_manager)
- 이벤트 발행 로직 구현
- 프론트엔드 ExecutionStore + 실행 컨트롤 UI
