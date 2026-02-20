# Phase 14: SessionStore 멀티 다이얼로그 - Research

**Researched:** 2026-02-20
**Domain:** Go concurrent state management, SIP dialog lifecycle, diago v0.27.0 API
**Confidence:** HIGH

## Summary

Phase 14는 기존 `SessionStore`의 단일 키(`instanceID`)를 복합 키(`instanceID:callID`)로 확장하는 리팩토링이다. 동시에 `chan struct{}`를 `chan SIPEvent`로 교체하여 이벤트 페이로드에 callID를 포함시키고, `incomingCh` 버퍼를 1에서 4로 확장한다. 변경 범위는 `executor.go` 내 `SessionStore`, `executeIncoming`, `emitSIPEvent`, `SubscribeSIPEvent`에 집중되며, `graph.go`에서 `GraphNode`에 `CallID` 필드 추가, `ParseScenario`에서 마이그레이션 로직 추가가 필요하다.

현재 코드베이스를 분석한 결과: `SessionStore.dialogs` 맵이 `map[string]diago.DialogSession` (key=instanceID), `SessionStore.serverSessions`가 `map[string]*diago.DialogServerSession` (key=instanceID)이다. Phase 14에서 두 맵 모두 복합 키로 전환하고, `serverSessions`는 callID 부여 전 임시 저장소 역할에서 벗어나 불필요해진다 — IncomingCall이 직접 `dialogs`에 복합 키로 저장한다.

**주요 권장사항:** `sessionKey(instanceID, callID)` 헬퍼 함수를 중심으로 모든 저장/조회 코드를 일원화하고, `SIPEvent{CallID string}` 타입으로 이벤트 버스 채널을 교체한다. v1.2 하위 호환은 `ParseScenario`의 마이그레이션 함수 하나로 처리한다.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 1. callID 생명주기

| 시점 | 설명 |
|------|------|
| **인스턴스 시작** | callID 없음 — 아직 dialog이 존재하지 않음 |
| **MakeCall(callID="X")** | 발신 dialog 생성, callID "X" 부여 |
| **IncomingCall(callID="X")** | 수신 INVITE를 콜 버퍼에서 FIFO로 꺼내어 callID "X" 부여 |
| **Answer(callID="X")** | 이미 "X"로 저장된 수신 dialog에 200 OK 응답 (callID를 만드는 것이 아님) |
| **이후 모든 노드** | callID 필수 참조 — Hold, Retrieve, Release, BlindTransfer 등 |

**IncomingCall vs Answer 역할 분리:**
- IncomingCall(Event): INVITE 수신 대기 + callID 부여 (dialog 탄생)
- Answer(Command): 이미 존재하는 dialog에 200 OK 응답 (dialog 확립)

#### 2. callID 기본값 정책

| 항목 | 결정 |
|------|------|
| **callID 미지정 시** | 자동 생성 ("call-1", "call-2" 등 순차 부여) |
| **모든 노드** | callID 필수 — 없으면 에러 |
| **v1.2 하위 호환** | 시나리오 로드 시 마이그레이션 (callID 없는 노드에 자동 주입) |

#### 3. 수신 INVITE 라우팅 — 콜 버퍼 모델

| 항목 | 결정 |
|------|------|
| **incomingCh 버퍼 크기** | 1 → 4 확장 |
| **라우팅 방식** | FIFO (선입선출) |
| **callID 부여 시점** | IncomingCall 이벤트 노드가 콜 버퍼에서 꺼낼 때 |

#### 4. SIP 이벤트 버스

| 항목 | 결정 |
|------|------|
| **이벤트 키** | 기존 `{instanceID}:{eventType}` 유지 |
| **callID 전달** | 이벤트 페이로드에 callID 포함 |
| **채널 타입** | `chan struct{}` → `chan SIPEvent` (callID 필드 포함) |
| **구독자 필터링** | 구독자가 수신 후 `event.CallID == myCallID` 확인하여 필터링 |
| **IncomingCall 메커니즘** | SIP 이벤트 버스와 별도, incomingCh 유지 |

#### 5. SessionStore 복합 키

| 항목 | 결정 |
|------|------|
| **키 포맷** | 문자열 복합 키 `"{instanceID}:{callID}"` |
| **키 생성** | `sessionKey(instanceID, callID string) string` 헬퍼 함수 |
| **내부 맵** | `map[string]diago.DialogSession` (기존 타입 유지, 키만 변경) |

### Deferred Ideas (OUT OF SCOPE)

없음 — 논의는 Phase 14 범위 내에서 완결됨.
</user_constraints>

---

## Standard Stack

### Core

| 라이브러리 | 버전 | 목적 | 표준인 이유 |
|-----------|------|------|------------|
| diago | v0.27.0 | SIP dialog 생성/관리 | 이미 채택된 SIP 엔진 |
| sipgo | v1.2.0 | 저수준 SIP 프로토콜 | diago의 기반 라이브러리 |
| Go sync | stdlib | RWMutex 기반 thread-safe map | 표준 동시성 도구 |

### 신규 라이브러리 없음

Phase 14는 기존 스택 내에서 완전히 구현 가능하다. 신규 의존성 불필요.

---

## Architecture Patterns

### 현재 SessionStore 구조 (v1.2)

```
SessionStore
├── dialogs: map[instanceID]diago.DialogSession
├── serverSessions: map[instanceID]*diago.DialogServerSession
└── sipEventSubs: map["{instanceID}:{eventType}"][]chan struct{}
```

**문제:** `dialogs[instanceID]`는 1개 dialog만 저장 가능. 두 번째 MakeCall/IncomingCall이 기존 dialog를 덮어씀.

### 목표 SessionStore 구조 (v1.3)

```
SessionStore
├── dialogs: map["{instanceID}:{callID}"]diago.DialogSession
└── sipEventSubs: map["{instanceID}:{eventType}"][]chan SIPEvent
```

**변경 사항:**
1. `dialogs` 키: `instanceID` → `instanceID:callID`
2. `serverSessions` 맵 제거: IncomingCall이 직접 `dialogs`에 저장 (callID 부여 시점)
3. `sipEventSubs` 채널 타입: `chan struct{}` → `chan SIPEvent`

### 패턴 1: sessionKey 헬퍼 함수

**설명:** 복합 키 생성을 단일 함수에 집중시켜 일관성 보장
**사용 시점:** 모든 `dialogs` 맵 접근 지점

```go
// 소스: 코드베이스 분석 + CONTEXT.md 결정
func sessionKey(instanceID, callID string) string {
    return instanceID + ":" + callID
}

// 사용 예
key := sessionKey("alice", "primary")   // → "alice:primary"
key := sessionKey("alice", "call-1")    // → "alice:call-1"
```

### 패턴 2: SIPEvent 구조체

**설명:** `chan struct{}`를 `chan SIPEvent`로 교체하여 callID 필터링 지원
**사용 시점:** emitSIPEvent, SubscribeSIPEvent, executeWaitSIPEvent, OnMediaUpdate 콜백

```go
// SIPEvent는 SIP 이벤트 페이로드
type SIPEvent struct {
    CallID string
}

// 채널 타입 변경
sipEventSubs: map[string][]chan SIPEvent  // 기존 chan struct{} → chan SIPEvent

// 발행 (instanceID 레벨 broadcast)
func (ss *SessionStore) emitSIPEvent(instanceID, eventType, callID string) {
    key := instanceID + ":" + eventType
    event := SIPEvent{CallID: callID}
    ss.mu.RLock()
    subs := ss.sipEventSubs[key]
    ss.mu.RUnlock()

    for _, ch := range subs {
        select {
        case ch <- event:
        default: // non-blocking 드랍 유지
        }
    }
}

// 구독
func (ss *SessionStore) SubscribeSIPEvent(instanceID, eventType string) chan SIPEvent {
    key := instanceID + ":" + eventType
    ch := make(chan SIPEvent, 1)
    // ...append to subs...
    return ch
}
```

### 패턴 3: callID 필터링 루프

**설명:** 구독자가 수신 후 callID를 확인하여 자신의 이벤트만 처리
**사용 시점:** executeWaitSIPEvent

```go
// executeWaitSIPEvent — callID 필터링 포함
func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType string, timeout time.Duration) error {
    ch := ex.sessions.SubscribeSIPEvent(instanceID, eventType)
    defer ex.sessions.UnsubscribeSIPEvent(instanceID, eventType, ch)

    for {
        select {
        case event := <-ch:
            if event.CallID == node.CallID {  // 자신의 callID만 처리
                ex.engine.emitActionLog(node.ID, instanceID,
                    fmt.Sprintf("%s event received (callID: %s)", eventType, node.CallID), "info")
                return nil
            }
            // 다른 callID 이벤트 → 무시, 계속 대기
        case <-ctx.Done():
            return fmt.Errorf("%s event timeout after %v", eventType, timeout)
        }
    }
}
```

**주의:** `select` 안에 `for` 루프가 필요하다 (다른 callID 이벤트가 들어올 수 있으므로). 기존 단순 `select`에서 `for { select { ... } }` 패턴으로 변경해야 한다.

### 패턴 4: IncomingCall에서 callID 부여

**설명:** INVITE를 콜 버퍼에서 꺼내는 시점에 callID를 부여하고 `dialogs`에 직접 저장
**사용 시점:** executeIncoming

```go
// executeIncoming — callID 부여 + dialogs 직접 저장
func (ex *Executor) executeIncoming(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
    instance, err := ex.im.GetInstance(instanceID)
    if err != nil {
        return fmt.Errorf("failed to get instance: %w", err)
    }

    select {
    case inDialog := <-instance.incomingCh:
        // callID 부여 시점: FIFO로 꺼낼 때
        callID := node.CallID  // 노드에 명시된 callID 사용

        // serverSessions 대신 dialogs에 직접 저장
        ex.sessions.StoreDialog(sessionKey(instanceID, callID), inDialog)

        fromUser := inDialog.FromUser()
        toUser := inDialog.ToUser()
        ex.engine.emitActionLog(...)
        return nil
    case <-ctx.Done():
        return fmt.Errorf("INCOMING event timeout after %v", timeout)
    }
}
```

### 패턴 5: Answer — serverSessions 없이 dialogs에서 조회

**설명:** Answer는 IncomingCall이 이미 저장한 dialog를 `dialogs`에서 찾아 AnswerOptions 호출
**사용 시점:** executeAnswer

```go
// executeAnswer — dialogs에서 callID로 직접 조회
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
    key := sessionKey(instanceID, node.CallID)
    dialog, exists := ex.sessions.GetDialog(key)
    if !exists {
        return fmt.Errorf("no incoming dialog to answer for callID %s", node.CallID)
    }

    serverSession, ok := dialog.(*diago.DialogServerSession)
    if !ok {
        return fmt.Errorf("dialog for callID %s is not a server session", node.CallID)
    }

    opts := diago.AnswerOptions{
        OnMediaUpdate: func(d *diago.DialogMedia) {
            go func() {
                // ... SDP 감지 로직 ...
                // emitSIPEvent에 callID 포함
                ex.engine.emitSIPEvent(instanceID, "HELD", node.CallID)
            }()
        },
        OnRefer: func(referDialog *diago.DialogClientSession) error {
            // ... BlindTransfer 처리 ...
            // referDialog를 복합 키로 저장
            ex.sessions.StoreDialog(sessionKey(instanceID, node.CallID), referDialog)
            ex.engine.emitSIPEvent(instanceID, "TRANSFERRED", node.CallID)
            return nil
        },
    }

    if err := serverSession.AnswerOptions(opts); err != nil {
        return fmt.Errorf("Answer failed: %w", err)
    }

    // 이미 dialogs에 저장되어 있으므로 추가 저장 불필요
    // (Answer 성공 후 dialog 참조 갱신 필요 없음 — 동일 객체)
    return nil
}
```

**중요 발견:** 현재 `executeAnswer`는 `serverSession.AnswerOptions` 후 `ex.sessions.StoreDialog(instanceID, serverSession)`를 다시 호출한다. v1.3에서 IncomingCall이 이미 복합 키로 저장했으므로, Answer는 저장 불필요 (이미 존재하는 키에 동일 값 재저장은 무해하지만 불필요).

### 패턴 6: v1.2 마이그레이션

**설명:** ParseScenario 내에서 callID 없는 노드에 "call-1" 자동 주입
**사용 시점:** graph.go ParseScenario 내 별도 함수

```go
// migrateCallIDs는 v1.2 시나리오 JSON에서 callID 없는 노드에 기본값을 주입한다
func migrateCallIDs(graph *ExecutionGraph) {
    for _, node := range graph.Nodes {
        if node.CallID == "" {
            node.CallID = "call-1"
        }
    }
}

// ParseScenario 마지막에 호출
migrateCallIDs(graph)
```

### 패턴 7: incomingCh 버퍼 확장

**설명:** ManagedInstance 생성 시 채널 버퍼를 1에서 4로 변경
**사용 시점:** instance_manager.go CreateInstances

```go
// 기존
incomingCh: make(chan *diago.DialogServerSession, 1),

// 변경
incomingCh: make(chan *diago.DialogServerSession, 4),
```

### 패턴 8: emitSIPEvent 시그니처 변경

**설명:** Engine.emitSIPEvent에 callID 파라미터 추가
**사용 시점:** engine.go emitSIPEvent, executor.go의 모든 호출 지점

```go
// engine.go
func (e *Engine) emitSIPEvent(instanceID, eventType, callID string) {
    e.mu.Lock()
    ex := e.executor
    e.mu.Unlock()
    if ex != nil {
        ex.sessions.emitSIPEvent(instanceID, eventType, callID)
    }
}
```

호출 지점 변경 필요:
- `executeAnswer`의 `OnMediaUpdate` 콜백 내 `emitSIPEvent(instanceID, "HELD")` → `emitSIPEvent(instanceID, "HELD", node.CallID)`
- `executeAnswer`의 `OnRefer` 콜백 내 `emitSIPEvent(instanceID, "TRANSFERRED")` → `emitSIPEvent(instanceID, "TRANSFERRED", node.CallID)`

### 피해야 할 안티패턴

- **serverSessions 맵 유지:** IncomingCall이 dialogs에 직접 저장하므로 serverSessions 맵은 불필요. 제거하면 코드가 단순해진다.
- **callID 검증 누락:** `node.CallID == ""`인 경우 실행 중 런타임 에러 발생 위험. ParseScenario의 migrateCallIDs가 이를 방지하지만, executor에서도 방어적 검증 권장.
- **for 루프 없는 SIPEvent 필터링:** `select { case event := <-ch: if event.CallID != myCallID { /* 무시 */ } }` 패턴은 이벤트를 소비하고 다시 대기하지 않아 잘못된 타임아웃 발생. 반드시 `for { select { ... } }` 구조 사용.

---

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|-------------|----------|------|
| 복합 키 직렬화 | 복잡한 구조체 키 | `instanceID + ":" + callID` 문자열 | Go map은 string 키가 가장 단순하고 효율적 |
| callID 고유성 보장 | UUID 생성기 | 순차적 "call-1", "call-2" | 사용자가 지정하는 것이 의도, 자동 생성은 마이그레이션용 기본값만 |
| 이벤트 필터링 큐 | 별도 이벤트 큐/라우터 | 구독자 내 callID 비교 | 단순한 비교로 충분, 과도한 설계 불필요 |

---

## Common Pitfalls

### 함정 1: executeAnswer의 타입 어서션 실패

**발생하는 문제:** `GetDialog(key)`로 꺼낸 `diago.DialogSession`을 `*diago.DialogServerSession`으로 타입 어서션 실패
**발생 이유:** MakeCall 시나리오에서 Answer 노드를 잘못 배치하거나, 동일 callID로 MakeCall과 IncomingCall이 충돌
**피하는 방법:** 타입 어서션 실패 시 명확한 에러 메시지 제공

```go
serverSession, ok := dialog.(*diago.DialogServerSession)
if !ok {
    return fmt.Errorf("callID %s: dialog is %T, not DialogServerSession (was MakeCall called with same callID?)",
        node.CallID, dialog)
}
```

**경고 신호:** `"dialog is *diago.DialogClientSession, not DialogServerSession"` 에러 메시지

### 함정 2: OnMediaUpdate 클로저에서 callID 캡처

**발생하는 문제:** `OnMediaUpdate` 콜백이 `node.CallID`를 클로저로 캡처할 때, 노드 재사용 또는 goroutine 경합으로 잘못된 callID 전달
**발생 이유:** Go 클로저 캡처 시맨틱
**피하는 방법:** 콜백 등록 전에 callID를 로컬 변수에 복사

```go
callID := node.CallID  // 클로저 외부에서 복사
OnMediaUpdate: func(d *diago.DialogMedia) {
    go func() {
        // callID 사용 (node.CallID 직접 참조 아님)
        ex.engine.emitSIPEvent(instanceID, "HELD", callID)
    }()
},
```

### 함정 3: HangupAll에서 복합 키 dialogs 순회

**발생하는 문제:** `HangupAll`이 `for key, dialog := range ss.dialogs`로 순회 시 key가 "alice:primary" 형태이므로 instanceID 추출이 필요해지는 경우
**발생 이유:** 현재 HangupAll은 모든 dialog에 Hangup 호출 — instanceID별 필터링이 필요하면 키 파싱 필요
**피하는 방법:** 현재 Phase 14에서는 모든 dialog Hangup이 목적이므로 키 파싱 불필요. Phase 15에서 AttendedTransfer 시 instanceID별 필터가 필요하면 별도 처리.

### 함정 4: SIPEvent 채널 버퍼 크기

**발생하는 문제:** `chan SIPEvent` 버퍼 크기를 1로 유지할 경우, 같은 이벤트 타입으로 여러 callID 이벤트가 빠르게 발행되면 드랍 발생
**발생 이유:** non-blocking send 정책 + 버퍼 1
**피하는 방법:** 버퍼 크기 유지 (1). 구독자 수 × callID 수만큼 이벤트가 발생해도 구독자 필터링 루프가 빠르게 처리하므로 문제 없음. 버퍼를 늘리면 메모리 낭비. 현재 non-blocking 드랍 정책 유지.

### 함정 5: serverSessions 제거 후 Answer 에러 메시지 변경

**발생하는 문제:** v1.2 테스트에서 `"no incoming dialog to answer for instance"` 에러 메시지를 하드코딩한 테스트가 실패
**발생 이유:** executeAnswer 에러 메시지 변경
**피하는 방법:** 테스트 에러 메시지도 함께 업데이트

---

## Code Examples

### SessionStore 전체 리팩토링 패턴

```go
// 소스: 기존 executor.go 분석 + CONTEXT.md 결정
type SIPEvent struct {
    CallID string
}

type SessionStore struct {
    mu           sync.RWMutex
    dialogs      map[string]diago.DialogSession  // key: "instanceID:callID"
    sipEventSubs map[string][]chan SIPEvent       // key: "instanceID:eventType"
}

func NewSessionStore() *SessionStore {
    return &SessionStore{
        dialogs:      make(map[string]diago.DialogSession),
        sipEventSubs: make(map[string][]chan SIPEvent),
    }
}

func sessionKey(instanceID, callID string) string {
    return instanceID + ":" + callID
}

// StoreDialog — 복합 키로 저장
func (ss *SessionStore) StoreDialog(key string, dialog diago.DialogSession) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    ss.dialogs[key] = dialog
}

// GetDialog — 복합 키로 조회
func (ss *SessionStore) GetDialog(key string) (diago.DialogSession, bool) {
    ss.mu.RLock()
    defer ss.mu.RUnlock()
    dialog, exists := ss.dialogs[key]
    return dialog, exists
}

// emitSIPEvent — callID 포함
func (ss *SessionStore) emitSIPEvent(instanceID, eventType, callID string) {
    key := instanceID + ":" + eventType
    event := SIPEvent{CallID: callID}
    ss.mu.RLock()
    subs := ss.sipEventSubs[key]
    ss.mu.RUnlock()

    for _, ch := range subs {
        select {
        case ch <- event:
        default:
        }
    }
}

// SubscribeSIPEvent — chan SIPEvent 반환
func (ss *SessionStore) SubscribeSIPEvent(instanceID, eventType string) chan SIPEvent {
    key := instanceID + ":" + eventType
    ch := make(chan SIPEvent, 1)
    ss.mu.Lock()
    ss.sipEventSubs[key] = append(ss.sipEventSubs[key], ch)
    ss.mu.Unlock()
    return ch
}

// UnsubscribeSIPEvent — chan SIPEvent 타입으로 업데이트
func (ss *SessionStore) UnsubscribeSIPEvent(instanceID, eventType string, ch chan SIPEvent) {
    // ... 기존 로직과 동일, 타입만 변경 ...
}
```

### GraphNode callID 필드 추가

```go
// 소스: 기존 graph.go 분석
type GraphNode struct {
    // ... 기존 필드 유지 ...
    CallID string // Phase 14: callID — 없으면 마이그레이션에서 "call-1" 주입
}
```

`ParseScenario`에서 노드 파싱 시 callID 추출:
```go
gnode.CallID = getStringField(node.Data, "callId", "")
```

### v1.2 마이그레이션 함수

```go
// migrateCallIDs는 v1.2 시나리오의 callID 없는 노드에 기본값 "call-1"을 주입한다
func migrateCallIDs(graph *ExecutionGraph) {
    for _, node := range graph.Nodes {
        if node.CallID == "" {
            node.CallID = "call-1"
        }
    }
}

// ParseScenario 마지막 검증 전에 호출
// 기존: return graph, nil
// 변경:
migrateCallIDs(graph)
return graph, nil
```

### MakeCall에서 callID 사용

```go
// executeMakeCall — StoreDialog에 복합 키 사용
dialog, err := instance.UA.Invite(timeoutCtx, recipient, diago.InviteOptions{})
if err != nil {
    return fmt.Errorf("Invite failed: %w", err)
}

// 복합 키로 저장
key := sessionKey(instanceID, node.CallID)
ex.sessions.StoreDialog(key, dialog)
```

### executeWaitSIPEvent — callID 필터링 루프

```go
func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType string, timeout time.Duration) error {
    ch := ex.sessions.SubscribeSIPEvent(instanceID, eventType)
    defer ex.sessions.UnsubscribeSIPEvent(instanceID, eventType, ch)

    for {
        select {
        case event := <-ch:
            if event.CallID != node.CallID {
                // 다른 callID의 이벤트 — 무시하고 계속 대기
                continue
            }
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("%s event received (callID: %s)", eventType, node.CallID), "info")
            return nil
        case <-ctx.Done():
            return fmt.Errorf("%s event timeout after %v", eventType, timeout)
        }
    }
}
```

---

## State of the Art

| 이전 접근법 | 현재 접근법 | 변경 시점 | 영향 |
|------------|-----------|----------|------|
| `map[instanceID]dialog` (1:1) | `map[instanceID:callID]dialog` (1:N) | Phase 14 | 인스턴스당 복수 dialog 관리 가능 |
| `chan struct{}` SIP 이벤트 | `chan SIPEvent{CallID}` | Phase 14 | callID 기반 이벤트 필터링 가능 |
| `serverSessions` 별도 맵 | 제거 — `dialogs`로 통합 | Phase 14 | IncomingCall이 직접 복합 키로 dialogs에 저장 |
| `incomingCh` 버퍼 1 | 버퍼 4 | Phase 14 | 동시 INVITE 4개까지 비손실 처리 |

---

## Open Questions

1. **Answer 시 dialog 재저장 필요 여부**
   - 아는 것: IncomingCall이 `dialogs[instanceID:callID] = serverSession`으로 저장함. Answer 후에도 동일 객체.
   - 불명확한 것: `AnswerOptions` 호출 후 `diago.DialogServerSession` 내부 상태가 변경되어 재저장이 필요한 경우가 있는지.
   - 권장사항: 현재 Answer 성공 후 `StoreDialog` 재호출 제거. diago 소스 확인 결과 `AnswerOptions`는 내부 상태를 업데이트하지만 포인터는 동일함 — 재저장 불필요. 단, 안전을 위해 재저장해도 무해.

2. **executeDisconnected에서 callID로 dialog 조회**
   - 아는 것: 현재 `GetDialog(instanceID)`로 조회. v1.3에서는 `GetDialog(sessionKey(instanceID, node.CallID))`로 변경 필요.
   - 불명확한 것: DISCONNECTED 이벤트 노드에 `node.CallID` 필드가 없는 경우 (v1.2 마이그레이션에서 "call-1" 주입 예정).
   - 권장사항: migrateCallIDs가 처리하므로 문제 없음.

3. **Release, Hold, Retrieve, BlindTransfer의 dialog 조회 일원화**
   - 아는 것: 모두 `GetDialog(instanceID)`로 조회. v1.3에서 `GetDialog(sessionKey(instanceID, node.CallID))`로 변경 필요.
   - 불명확한 것: `node.CallID`를 각 execute 함수에 전달하는 방식 (이미 `node *GraphNode`를 파라미터로 받으므로 `node.CallID` 접근 가능).
   - 권장사항: 각 execute 함수에서 `ex.sessions.GetDialog(sessionKey(instanceID, node.CallID))`로 변경. 일관된 패턴.

---

## Impact Analysis (변경 범위)

### executor.go

| 변경 대상 | 변경 내용 |
|-----------|-----------|
| `SessionStore` 구조체 | `serverSessions` 맵 제거, `SIPEvent` 타입 추가, `sipEventSubs` 채널 타입 변경 |
| `NewSessionStore()` | `serverSessions` 초기화 제거 |
| `sessionKey()` | 새 헬퍼 함수 추가 |
| `StoreServerSession()` | 제거 |
| `GetServerSession()` | 제거 |
| `emitSIPEvent(instanceID, eventType)` | `emitSIPEvent(instanceID, eventType, callID)` — 시그니처 변경 |
| `SubscribeSIPEvent()` | `chan struct{}` → `chan SIPEvent` 반환 타입 변경 |
| `UnsubscribeSIPEvent()` | `chan struct{}` → `chan SIPEvent` 파라미터 타입 변경 |
| `executeMakeCall()` | `StoreDialog(instanceID, ...)` → `StoreDialog(sessionKey(instanceID, node.CallID), ...)` |
| `executeAnswer()` | `GetServerSession()` 대신 `GetDialog(sessionKey(instanceID, node.CallID))` + 타입 어서션, emitSIPEvent callID 추가 |
| `executeRelease()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeIncoming()` | `StoreServerSession()` 대신 `StoreDialog(sessionKey(instanceID, node.CallID), ...)` |
| `executeDisconnected()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executePlayAudio()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeSendDTMF()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeDTMFReceived()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeHold()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeRetrieve()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeBlindTransfer()` | `GetDialog(instanceID)` → `GetDialog(sessionKey(instanceID, node.CallID))` |
| `executeWaitSIPEvent()` | `chan struct{}` → `chan SIPEvent` + callID 필터링 루프 추가 |

### engine.go

| 변경 대상 | 변경 내용 |
|-----------|-----------|
| `emitSIPEvent(instanceID, eventType)` | `emitSIPEvent(instanceID, eventType, callID)` — 시그니처 변경 |

### instance_manager.go

| 변경 대상 | 변경 내용 |
|-----------|-----------|
| `incomingCh` 버퍼 | `make(chan *diago.DialogServerSession, 1)` → `make(chan *diago.DialogServerSession, 4)` |

### graph.go

| 변경 대상 | 변경 내용 |
|-----------|-----------|
| `GraphNode` 구조체 | `CallID string` 필드 추가 |
| `ParseScenario()` | command/event 노드 파싱 시 `callId` 필드 읽기 추가 |
| `migrateCallIDs()` | 새 함수 추가 (callID 없는 노드에 "call-1" 주입) |

### 테스트 파일

| 변경 대상 | 변경 내용 |
|-----------|-----------|
| `executor_test.go` | `chan struct{}` → `chan SIPEvent` 타입 변경, emitSIPEvent 시그니처 업데이트, GetServerSession 테스트 제거 |
| 신규 테스트 추가 | 멀티 callID 저장/조회, SIPEvent callID 필터링, IncomingCall callID 부여 테스트 |

---

## Sources

### Primary (HIGH 신뢰도)

- 코드베이스 직접 분석 — `/home/overthinker/Project/sipflow/internal/engine/executor.go`
- 코드베이스 직접 분석 — `/home/overthinker/Project/sipflow/internal/engine/graph.go`
- 코드베이스 직접 분석 — `/home/overthinker/Project/sipflow/internal/engine/instance_manager.go`
- diago v0.27.0 소스 — `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go`
- diago v0.27.0 소스 — `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go`
- diago v0.27.0 소스 — `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session.go`
- CONTEXT.md 결정사항 — `/home/overthinker/Project/sipflow/.planning/phases/14-session-store-multi-dialog/CONTEXT.md`
- STATE.md 누적 결정 — `/home/overthinker/Project/sipflow/.planning/STATE.md`

---

## Metadata

**신뢰도 세분화:**
- 표준 스택: HIGH — 기존 코드베이스 분석 기반, 신규 라이브러리 없음
- 아키텍처: HIGH — diago API 직접 검증, 기존 패턴 확장
- 함정: HIGH — 현재 코드의 구체적 패턴 분석 결과

**연구 날짜:** 2026-02-20
**유효 기한:** 60일 (안정적인 리팩토링 범위, diago 버전 고정)
