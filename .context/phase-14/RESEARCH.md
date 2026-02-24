# Phase 14: SessionStore 멀티 다이얼로그 - Research

**Researched:** 2026-02-20
**Domain:** Go concurrent state management, SIP dialog lifecycle, diago v0.27.0 API
**Confidence:** HIGH

## Summary

Phase 14는 기존 `SessionStore`의 단일 키(`instanceID`)를 복합 키(`instanceID:callID`)로 확장하는 리팩토링이다. 동시에 `chan struct{}`를 `chan SIPEvent`로 교체하여 이벤트 페이로드에 callID를 포함시키고, `incomingCh` 버퍼를 1에서 4로 확장한다. 변경 범위는 `executor.go` 내 `SessionStore`, `executeIncoming`, `emitSIPEvent`, `SubscribeSIPEvent`에 집중되며, `graph.go`에서 `GraphNode`에 `CallID` 필드 추가, `ParseScenario`에서 마이그레이션 로직 추가가 필요하다.

현재 코드베이스: `SessionStore.dialogs`가 `map[string]diago.DialogSession` (key=instanceID), `SessionStore.serverSessions`가 `map[string]*diago.DialogServerSession` (key=instanceID). Phase 14에서 두 맵 모두 복합 키로 전환하고, `serverSessions`는 제거한다 — IncomingCall이 직접 `dialogs`에 복합 키로 저장한다.

**주요 권장사항:** `sessionKey(instanceID, callID)` 헬퍼 함수를 중심으로 모든 저장/조회 코드를 일원화하고, `SIPEvent{CallID string}` 타입으로 이벤트 버스 채널을 교체한다. v1.2 하위 호환은 `ParseScenario`의 마이그레이션 함수 하나로 처리한다.

---

## 핵심 결정사항 (CONTEXT)

### 1. callID 생명주기

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

### 2. callID 기본값 정책

| 항목 | 결정 |
|------|------|
| **callID 미지정 시** | 마이그레이션에서 "call-1" 자동 주입 |
| **모든 노드** | callID 필수 — 없으면 에러 |
| **v1.2 하위 호환** | 시나리오 로드 시 `migrateCallIDs()` 함수로 자동 주입 |

### 3. 수신 INVITE 라우팅 — 콜 버퍼 모델

```
INVITE#1 도착 → 콜 버퍼: [#1]
INVITE#2 도착 → 콜 버퍼: [#1, #2]

IncomingCall(callID="call-1") 실행 → #1을 꺼냄 → "call-1"으로 SessionStore 저장
IncomingCall(callID="call-2") 실행 → #2를 꺼냄 → "call-2"로 SessionStore 저장

Answer(callID="call-1") 실행 → "call-1" dialog 찾아서 200 OK
Answer(callID="call-2") 실행 → "call-2" dialog 찾아서 200 OK
```

| 항목 | 결정 |
|------|------|
| **incomingCh 버퍼 크기** | 1 → 4 확장 |
| **라우팅 방식** | FIFO (선입선출) |
| **callID 부여 시점** | IncomingCall 이벤트 노드가 콜 버퍼에서 꺼낼 때 |

### 4. SIP 이벤트 버스

| 항목 | 결정 |
|------|------|
| **이벤트 키** | 기존 `{instanceID}:{eventType}` 유지 |
| **callID 전달** | 이벤트 페이로드에 callID 포함 |
| **채널 타입** | `chan struct{}` → `chan SIPEvent` (callID 필드 포함) |
| **구독자 필터링** | 구독자가 수신 후 `event.CallID == myCallID` 확인하여 필터링 |
| **IncomingCall 메커니즘** | SIP 이벤트 버스와 별도, incomingCh 유지 |

### 5. SessionStore 복합 키

| 항목 | 결정 |
|------|------|
| **키 포맷** | 문자열 복합 키 `"{instanceID}:{callID}"` |
| **키 생성** | `sessionKey(instanceID, callID string) string` 헬퍼 함수 |
| **내부 맵** | `map[string]diago.DialogSession` (기존 타입 유지, 키만 변경) |

---

## 아키텍처 패턴

### 목표 SessionStore 구조 (v1.3)

```
SessionStore (현재 v1.2)
├── dialogs: map[instanceID]diago.DialogSession
├── serverSessions: map[instanceID]*diago.DialogServerSession
└── sipEventSubs: map["{instanceID}:{eventType}"][]chan struct{}

SessionStore (목표 v1.3)
├── dialogs: map["{instanceID}:{callID}"]diago.DialogSession
└── sipEventSubs: map["{instanceID}:{eventType}"][]chan SIPEvent
```

### 패턴 1: sessionKey 헬퍼 함수

```go
func sessionKey(instanceID, callID string) string {
    return instanceID + ":" + callID
}

// 사용 예
key := sessionKey("alice", "primary")   // → "alice:primary"
key := sessionKey("alice", "call-1")    // → "alice:call-1"
```

### 패턴 2: SIPEvent 구조체

```go
type SIPEvent struct {
    CallID string
}

// 채널 타입 변경
sipEventSubs: map[string][]chan SIPEvent  // 기존 chan struct{} → chan SIPEvent

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

func (ss *SessionStore) SubscribeSIPEvent(instanceID, eventType string) chan SIPEvent {
    key := instanceID + ":" + eventType
    ch := make(chan SIPEvent, 1)
    // ...append to subs...
    return ch
}
```

### 패턴 3: callID 필터링 루프 (executeWaitSIPEvent)

```go
func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType string, timeout time.Duration) error {
    ch := ex.sessions.SubscribeSIPEvent(instanceID, eventType)
    defer ex.sessions.UnsubscribeSIPEvent(instanceID, eventType, ch)

    for {
        select {
        case event := <-ch:
            if event.CallID != node.CallID {
                continue // 다른 callID의 이벤트 → 무시하고 계속 대기
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

**주의:** `for { select { ... } }` 구조 필수. 기존 단순 `select`에서 변경해야 한다.

### 패턴 4: IncomingCall에서 callID 부여

```go
func (ex *Executor) executeIncoming(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
    instance, err := ex.im.GetInstance(instanceID)
    if err != nil {
        return fmt.Errorf("failed to get instance: %w", err)
    }

    select {
    case inDialog := <-instance.incomingCh:
        callID := node.CallID  // 노드에 명시된 callID 사용

        // serverSessions 대신 dialogs에 직접 저장
        ex.sessions.StoreDialog(sessionKey(instanceID, callID), inDialog)

        ex.engine.emitActionLog(...)
        return nil
    case <-ctx.Done():
        return fmt.Errorf("INCOMING event timeout after %v", timeout)
    }
}
```

### 패턴 5: v1.2 마이그레이션

```go
func migrateCallIDs(graph *ExecutionGraph) {
    for _, node := range graph.Nodes {
        if node.CallID == "" {
            node.CallID = "call-1"
        }
    }
}

// ParseScenario 마지막에 호출
migrateCallIDs(graph)
return graph, nil
```

### 패턴 6: incomingCh 버퍼 확장

```go
// instance_manager.go CreateInstances
// 기존
incomingCh: make(chan *diago.DialogServerSession, 1),
// 변경
incomingCh: make(chan *diago.DialogServerSession, 4),
```

---

## 변경 범위 (Impact Analysis)

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
| `executeAnswer()` | `GetServerSession()` 대신 `GetDialog(sessionKey(instanceID, node.CallID))` + 타입 어서션 |
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

## 주요 함정

### 함정 1: executeAnswer 타입 어서션 실패

```go
serverSession, ok := dialog.(*diago.DialogServerSession)
if !ok {
    return fmt.Errorf("callID %s: dialog is %T, not DialogServerSession (was MakeCall called with same callID?)",
        node.CallID, dialog)
}
```

### 함정 2: OnMediaUpdate 클로저 callID 캡처

```go
callID := node.CallID  // 클로저 외부에서 복사 필수
OnMediaUpdate: func(d *diago.DialogMedia) {
    go func() {
        ex.engine.emitSIPEvent(instanceID, "HELD", callID) // node.CallID 직접 참조 금지
    }()
},
```

### 함정 3: for 루프 없는 SIPEvent 필터링

`select { case event := <-ch: if event.CallID != myCallID { /* 무시 */ } }` 패턴은 이벤트를 소비하고 다시 대기하지 않아 잘못된 타임아웃 발생. 반드시 `for { select { ... } }` 구조 사용.

### 함정 4: Answer 시 dialog 재저장

IncomingCall이 이미 복합 키로 저장했으므로 Answer에서 재저장 불필요 (동일 포인터). 단, 재저장해도 무해.

---

## 신뢰도

- 표준 스택: HIGH — 기존 코드베이스 분석 기반, 신규 라이브러리 없음
- 아키텍처: HIGH — diago API 직접 검증, 기존 패턴 확장
- 함정: HIGH — 현재 코드의 구체적 패턴 분석 결과
