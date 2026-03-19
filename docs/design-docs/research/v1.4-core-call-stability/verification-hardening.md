# v1.4 Phase 18 Verification Hardening

**Status:** Active proof map for Phase 18

## Scope

이 문서는 Phase 17 회귀 시나리오 baseline을 실제 검증 명령과 연결하는 proof map이다. 목표는 `DIALOG-03`, `DIALOG-04`, `UX-01`, `UX-02`, `UX-03`, `READY-01`, `READY-02`, `READY-04`를 "어떤 파일과 어떤 명령으로 검증하는가" 수준까지 고정하는 것이다.

Phase 17이 시나리오와 실패 신호를 정의했다면, 이 문서는 다음을 고정한다.

1. exact command
2. exact proof file
3. machine-verdict pass signal
4. 현재 proof가 직접적인지, 보강 후 닫혔는지

## Source Of Truth

- [v1.4 requirements](../../../product-specs/active/v1.4-core-call-stability.md)
- [Phase 17 regression matrix](./regression-matrix.md)
- [Phase 19 performance-ready baseline](./performance-ready-baseline.md)
- [project state](../../../project/state.md)
- [project roadmap](../../../project/roadmap.md)

## Requirement-To-Proof Map

| Requirement | Exact proof surface | Exact files | Exact command | Machine-verdict pass signal | Proof status |
|-------------|---------------------|-------------|---------------|-----------------------------|--------------|
| `DIALOG-03` | parser default + backward compatibility parse | `internal/engine/graph.go`, `internal/engine/graph_test.go` | `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID'` | tests pass and prove omitted `callId` falls back to `call-1` while explicit `callId` is preserved | direct |
| `DIALOG-04` | incoming queue buffer + FIFO queue proof | `internal/engine/instance_manager.go`, `internal/engine/instance_manager_test.go` | `go test ./internal/engine/... -run 'TestCreateInstances_Basic|TestManagedInstance_IncomingQueueFIFO'` | buffer capacity stays `4` and queued dialogs are received in insertion order | hardened in Phase 18 |
| `UX-01` | backend-supported names, binding export, frontend type/palette lists, DEV contract check | `internal/engine/types.go`, `internal/engine/types_test.go`, `internal/binding/engine_binding.go`, `frontend/src/features/scenario/builder/types/scenario.ts`, `frontend/src/features/scenario/builder/lib/backend-contract.ts`, `frontend/src/features/scenario/builder/components/node-palette.tsx`, `frontend/src/features/scenario/builder/components/scenario-builder.tsx` | `go test ./internal/engine/... -run 'TestSupportedCommands|TestSupportedEvents'` and `npm --prefix frontend run build` | backend command/event list tests pass; frontend build succeeds with the same command/event names wired into palette and DEV contract validator | mixed static + runtime contract check |
| `UX-02` | pre-flight validation rules + matching properties inputs | `frontend/src/features/scenario/builder/lib/validation.ts`, `frontend/src/features/scenario/builder/lib/validation.test.ts`, `frontend/src/features/scenario/builder/components/properties/command-properties.tsx`, `frontend/src/features/scenario/builder/components/properties/event-properties.tsx` | `npm --prefix frontend exec vitest run src/features/scenario/builder/lib/validation.test.ts` and `npm --prefix frontend run build` | vitest passes, including `MuteTransfer.primaryCallId` and `consultCallId` required-field checks; build remains green | hardened in Phase 18 |
| `UX-03` | repository save/load persistence + parser field preservation + UI-visible field rendering | `internal/scenario/repository_test.go`, `internal/engine/graph.go`, `internal/engine/graph_test.go`, `frontend/src/features/scenario/builder/types/scenario.ts`, `frontend/src/features/scenario/builder/components/nodes/command-node.tsx`, `frontend/src/features/scenario/builder/components/nodes/event-node.tsx`, `frontend/src/features/scenario/builder/hooks/use-flow-editor-controller.ts` | `go test ./internal/scenario/... -run 'TestSaveAndLoadScenario'` and `go test ./internal/engine/... -run 'TestParseScenario_BlindTransferFields|TestParseScenario_MuteTransferFields|TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID'` and `npm --prefix frontend run build` | repository round-trip passes, parser field tests pass, and build confirms UI still accepts/render these fields | direct |
| `READY-01` | repeatable baseline command set | `internal/engine/integration_test.go`, `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md` | `go test ./internal/engine/... -run 'TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification'` and `go test ./internal/binding/... ./internal/pkg/eventhandler/...` and `npm --prefix frontend run build` | the same command set can be re-run without fixture edits and without manual PBX setup | hardened in Phase 18 |
| `READY-02` | machine-verdict signals for success/failure/cleanup | `internal/engine/integration_test.go`, `internal/engine/engine.go` | `go test ./internal/engine/... -run 'TestIntegration_StopScenario|TestIntegration_CleanupVerification'` | tests assert `scenario:stopped`, `scenario:completed`, `"Starting cleanup"`, `"Cleanup completed"`, and runtime non-running state | direct |
| `READY-04` | start/stop/cleanup/restart/concurrent-start safety | `internal/engine/integration_test.go` | `go test ./internal/engine/... -run 'TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification'` | stop succeeds, second start returns `"scenario already running"`, cleanup completes, and restart succeeds | direct after test-fixture hardening |

## Phase 18 Hardening Added Here

### 1. Runtime Test Fixture Normalization

`internal/engine/integration_test.go`의 `buildTestFlowData()`는 integration fixture에서 `sipInstance.register`가 빠진 경우 `false`를 주입한다.

이유:

- parser default는 `register=true`라서 local test scenario가 의도치 않게 PBX registration을 시도했다.
- Phase 18 runtime baseline은 local repeatability가 핵심이므로, integration fixture는 명시적으로 non-PBX semantics를 가져야 한다.

이 변경 덕분에 `READY-01`, `READY-02`, `READY-04` proof command가 PBX host 설정 없이 반복 실행 가능해진다.

### 2. FIFO Queue Proof For Incoming Dialogs

`internal/engine/instance_manager_test.go`에 `TestManagedInstance_IncomingQueueFIFO`를 추가했다.

이 테스트는 다음을 직접 증명한다.

- `incomingCh`는 buffered queue로 사용된다.
- same-instance multi incoming dialog는 insertion order대로 dequeue 된다.

이는 `TestCreateInstances_Basic`의 buffer-capacity 검증과 함께 `DIALOG-04`의 queue-level proof가 된다.

### 3. MuteTransfer Validation Hardening

`frontend/src/features/scenario/builder/lib/validation.ts`는 이제 `MuteTransfer`에서 `primaryCallId`와 `consultCallId`를 모두 required field로 본다.

이유:

- properties panel은 두 필드를 모두 요구한다.
- engine path도 두 dialog reference를 모두 전제로 한다.
- Phase 18의 `UX-02`는 "필수 입력 누락이 사전 validation에서 드러나는가"를 묻기 때문에 `consultCallId`만 검사하는 상태는 불완전했다.

`frontend/src/features/scenario/builder/lib/validation.test.ts`는 이 hardening을 직접 검증한다.

## Repeatable Baseline Command Set

Phase 18에서 고정할 기본 command set은 아래와 같다.

### Engine / Runtime

```bash
go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID|TestCreateInstances_Basic|TestManagedInstance_IncomingQueueFIFO|TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification|TestSupportedCommands|TestSupportedEvents'
```

Pass signal:

- all tests return `ok`
- cleanup path emits `"Starting cleanup"` and `"Cleanup completed"`
- second `StartScenario` returns `"scenario already running"`

### Binding / Event Contract

```bash
go test ./internal/binding/... ./internal/pkg/eventhandler/...
```

Pass signal:

- `ok` on binding package
- no binding/eventhandler regressions introduced by Phase 18 hardening

### Scenario Persistence

```bash
go test ./internal/scenario/... -run 'TestSaveAndLoadScenario'
```

Pass signal:

- saved `flow_data` round-trips exactly through repository save/load

### Frontend Validation

```bash
npm --prefix frontend exec vitest run src/features/scenario/builder/lib/validation.test.ts
```

Pass signal:

- vitest reports both tests passing
- `MuteTransfer.primaryCallId` missing case is rejected before execution

### Frontend Build Contract

```bash
npm --prefix frontend run build
```

Pass signal:

- TypeScript compile succeeds
- Vite production build completes

## Requirement Notes

### `DIALOG-03`

- direct parser proof exists today
- this requirement is no longer only historical compatibility text; it has exact tests and exact default behavior source

### `DIALOG-04`

- current proof is queue-level, not full live SIP concurrency simulation
- for the current engine architecture, that is the narrowest reliable machine proof because `Serve()` hands incoming dialogs straight into `incomingCh`

### `UX-01`

- proof is intentionally split between:
  - backend list tests
  - frontend static lists/palette wiring
  - DEV-time runtime contract check in `ScenarioBuilder`

### `UX-03`

- persistence proof is a composition of:
  - repository round-trip (`SaveScenario` / `LoadScenario`)
  - parser field preservation for `callId`, `targetUser`, `targetHost`, `primaryCallId`, `consultCallId`
  - frontend save/load path through `toFlowJSON()` and `LoadScenario()`

## Manual-Only Or Deferred Surfaces

- real SIP live-mode verification is still outside this document's machine-verdict scope
- `READY-03` performance/log-analysis baseline remains Phase 19 work

Phase 19 handoff artifact: [performance-ready-baseline.md](./performance-ready-baseline.md)

## Exit Condition For Phase 18

- all eight Phase 18 requirement IDs are mapped to exact proof
- the repeatable baseline command set is executable without ad hoc fixture edits
- project source-of-truth docs can safely advance from Phase 18 to Phase 19
