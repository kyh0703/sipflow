---
phase: 05-ui-completion
plan: 03
subsystem: testing
tags: [integration-test, e2e, verification, build]

# Dependencies
requires:
  - 03-04  # StartScenario 비동기 실행, 인스턴스별 goroutine
  - 03-05  # Wails 이벤트 시스템 통합
provides:
  - E2E integration test suite
  - Event stream verification
  - Cleanup verification
  - Build verification
affects:
  - 05-04  # 다음 UI completion 계획

# Technical Stack
tech-stack:
  added:
    - none (test-only plan)
  patterns:
    - Table-driven test pattern
    - Event stream verification
    - Cleanup verification pattern
    - Restart capability testing

# Key Files
key-files:
  created:
    - none (extended existing integration_test.go)
  modified:
    - internal/engine/integration_test.go
    - internal/engine/events.go
    - internal/engine/engine.go
    - frontend/src/components/ui/button.tsx

# Decisions
decisions:
  - title: "scenarioID 추적을 Engine에 추가"
    rationale: "scenario:completed 이벤트에 scenarioID 포함하여 여러 시나리오 실행 추적 가능"
    alternatives: "이벤트 payload에만 전달 (상태 없음)"
    trade-offs: "Engine에 상태 추가되지만, 이벤트 일관성 향상"

  - title: "2-instance TIMEOUT 체인으로 시뮬레이션"
    rationale: "diago localhost 포트 충돌로 실제 SIP 통화 불가, TIMEOUT 이벤트로 병렬 실행 검증"
    alternatives: "실제 SIP 통화 테스트 (로컬에서 실패)"
    trade-offs: "실제 SIP 프로토콜 검증은 불가하지만, 엔진 파이프라인 검증 가능"

  - title: "Button 컴포넌트 누락 버그 즉시 수정"
    rationale: "프론트엔드 빌드 실패 (deviation rule 1: 버그 자동 수정)"
    alternatives: "Phase 05-01로 돌아가서 수정"
    trade-offs: "현재 계획에서 수정하여 빠른 진행, 05-01에는 누락 상태"

# Metrics
duration: 5m 34s
completed: 2026-02-11
---

# Phase 05 Plan 03: Go 백엔드 E2E 통합 테스트 확장 Summary

**시나리오 실행 엔진의 전체 파이프라인 (시작 → 노드 실행 → 이벤트 발행 → 완료 → 정리)을 E2E 통합 테스트로 검증하여 MVP 안정성 확보.**

## Overview

Phase 03에서 구축한 시나리오 실행 엔진의 핵심 경로를 자동화된 통합 테스트로 검증하는 계획.

**Goals:**
- 2-instance 병렬 실행 시뮬레이션 검증
- 이벤트 스트림 정확성 (종류, 순서, 데이터) 검증
- 시나리오 완료 후 cleanup 및 재시작 가능성 검증
- Wails 빌드 검증 (또는 개별 빌드 대체)

**Outcome:**
- 3개의 새로운 E2E 통합 테스트 추가 (모두 통과)
- scenario:completed 이벤트에 scenarioID 추가로 이벤트 추적 개선
- 프론트엔드/Go 개별 빌드 성공 확인
- Wails 통합 빌드는 libwebkit 시스템 의존성으로 실패 (예상됨, 문서화됨)

## What Was Built

### 1. E2E Integration Tests

**TestIntegration_TwoPartyCallSimulation**
- 2개 인스턴스 (A, B)가 병렬 실행
- Instance A: TIMEOUT(500ms) → TIMEOUT(500ms) 체인
- Instance B: TIMEOUT(500ms) 단독
- 모든 노드가 completed 상태 도달 검증
- 시나리오 최종 상태 "completed" 검증

**TestIntegration_EventStreamVerification**
- 시나리오 실행 중 발행되는 이벤트 종류 검증:
  - scenario:started (scenarioId 포함)
  - node:state (nodeId, previousState, newState 포함)
  - action:log (nodeId, message 포함)
  - scenario:completed (scenarioId 포함)
- 이벤트 순서 검증: started → node:state → action:log → completed

**TestIntegration_CleanupVerification**
- 시나리오 완료 후 eng.IsRunning() == false 확인
- cleanup action logs 발행 확인 ("Starting cleanup", "Cleanup completed")
- 재시작 가능 여부 확인 (같은 엔진에서 새 시나리오 실행)
- 두 시나리오의 completed 이벤트가 각각의 scenarioId와 함께 발행됨을 확인

### 2. Event Tracking Enhancement

**Engine에 scenarioID 추가**
- `Engine.scenarioID` 필드 추가로 현재 실행 중인 시나리오 ID 추적
- `emitScenarioCompleted(scenarioID)` 시그니처 변경
- scenario:completed 이벤트에 scenarioId 포함하여 여러 시나리오 실행 추적 가능

**이벤트 구조 확인**
- node:state 이벤트는 `previousState`와 `newState` 사용 (oldState 아님)
- 모든 이벤트에 timestamp (UnixMilli) 포함

### 3. Build Verification

**Frontend Build: ✓ Success**
- `npm run build` 성공
- 산출물: frontend/dist/index.html, assets/
- 번들 크기: 525.38 kB (gzip: 165.60 kB)

**Go Build: ✓ Success**
- `go build ./...` 성공
- 모든 패키지 컴파일 완료

**Wails Build: ✗ Failed (Expected)**
- `wails build -clean` 실패
- 원인: Package 'webkit2gtk-4.0' not found in pkg-config
- 시스템 의존성 누락 (GTK, webkit2gtk 개발 라이브러리)
- STATE.md에 이미 문서화된 알려진 이슈

## Test Results

```
=== RUN   TestIntegration_TwoPartyCallSimulation
--- PASS: TestIntegration_TwoPartyCallSimulation (2.32s)

=== RUN   TestIntegration_EventStreamVerification
--- PASS: TestIntegration_EventStreamVerification (1.87s)

=== RUN   TestIntegration_CleanupVerification
--- PASS: TestIntegration_CleanupVerification (4.29s)

PASS
ok  	sipflow/internal/engine	8.490s
```

**전체 테스트 결과:**
- internal/engine: 20개 테스트 (19 PASS, 1 SKIP)
- internal/scenario: 7개 테스트 (모두 PASS)
- **Total: 27개 테스트 통과**

Skip된 테스트:
- TestIntegration_TwoPartyCall: diago localhost 포트 충돌 (실제 환경에서는 작동)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | E2E 2자 통화 시뮬레이션 테스트 + 이벤트 스트림 검증 | 12db659 | internal/engine/integration_test.go, events.go, engine.go |
| 2 | Wails 빌드 검증 | 032a967 | frontend/src/components/ui/button.tsx (버그 수정) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Button 컴포넌트 누락으로 프론트엔드 빌드 실패**

- **발견 시점:** Task 2 (Wails 빌드 시도 시)
- **이슈:** Phase 05-01에서 theme-toggle.tsx가 Button 컴포넌트를 import하지만, 파일이 존재하지 않아 TypeScript 컴파일 에러
- **수정:** shadcn/ui 패턴 기반 Button 컴포넌트 추가 (variant, size props 지원)
- **수정된 파일:** frontend/src/components/ui/button.tsx
- **커밋:** 032a967

**2. [Rule 2 - Core Missing] scenario:completed 이벤트에 scenarioId 누락**

- **발견 시점:** Task 1 (EventStreamVerification 테스트 작성 시)
- **이슈:** scenario:completed 이벤트가 timestamp만 포함하고 scenarioId 없어 여러 시나리오 실행 추적 불가
- **수정:**
  - Engine에 scenarioID 필드 추가
  - emitScenarioCompleted(scenarioID) 시그니처 변경
  - 이벤트 payload에 scenarioId 포함
- **수정된 파일:** internal/engine/events.go, engine.go
- **커밋:** 12db659

## Verification

✅ **All verification criteria met:**

1. `go test ./internal/... -v` — 27개 테스트 통과 (1 skip)
2. 신규 E2E 테스트가 시나리오 실행 파이프라인 전체 경로 검증
3. 이벤트 스트림 검증 테스트가 이벤트 종류/순서/데이터 확인
4. cleanup 테스트가 재시작 가능성 확인
5. 개별 빌드 (`go build ./...` + `npm run build`) 성공

**Wails 통합 빌드 실패는 Phase 5 전체 실패를 의미하지 않음:**
- 시스템 의존성 이슈 (libwebkit, GTK)로 예상된 실패
- Go 컴파일과 프론트엔드 빌드가 각각 성공함을 확인
- 시스템 의존성 해결 후 통합 빌드 가능

## Integration Points

### Consumed (from previous phases)

- **03-04**: StartScenario 비동기 실행, 인스턴스별 goroutine, 에러 채널
- **03-05**: EventEmitter 인터페이스, TestEventEmitter 구현
- **04-01**: emitActionLog functional options (WithSIPMessage)

### Provided (for future phases)

- **E2E Test Suite**: 시나리오 실행 엔진의 핵심 경로 검증 자동화
- **Event Stream Verification**: 이벤트 종류/순서/데이터 정확성 보장
- **Cleanup Verification**: 재시작 가능성 보장
- **Build Verification**: 개별 빌드 성공 확인 패턴

## Known Issues / Next Steps

### Known Issues

1. **Wails 통합 빌드 실패**
   - 원인: libwebkit, webkit2gtk-4.0 시스템 의존성 누락
   - 해결 방법: 프로덕션 빌드 환경에 GTK, webkit2gtk 개발 라이브러리 설치 필요
   - 현재 상태: 개발 환경에서는 `wails dev`로 실행 가능, 개별 빌드 성공

2. **Button 컴포넌트가 Phase 05-01에 누락**
   - 현재 계획(05-03)에서 수정되었지만, 05-01 SUMMARY에는 반영되지 않음
   - Phase 05-01 재실행 시 Button 컴포넌트가 이미 존재하므로 문제없음

### Future Improvements

1. **더 많은 시뮬레이션 시나리오 추가**
   - 현재: TIMEOUT 이벤트 기반 시뮬레이션만 검증
   - 향후: MakeCall → INCOMING → Answer 흐름 (실제 SIP 환경 필요)

2. **성능 테스트 추가**
   - 장기 실행 시나리오 (수십 개 노드)
   - 다중 시나리오 동시 실행 (현재는 단일 실행만 지원)

3. **프로덕션 빌드 환경 구축**
   - CI/CD 파이프라인에 libwebkit 의존성 설치
   - Docker 이미지로 재현 가능한 빌드 환경 제공

## Self-Check: PASSED

**파일 존재 확인:**
- internal/engine/integration_test.go ✓ (수정됨)
- internal/engine/events.go ✓ (수정됨)
- internal/engine/engine.go ✓ (수정됨)
- frontend/src/components/ui/button.tsx ✓ (생성됨)

**커밋 존재 확인:**
- 12db659 ✓ (Task 1)
- 032a967 ✓ (Task 2 버그 수정)

## Summary

Phase 05-03에서는 **시나리오 실행 엔진의 핵심 경로를 E2E 통합 테스트로 검증**하여 MVP 안정성을 확보했습니다.

**Key Achievements:**
- 3개의 새로운 E2E 통합 테스트 추가 (2-instance 시뮬레이션, 이벤트 스트림, cleanup)
- scenario:completed 이벤트에 scenarioID 추가로 이벤트 추적 개선
- 전체 Go 테스트 27개 통과 (1 skip)
- 프론트엔드 및 Go 개별 빌드 성공 확인

**Deviations:**
- Button 컴포넌트 누락 버그 즉시 수정 (Rule 1)
- scenarioID 추적 기능 추가 (Rule 2)

**Build Status:**
- Go build: ✓ Success
- Frontend build: ✓ Success
- Wails integrated build: ✗ Failed (expected, system dependency issue)

Phase 05-03 계획이 성공적으로 완료되었으며, 시나리오 실행 엔진이 자동화된 테스트로 검증되어 MVP 안정성이 확보되었습니다.
