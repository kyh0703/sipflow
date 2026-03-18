# Phase 14 Context — SessionStore 멀티 다이얼로그

**Phase:** 14 — SessionStore 멀티 다이얼로그
**Created:** 2026-02-20
**Status:** 논의 완료

---

## 핵심 원칙

> **callID는 MakeCall / IncomingCall 시점에 탄생한다.**
> 인스턴스를 시작할 때는 callID가 없다. MakeCall(발신)이나 IncomingCall(수신 INVITE 도착) 시점에서 dialog가 생성되며, 이때 callID가 부여된다. callID 없이는 어떤 Command/Event도 실행할 수 없다.

---

## 결정사항

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
| **callID 미지정 시** | 자동 생성 ("call-1", "call-2" 등 순차 부여) |
| **모든 노드** | callID 필수 — 없으면 에러 |
| **v1.2 하위 호환** | 시나리오 로드 시 마이그레이션 (callID 없는 노드에 자동 주입) |

### 3. 수신 INVITE 라우팅 — 콜 버퍼 모델

**핵심: IncomingCall은 특정 callID로 필터링하는 것이 아니다.**
INVITE가 도착하면 순차적으로 인스턴스의 콜 버퍼에 쌓이고, IncomingCall 이벤트 노드가 FIFO로 꺼내면서 callID를 부여한다.

```
// 콜 버퍼에 순차적으로 쌓임
INVITE#1 도착 → 콜 버퍼: [#1]
INVITE#2 도착 → 콜 버퍼: [#1, #2]

// IncomingCall 노드가 FIFO로 꺼내면서 callID 부여
IncomingCall(callID="call-1") 실행 → #1을 꺼냄 → "call-1"으로 SessionStore 저장
IncomingCall(callID="call-2") 실행 → #2를 꺼냄 → "call-2"로 SessionStore 저장

// Answer 노드가 이미 저장된 dialog 응답
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

```go
// SIPEvent 구조체 (chan struct{} 대체)
type SIPEvent struct {
    CallID string
}

// 발행: 인스턴스의 모든 구독자에게 전송
emitSIPEvent("alice", "HELD", SIPEvent{CallID: "primary"})

// 구독자: callID 필터링
ch := SubscribeSIPEvent("alice", "HELD")
event := <-ch
if event.CallID != myCallID { continue }
```

### 5. SessionStore 복합 키

| 항목 | 결정 |
|------|------|
| **키 포맷** | 문자열 복합 키 `"{instanceID}:{callID}"` |
| **키 생성** | `sessionKey(instanceID, callID string) string` 헬퍼 함수 |
| **내부 맵** | `map[string]diago.DialogSession` (기존 타입 유지, 키만 변경) |

```go
func sessionKey(instanceID, callID string) string {
    return instanceID + ":" + callID
}

// 예시
sessionKey("alice", "primary")  // → "alice:primary"
sessionKey("alice", "consult")  // → "alice:consult"
sessionKey("alice", "call-1")   // → "alice:call-1" (자동 생성)
```

---

## v1.2 → v1.3 마이그레이션 전략

v1.2 시나리오 JSON에는 callID 필드가 없다. 로드 시점에 자동 보정:

1. **MakeCall 노드**: callID 없으면 "call-1" 자동 부여
2. **Answer 노드**: callID 없으면 "call-1" 자동 부여
3. **Hold/Retrieve/Release/BlindTransfer**: callID 없으면 "call-1" 자동 부여
4. **Event 노드**: callID 없으면 "call-1" 자동 부여

v1.2 시나리오는 인스턴스당 1개 dialog만 사용하므로 모두 동일 callID로 보정하면 기존 동작 보장.

---

## 미뤄진 아이디어

없음 — 논의는 Phase 14 범위 내에서 완결됨.

---

## 다음 단계

`/prp:plan-phase 14` — 이 CONTEXT.md를 참조하여 상세 실행 계획 수립
