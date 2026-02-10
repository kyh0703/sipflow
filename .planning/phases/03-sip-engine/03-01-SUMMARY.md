---
phase: "03"
plan: "03-01"
title: "Engine 코어 데이터 구조 + 그래프 파서"
subsystem: "engine"
tags: ["go", "parser", "execution-graph", "event-emitter", "testing"]
requires: ["02-06"]
provides: ["execution-graph", "graph-parser", "engine-skeleton", "event-system"]
affects: ["03-02", "03-03", "03-04"]
tech-stack:
  added: []
  patterns: ["event-emitter-interface", "graph-parsing", "pointer-chaining"]
key-files:
  created:
    - "internal/engine/graph.go"
    - "internal/engine/engine.go"
    - "internal/engine/events.go"
    - "internal/engine/graph_test.go"
  modified: []
decisions:
  - "EventEmitter 인터페이스로 테스트 가능한 이벤트 시스템 구축"
  - "SetContext 시 WailsEventEmitter 자동 설정, SetEventEmitter로 테스트용 주입 가능"
  - "그래프 파싱 시 인스턴스별 StartNodes + SuccessNext/FailureNext 포인터 체인 구축"
  - "기본 타임아웃 10초, 커스텀 타임아웃 지원"
metrics:
  duration: "2 minutes"
  completed: "2026-02-10"
---

# Phase 03 Plan 01: Engine 코어 데이터 구조 + 그래프 파서 Summary

**One-line:** ExecutionGraph/GraphNode 타입 정의, FlowData JSON 파서 구현, Engine 골격 및 EventEmitter 추상화로 SIP 시나리오 실행 엔진 기반 구축

## Task Results

| Task | Name | Status | Commit | Files |
|------|------|--------|--------|-------|
| 1 | ExecutionGraph 및 GraphNode 데이터 구조 정의 | completed | e85bf12 | internal/engine/graph.go |
| 2 | ParseScenario 그래프 파서 구현 | completed | e85bf12 | internal/engine/graph.go |
| 3 | Engine 타입 골격 + EventEmitter 추상화 + 이벤트 발행 헬퍼 | completed | 312c962 | internal/engine/engine.go, internal/engine/events.go |
| 4 | ParseScenario 단위 테스트 | completed | fa2c4ef | internal/engine/graph_test.go |

## What We Built

### 1. 그래프 데이터 구조 (`graph.go`)

**FlowData 파싱 타입:**
- `FlowData`, `FlowNode`, `FlowEdge` — 프론트엔드 JSON 구조 매핑

**실행 그래프 타입:**
- `GraphNode` — command/event 노드, SuccessNext/FailureNext 포인터 체인, 타임아웃
- `SipInstanceConfig` — SIP 인스턴스 설정 (DN, 등록 여부, 모드)
- `InstanceChain` — 인스턴스별 StartNodes 체인
- `ExecutionGraph` — 전체 그래프 (Instances 맵 + Nodes 맵)

### 2. 그래프 파서 (`graph.go`)

**`ParseScenario(flowData string) (*ExecutionGraph, error)` 구현:**
- JSON → FlowData 언마샬
- sipInstance 노드를 SipInstanceConfig로 변환
- command/event 노드를 GraphNode로 변환 (타입 안전 헬퍼 사용)
- 엣지 순회하여 SuccessNext/FailureNext 포인터 설정
- sipInstance → command/event 엣지는 StartNodes 추가
- 검증: 인스턴스 0개, sipInstanceId 누락/불일치 시 에러

**헬퍼 함수:**
- `getStringField`, `getBoolField`, `getFloatField` — map[string]interface{} 안전 추출

### 3. Engine 골격 (`engine.go`)

**`Engine` 구조체:**
- `ctx context.Context` — Wails runtime context
- `repo *scenario.Repository` — 시나리오 로드
- `emitter EventEmitter` — 이벤트 발행 추상화
- `mu sync.Mutex`, `running bool`, `cancelFunc`, `wg` — 동시 실행 제어

**메서드:**
- `NewEngine(repo)` — 생성자, emitter는 nil로 초기화
- `SetContext(ctx)` — **WailsEventEmitter 자동 생성 및 설정**
- `SetEventEmitter(emitter)` — 테스트용 커스텀 emitter 주입
- `StartScenario(scenarioID)`, `StopScenario()` — 스텁 ("not implemented")
- `IsRunning() bool` — 실행 상태 반환

### 4. 이벤트 시스템 (`events.go`)

**EventEmitter 인터페이스:**
```go
type EventEmitter interface {
    Emit(eventName string, data map[string]interface{})
}
```

**WailsEventEmitter 프로덕션 구현:**
- `runtime.EventsEmit(ctx, eventName, data)` 래핑

**이벤트 이름 상수:**
- `EventNodeState`, `EventActionLog`, `EventStarted`, `EventCompleted`, `EventFailed`, `EventStopped`

**노드 상태 상수:**
- `NodeStatePending`, `NodeStateRunning`, `NodeStateCompleted`, `NodeStateFailed`

**이벤트 발행 헬퍼 (Engine 메서드):**
- `emitNodeState(nodeID, prevState, newState)` — 노드 상태 변경
- `emitActionLog(nodeID, instanceID, message, level)` — 액션 로그 (info/warning/error)
- `emitScenarioStarted(scenarioID)`, `emitScenarioCompleted()`, `emitScenarioFailed(errMsg)`, `emitScenarioStopped()` — 시나리오 생명주기 이벤트

모든 이벤트에 `timestamp` (UnixMilli) 포함, emitter nil 시 안전하게 skip.

### 5. 단위 테스트 (`graph_test.go`)

**5개 테스트 케이스:**

1. `TestParseScenario_BasicTwoInstance` — 2개 인스턴스, MakeCall + Incoming + Answer
   - inst-a StartNodes에 cmd-1, inst-b StartNodes에 evt-1
   - evt-1 SuccessNext → cmd-2
   - evt-1 Timeout == 10s (기본값)

2. `TestParseScenario_FailureBranch` — success/failure 분기
   - cmd-1의 SuccessNext와 FailureNext 모두 설정 확인

3. `TestParseScenario_CustomTimeout` — 커스텀 타임아웃
   - timeout: 5000 설정 시 5초로 파싱

4. `TestParseScenario_EmptyFlowData` — 빈 JSON
   - 에러 반환 ("no sipInstance")

5. `TestParseScenario_MissingInstanceId` — sipInstanceId 누락
   - 에러 반환 ("missing sipInstanceId")

**테스트 JSON:** raw string literal로 작성, 프론트엔드 출력 형태와 동일.

## Decisions Made

### 1. EventEmitter 인터페이스 패턴 채택
**컨텍스트:** 이벤트 발행 로직을 테스트 가능하게 만들어야 함.

**결정:** `EventEmitter` 인터페이스 정의, `WailsEventEmitter` 프로덕션 구현, `SetEventEmitter()`로 테스트용 mock 주입 가능.

**이유:**
- Wails `runtime.EventsEmit()` 직접 호출 시 테스트 불가
- 인터페이스 추상화로 의존성 역전
- 프로덕션: SetContext 시 자동 설정, 테스트: SetEventEmitter로 mock 주입

**영향:** 후속 계획(03-02~03-04)에서 Engine 로직 단위 테스트 가능.

### 2. SetContext 시 WailsEventEmitter 자동 설정
**컨텍스트:** Wails 앱에서 Engine 사용 시 매번 SetEventEmitter 호출은 번거로움.

**결정:** `SetContext(ctx)` 메서드에서 `WailsEventEmitter` 자동 생성하여 `e.emitter`에 설정.

**이유:**
- 프로덕션 코드 간소화 (SetContext만 호출하면 이벤트 시스템 준비 완료)
- 테스트에서는 SetEventEmitter로 여전히 재정의 가능

**트레이드오프:** SetContext가 emitter 생성까지 책임지지만, 프로덕션 편의성 우선.

### 3. 그래프 포인터 체인 구조 채택
**컨텍스트:** 엣지 정보를 어떻게 실행 시점에 활용할 것인가.

**결정:** `SuccessNext`/`FailureNext` 포인터로 다음 노드를 직접 가리키는 체인 구조.

**이유:**
- 실행 시 엣지 맵을 다시 조회할 필요 없음 (O(1) 접근)
- DAG 구조에 적합 (순환 불가)
- 분기 로직(success/failure) 명확

**대안:** 엣지 맵을 별도로 유지하고 실행 시 조회 → 성능 저하.

### 4. 기본 타임아웃 10초, 커스텀 지원
**컨텍스트:** event 노드는 SIP 이벤트 대기 시 타임아웃 필요.

**결정:** 기본 10초, JSON에 `timeout` (밀리초) 지정 시 커스텀 적용.

**이유:**
- SIP INVITE → INCOMING 일반적으로 수 초 내 발생
- 10초는 네트워크 지연 고려한 안전 마진
- 사용자가 시나리오별로 조정 가능

**영향:** 프론트엔드에서 event 노드에 timeout 속성 추가 필요 (Phase 03 후속 계획).

## Verification

### Build & Vet
```bash
$ go build ./internal/engine/...
# Success

$ go vet ./internal/engine/...
# No warnings
```

### Tests
```bash
$ go test ./internal/engine/... -v
=== RUN   TestParseScenario_BasicTwoInstance
--- PASS: TestParseScenario_BasicTwoInstance (0.00s)
=== RUN   TestParseScenario_FailureBranch
--- PASS: TestParseScenario_FailureBranch (0.00s)
=== RUN   TestParseScenario_CustomTimeout
--- PASS: TestParseScenario_CustomTimeout (0.00s)
=== RUN   TestParseScenario_EmptyFlowData
--- PASS: TestParseScenario_EmptyFlowData (0.00s)
=== RUN   TestParseScenario_MissingInstanceId
--- PASS: TestParseScenario_MissingInstanceId (0.00s)
PASS
ok      sipflow/internal/engine 0.002s
```

**모든 검증 통과:**
- ✅ 5개 테스트 모두 통과
- ✅ 컴파일 에러 없음
- ✅ vet 경고 없음

### File Structure
```
internal/engine/
├── graph.go          (데이터 구조 + 파서)
├── engine.go         (Engine 골격)
├── events.go         (EventEmitter + 이벤트 헬퍼)
└── graph_test.go     (ParseScenario 단위 테스트)
```

## Deviations from Plan

없음 - 계획이 작성된 대로 정확히 실행됨.

## Next Phase Readiness

**03-02 (SIP Instance 생성 및 등록 로직) 준비 완료:**
- ✅ ExecutionGraph 구조 준비됨 → 인스턴스별 체인 순회 가능
- ✅ SipInstanceConfig 타입 정의됨 → diago.Diago 생성 시 사용
- ✅ EventEmitter 추상화 완료 → 등록 상태 이벤트 발행 가능

**차단 요소:** 없음.

**권장 사항:** 03-02에서 diago 라이브러리 통합 시 SipInstanceConfig의 Mode(DN/Endpoint) 필드를 diago 설정으로 정확히 매핑 필요.

## Self-Check: PASSED

**생성된 파일 검증:**
```bash
$ ls -1 internal/engine/
engine.go
events.go
graph.go
graph_test.go
```
✅ 모든 파일 존재 확인

**커밋 검증:**
```bash
$ git log --oneline -3
fa2c4ef test(03-01): add ParseScenario unit tests
312c962 feat(03-01): implement Engine type with EventEmitter abstraction
e85bf12 feat(03-01): define ExecutionGraph and GraphNode data structures
```
✅ 모든 커밋 존재 확인
