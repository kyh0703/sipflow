---
phase: 10
plan: 01
subsystem: sip-engine
tags: [hold, retrieve, answer-options, sip-event-bus, goroutine, diago]

depends_on: []
provides:
  - "AnswerOptions 기반 executeAnswer() — OnMediaUpdate/OnRefer 콜백 등록"
  - "SessionStore SIP 이벤트 버스 — emitSIPEvent/SubscribeSIPEvent/UnsubscribeSIPEvent"
  - "Engine.emitSIPEvent() — executor.sessions로 이벤트 중계"
  - "WithSIPMessage note 파라미터 — variadic, 기존 호출 하위 호환"
  - "GraphNode.TransferTarget 필드 — Phase 11 BlindTransfer 대비"
affects:
  - "10-02: HeldEvent/RetrievedEvent 노드 구현 (SubscribeSIPEvent 직접 사용)"
  - "11-xx: BlindTransfer + TransferEvent (OnRefer 콜백, TransferTarget 필드 활용)"

tech-stack:
  added: []
  patterns:
    - "SIP 이벤트 버스: map[string][]chan struct{} + non-blocking send"
    - "OnMediaUpdate goroutine 분리: d.mu.Lock() 재진입 데드락 방지"
    - "variadic note 파라미터: 기존 함수 시그니처 하위 호환 확장"

key-files:
  created: []
  modified:
    - internal/engine/executor.go
    - internal/engine/engine.go
    - internal/engine/events.go
    - internal/engine/graph.go
    - internal/engine/executor_test.go

metrics:
  duration: "3m 47s"
  completed: "2026-02-19"
---

# Phase 10 Plan 01: AnswerOptions 리팩토링 + SIP 이벤트 버스 인프라 Summary

Hold/Retrieve Command와 HeldEvent/RetrievedEvent 노드 구현의 전제조건인 AnswerOptions 기반 Answer 실행과 SIP 이벤트 버스 인프라를 구축했다. diago의 AnswerOptions API를 활용하여 OnMediaUpdate 콜백으로 상대방 Hold/Retrieve를 감지하고, SessionStore 기반 이벤트 버스로 이벤트를 비동기 전달한다.

## What Was Built

### SessionStore SIP 이벤트 버스 (executor.go)

`SessionStore`에 `sipEventSubs map[string][]chan struct{}` 필드를 추가하고 세 메서드를 구현했다:

- `emitSIPEvent(instanceID, eventType string)`: RLock으로 `"{instanceID}:{eventType}"` 키의 채널들에 non-blocking send
- `SubscribeSIPEvent(instanceID, eventType string) chan struct{}`: 버퍼 1 채널 생성 후 맵에 append
- `UnsubscribeSIPEvent(instanceID, eventType string, ch chan struct{})`: 슬라이스에서 해당 채널 제거

### Engine executor 필드 승격 + emitSIPEvent (engine.go)

`Engine` 구조체에 `executor *Executor` 필드를 추가하고 `StartScenario()`에서 로컬 변수 대신 `e.executor`로 할당한다. `cleanup()`을 인자 없는 메서드로 변경하여 `e.executor`를 직접 참조한다.

`emitSIPEvent()` 메서드는 mutex로 executor 참조를 안전하게 읽어 `ex.sessions.emitSIPEvent()`를 중계한다.

### executeAnswer() AnswerOptions 리팩토링 (executor.go)

`serverSession.Answer()` → `serverSession.AnswerOptions(opts)` 전환. AnswerOptions 구성:

- `OnMediaUpdate`: **goroutine으로 분리** 필수 — `onMediaUpdate` 콜백은 `d.mu.Lock()` 안(`sdpReInviteUnsafe`)에서 호출되므로, 동일 goroutine에서 `d.MediaSession()`(내부 `d.mu.Lock()`)을 호출하면 데드락 발생
  - goroutine 안에서 `LocalSDP()` 파싱: `a=recvonly` → HELD, `a=sendrecv` → RETRIEVED
  - `defer recover()`로 패닉 방어
- `OnRefer`: Phase 11 대비 스텁 — TRANSFERRED 이벤트 발행

### WithSIPMessage note 파라미터 (events.go)

`func WithSIPMessage(direction, method string, responseCode int, callID, from, to string, note ...string)` — variadic으로 확장하여 기존 6개 인자 호출 코드 변경 없음. `note[0] != ""` 조건으로 빈 문자열은 포함하지 않는다.

### GraphNode TransferTarget 필드 (graph.go)

`TransferTarget string` 필드를 `Timeout` 뒤에 추가. `ParseScenario()`에서 `getStringField(node.Data, "transferTarget", "")` 파싱.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | c57418f | SessionStore SIP 이벤트 버스 + Engine executor 필드 승격 + WithSIPMessage note + GraphNode TransferTarget |
| Task 2 | 15783d0 | executeAnswer() AnswerOptions 리팩토링 + SIP 이벤트 버스 테스트 |

## Decisions Made

| 결정 | 이유 |
|------|------|
| OnMediaUpdate goroutine 분리 | diago `sdpReInviteUnsafe`가 `d.mu.Lock()` 안에서 콜백 호출 → 동일 goroutine에서 `MediaSession()` 재진입 시 데드락 |
| non-blocking send (default 케이스) | 이벤트 버스 발행 시 구독자가 처리 중이면 드랍 (버퍼 1로 최신 이벤트 보장) |
| variadic note 파라미터 | 기존 WithSIPMessage 호출 코드 변경 없이 SDP 방향 정보 추가 가능 |
| executor 필드 승격 | cleanup() 등 여러 메서드에서 executor 참조 필요, 필드로 승격하여 일관된 접근 |
| OnRefer 스텁 | Phase 11에서 실제 구현, 현재는 TRANSFERRED 이벤트 발행만 |

## Test Coverage

신규 테스트 추가 (모두 통과):

- `TestSessionStore_SIPEventBus`: 발행/구독/해제 플로우
- `TestSessionStore_SIPEventBus_MultipleSubscribers`: 다중 구독자 동시 수신
- `TestSessionStore_SIPEventBus_NoSubscribers`: 구독자 없을 때 패닉 없음
- `TestWithSIPMessage_Note`: note 포함 케이스
- `TestWithSIPMessage_NoNote`: 기존 6개 인자 호환성
- `TestWithSIPMessage_EmptyNote`: 빈 note 제외 확인

기존 테스트: 모두 통과 (`go test ./internal/engine/ -v`).

## Deviations from Plan

None - 계획이 작성된 대로 정확히 실행되었습니다.

## Next Phase Readiness

- Phase 10 Plan 02 (HeldEvent/RetrievedEvent 노드): `SubscribeSIPEvent`/`UnsubscribeSIPEvent` 직접 사용 가능
- Phase 11 (BlindTransfer): `OnRefer` 스텁 확장, `TransferTarget` 필드 활용 가능

## Self-Check: PASSED
