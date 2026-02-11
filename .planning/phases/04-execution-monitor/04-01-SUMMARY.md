---
phase: 04-execution-monitor
plan: 01
type: execute
subsystem: backend-frontend-integration
tags: [sip-events, typescript-types, zustand-store, functional-options]
completed: 2026-02-11
duration: 65s

dependencies:
  requires:
    - 03-05 (프론트엔드 이벤트 통합)
    - 03-06 (실행 통합 테스트)
  provides:
    - SIP 메시지 상세 정보 이벤트 시스템
    - 엣지 애니메이션 타입 정의
    - sipMessages 및 edgeAnimations 스토어 상태
  affects:
    - 04-02 (엣지 애니메이션 구현 시 EdgeAnimationMessage 사용)
    - 04-03 (로그 상세 정보 패널 시 sipMessages 사용)
    - 04-04 (타임라인 패널 시 sipMessages 사용)

tech-stack:
  added:
    - Go functional options pattern (ActionLogOption)
  patterns:
    - Variadic options for backward compatibility
    - Optional field expansion in TypeScript interfaces
    - Zustand filtered state arrays (sipMessages from actionLogs)

key-files:
  created: []
  modified:
    - internal/engine/events.go
    - internal/engine/executor.go
    - frontend/src/features/scenario-builder/types/execution.ts
    - frontend/src/features/scenario-builder/store/execution-store.ts

decisions:
  - title: "Functional Options Pattern for SIP Details"
    rationale: "Variadic ActionLogOption allows adding sipMessage without breaking existing emitActionLog calls"
    impact: "Backward compatible event emission, clean API for future extensions"
  - title: "Separate sipMessages Array in Store"
    rationale: "Filter actionLogs once at insertion instead of filtering in every component render"
    impact: "Performance optimization for timeline and log detail panels"
  - title: "Component-level Edge Animation Lifecycle"
    rationale: "setTimeout for animation cleanup is UI concern, keep store logic simple"
    impact: "addEdgeAnimation/removeEdgeAnimation are just state operations, components manage timing"
  - title: "Call-ID as Empty String"
    rationale: "diago DialogSession interface doesn't expose Call-ID getter, use empty string with comment"
    impact: "Call-ID not available in UI for now, can be added when diago supports it"
---

# Phase 04 Plan 01: Backend SIP 메시지 상세 + Frontend 타입/스토어 Summary

**One-line summary:** Go 백엔드가 SIP 메시지 direction/method/responseCode를 action-log 이벤트에 포함하고, 프론트엔드가 sipMessages 및 edgeAnimations 상태로 관리하는 기반 구축

## What Was Built

### Task 1: Go Backend SIP Message Detail Event Expansion
- **ActionLogOption 타입 도입**: Functional options 패턴으로 emitActionLog 확장
- **WithSIPMessage 옵션**: SIP 메시지 상세 정보(direction, method, responseCode, callID, from, to)를 옵션으로 추가
- **emitActionLog 메서드 업데이트**: 가변인자 `opts ...ActionLogOption`로 변경, 기존 호출은 하위 호환 유지
- **SIP 액션에 WithSIPMessage 추가**:
  - `executeMakeCall`: "sent" INVITE with from/to URIs
  - `executeAnswer`: "received" INVITE with from/to users
  - `executeRelease`: "sent" BYE
  - `executeIncoming`: "received" INVITE with from/to
  - `executeRinging`: "received" RINGING with 180 response code

**Note:** Call-ID는 diago DialogSession 인터페이스에서 접근 불가하여 빈 문자열로 설정 (주석으로 명시)

### Task 2: Frontend Type Expansion + ExecutionStore SIP Messages and Edge Animations State
- **SIPMessageDetail 인터페이스**: direction ('sent'|'received'), method, responseCode, callId, from, to 필드 정의
- **EdgeAnimationMessage 인터페이스**: id, edgeId, method, timestamp, duration 필드 정의
- **ActionLogEvent와 ActionLog에 sipMessage 필드 추가**: 선택적 필드로 하위 호환 유지
- **ExecutionStore 확장**:
  - `sipMessages: ActionLog[]` — sipMessage가 있는 로그만 필터링한 별도 배열
  - `edgeAnimations: EdgeAnimationMessage[]` — 현재 활성 엣지 애니메이션
  - `addEdgeAnimation(animation)` — 엣지 애니메이션 추가
  - `removeEdgeAnimation(id)` — 엣지 애니메이션 제거
  - `addActionLog` 수정 — sipMessage가 있으면 sipMessages 배열에도 추가 (최대 500개)
  - `reset()` 확장 — sipMessages, edgeAnimations 초기화 포함
- **useShallow 최적화 안내**: store 파일 상단에 주석으로 `useShallow` 사용법 추가

## Task Results

| Task | Name | Status | Commit | Files | Note |
| ---- | ---- | ------ | ------ | ----- | ---- |
| 1 | Go Backend SIP Message Detail Event Expansion | completed | a216ce7 | events.go, executor.go | Functional options pattern |
| 1 | Go Backend SIP Message Detail Event Expansion (cont.) | completed | 24a20c8 | executor.go | Additional WithSIPMessage calls |
| 2 | Frontend Type Expansion + ExecutionStore | completed | 7d74652 | execution.ts, execution-store.ts | TypeScript types + Zustand state |

## Verification Results

✅ Go build: `go build ./internal/engine/...` successful
✅ Go tests: `go test ./internal/engine/...` pass (cached)
✅ ActionLogOption type defined
✅ WithSIPMessage function implemented with 5 calls in executor.go
✅ SIPMessageDetail and EdgeAnimationMessage types defined
✅ ExecutionStore has sipMessages and edgeAnimations state
✅ addEdgeAnimation/removeEdgeAnimation methods exist
✅ addActionLog filters sipMessages
✅ reset() includes sipMessages and edgeAnimations
✅ Backward compatibility maintained (optional fields, variadic args)

## Deviations from Plan

### Auto-fixed Issues
None - plan was executed exactly as written.

## Decisions Made

1. **Functional Options Pattern for SIP Details**
   - Context: Need to add optional sipMessage data to emitActionLog without breaking existing calls
   - Decision: Use `ActionLogOption` functional options pattern with variadic args
   - Rationale: Allows adding new fields without changing all existing call sites, idiomatic Go pattern
   - Impact: Clean API, backward compatible, easy to extend in future (e.g., WithMetrics, WithContext)

2. **Separate sipMessages Array in Store**
   - Context: Timeline and log detail panels need to filter actionLogs by sipMessage presence
   - Decision: Maintain separate `sipMessages: ActionLog[]` that's filtered at insertion time
   - Rationale: Filter once in addActionLog instead of filtering in every component render
   - Impact: Performance optimization, O(1) access for components, slight memory overhead (negligible with 500-item cap)

3. **Component-level Edge Animation Lifecycle**
   - Context: EdgeAnimationMessage needs automatic cleanup after duration expires
   - Decision: Store only provides addEdgeAnimation/removeEdgeAnimation, components use setTimeout
   - Rationale: Animation timing is UI concern, keep store logic simple, avoid side effects in state manager
   - Impact: Components responsible for calling removeEdgeAnimation after duration, store remains pure

4. **Call-ID as Empty String**
   - Context: SIP Call-ID is useful for debugging but diago DialogSession doesn't expose it
   - Decision: Use empty string for callId field, document with comment in code
   - Rationale: Don't block implementation waiting for diago library changes
   - Impact: Call-ID not shown in UI for now, can be added when diago v0.28+ supports it
   - Workaround: Monitor diago releases, add call ID extraction when available

## Next Phase Readiness

### Blockers
None

### Concerns
- **diago Call-ID Access**: Current limitation documented, not critical for MVP
- **Edge Animation Timing**: Component must call removeEdgeAnimation after duration — ensure all usage sites implement this

### Prerequisites for Next Plans
- ✅ 04-02 (엣지 애니메이션): EdgeAnimationMessage 타입 사용 가능
- ✅ 04-03 (로그 상세 정보): sipMessages 배열 사용 가능
- ✅ 04-04 (타임라인 패널): sipMessages 배열로 시간순 SIP 플로우 렌더링 가능

## Lessons Learned

1. **Functional Options Pattern is Powerful**: Go's variadic functional options provide excellent backward compatibility while extending APIs
2. **Filter at Source, Not at Render**: Filtering sipMessages at insertion time prevents repeated filter() calls in components
3. **Keep Store Pure**: Animation cleanup (setTimeout) belongs in components, not in Zustand store
4. **Document Library Limitations**: Explicit comments about diago Call-ID limitation prevent future confusion

## Testing Notes

- Existing Go tests pass (no breaking changes)
- TypeScript compiles successfully for execution.ts and execution-store.ts
- Manual verification needed: Run scenario with MakeCall → verify sipMessage in frontend event
- Integration test for sipMessage field: Defer to 04-02 when edge animations are visually testable

## Self-Check: PASSED

All files and commits verified:
- ✅ events.go: ActionLogOption, WithSIPMessage
- ✅ executor.go: 5 WithSIPMessage calls
- ✅ execution.ts: SIPMessageDetail, EdgeAnimationMessage interfaces
- ✅ execution-store.ts: sipMessages, edgeAnimations state
- ✅ Commits: a216ce7, 7d74652, 24a20c8
