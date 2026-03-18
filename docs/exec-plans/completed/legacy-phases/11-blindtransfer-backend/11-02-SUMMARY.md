---
phase: 11
plan: 02
subsystem: sip-engine
tags: [blindtransfer, refer, onrefer, transferred, sip, executor, tdd]

depends_on:
  requires: [11-01]
  provides: [OnRefer-full-impl, BlindTransfer-error-tests, TRANSFERRED-routing-tests]
  affects: []

tech-stack:
  added: []
  patterns: [OnRefer-callback, referDialog-Invite-Ack, SessionStore-swap, StoreDialog-before-emit]

key-files:
  created: []
  modified:
    - internal/engine/executor.go
    - internal/engine/executor_test.go
    - internal/engine/graph_test.go

decisions:
  - item: "Refer-To URI를 InviteRequest.Recipient 필드로 추출"
    reason: "sip.Request에 RequestURI() 메서드 없음 — Recipient 필드가 request-line URI"
  - item: "StoreDialog 이후 emitSIPEvent(TRANSFERRED)"
    reason: "SessionStore 교체 완료 후에만 이벤트 발행하여 후속 노드가 올바른 dialog 사용 보장"
  - item: "Invite/Ack 실패 시 에러 반환 → TRANSFERRED 미발행"
    reason: "Invite 실패 시 전달이 완료되지 않았으므로 TRANSFERRED 이벤트를 발행하면 안 됨 → 타임아웃 유도"

metrics:
  duration: "4 minutes (2026-02-19T12:11:26Z → 2026-02-19T12:15:29Z)"
  completed: "2026-02-19"
---

# Phase 11 Plan 02: OnRefer 콜백 완전 구현 + BlindTransfer 테스트 Summary

diago OnRefer 콜백을 Phase 10 스텁에서 Refer-To URI 추출 + referDialog.Invite/Ack + SessionStore 교체 + TRANSFERRED 이벤트 발행 순서로 완전 구현하고, BlindTransfer/TRANSFERRED 에러 경로 및 이벤트 라우팅 테스트 7개를 추가.

## What Was Built

### Task 1: OnRefer 콜백 완전 구현

**File:** `internal/engine/executor.go`

Phase 10 스텁을 완전한 구현으로 교체했다:

```go
OnRefer: func(referDialog *diago.DialogClientSession) error {
    // 1. Refer-To URI 추출
    referToURIStr := "<unknown>"
    if referDialog.InviteRequest != nil {
        referToURIStr = referDialog.InviteRequest.Recipient.String()
    }
    // 2. ActionLog 기록
    ex.engine.emitActionLog(...)
    // 3. INVITE + ACK
    inviteCtx := referDialog.Context()
    referDialog.Invite(inviteCtx, diago.InviteClientOptions{})
    referDialog.Ack(inviteCtx)
    // 4. SessionStore 교체
    ex.sessions.StoreDialog(instanceID, referDialog)
    // 5. TRANSFERRED 이벤트 발행
    ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")
    return nil
},
```

핵심 순서: URI 추출 → ActionLog → Invite+Ack → StoreDialog → emitSIPEvent

**버그 수정 (Rule 1):** 계획의 `referDialog.InviteRequest.RequestURI().String()`이 컴파일 에러를 유발했다. sip.Request에는 `RequestURI()` 메서드가 없고 `Recipient` 필드로 request-line URI에 접근해야 한다. `referDialog.InviteRequest.Recipient.String()`으로 수정.

### Task 2: BlindTransfer + TRANSFERRED 에러 경로 + 이벤트 라우팅 테스트

**Files:** `internal/engine/executor_test.go`, `internal/engine/graph_test.go`

7개의 신규 테스트 함수 추가:

| 테스트 | 검증 대상 |
|--------|-----------|
| TestExecuteBlindTransfer_EmptyTargetUser | targetUser 빈 값 에러 경로 |
| TestExecuteBlindTransfer_EmptyTargetHost | targetHost 빈 값 에러 경로 |
| TestExecuteBlindTransfer_NoDialog | dialog 미존재 에러 경로 |
| TestExecuteCommand_BlindTransferSwitch | executeCommand switch BlindTransfer 라우팅 |
| TestExecuteEvent_TransferredSwitch | TRANSFERRED 타임아웃 + switch 라우팅 |
| TestExecuteWaitSIPEvent_Transferred_Success | TRANSFERRED 이벤트 정상 수신 (50ms 지연) |
| TestParseScenario_BlindTransferFields | TargetUser/TargetHost JSON 파싱 검증 |

## Decisions Made

| 결정 | 이유 |
|------|------|
| Recipient 필드 사용 | sip.Request.RequestURI() 미존재 — Recipient가 request-line URI 필드 |
| StoreDialog 후 emitSIPEvent | 순서 역전 시 후속 노드가 기존(닫힌) dialog 참조하는 버그 방지 |
| Invite 실패 시 에러 반환 | 전달 미완료 상태에서 TRANSFERRED 발행은 거짓 성공이므로 에러 반환으로 타임아웃 유도 |
| graph_test.go에 ParseScenario 테스트 추가 | ParseScenario가 graph.go에 정의되어 있어 graph_test.go가 올바른 위치 |

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OnRefer 콜백 완전 구현 — Refer-To URI + Invite/Ack + SessionStore 교체 | ce9505e | internal/engine/executor.go |
| 2 | BlindTransfer 에러 경로 + TRANSFERRED 이벤트 라우팅 테스트 | 07f117d | internal/engine/executor_test.go, internal/engine/graph_test.go |

## Verification Results

- `go build ./...`: PASS
- `go vet ./internal/engine/...`: PASS
- `go test ./internal/engine/ -v`: 전체 통과 (50 tests, 0 failed)
- 신규 테스트: `TestExecuteBlindTransfer_*`, `TestExecuteCommand_BlindTransferSwitch`, `TestExecuteEvent_TransferredSwitch`, `TestExecuteWaitSIPEvent_Transferred_Success`, `TestParseScenario_BlindTransferFields` — 모두 PASS
- grep 확인: `referDialog.Invite`, `referDialog.Ack`, `StoreDialog.*referDialog`, `Refer-To=` — 모두 확인

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RequestURI() → Recipient 필드로 수정**

- **발견 시점:** Task 1 컴파일 단계
- **문제:** 계획에 `referDialog.InviteRequest.RequestURI().String()` 명시. sip.Request 타입에 RequestURI() 메서드가 없어 컴파일 에러 발생
- **수정:** `referDialog.InviteRequest.Recipient.String()`으로 교체 (sip.Request.Recipient은 request-line URI 필드)
- **수정된 파일:** `internal/engine/executor.go`
- **커밋:** ce9505e (Task 1 커밋에 포함)

## Self-Check: PASSED

- `internal/engine/executor.go` — FOUND (modified)
- `internal/engine/executor_test.go` — FOUND (modified)
- `internal/engine/graph_test.go` — FOUND (modified)
- Commit `ce9505e` — FOUND
- Commit `07f117d` — FOUND
