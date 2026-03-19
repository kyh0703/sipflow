# v1.4 Phase 19 Performance-Ready Baseline

**Status:** Active baseline artifact for `READY-03`

## Scope

이 문서는 아직 benchmark를 만들지 않고도, 나중에 performance profiling으로 전환할 수 있게 하는 baseline을 고정한다. 핵심은 두 가지다.

1. 어떤 scenario / command set을 반복 실행 기준으로 사용할 것인가
2. ActionLog / SIP log에서 어떤 필드로 성공, 실패, cleanup, 지연을 판독할 것인가

`READY-03`의 직접 대상은 다음 필드다.

- `nodeId`
- `instanceId`
- `timestamp`
- `callId`

Phase 19에서는 여기에 `note`를 함께 취급한다. `note`는 Hold/Retrieve SDP direction 같은 future latency classification에 의미가 있는 추가 문맥이기 때문이다.

## Source Of Truth

- [v1.4 requirements](../../../product-specs/active/v1.4-core-call-stability.md)
- [Phase 17 regression matrix](./regression-matrix.md)
- [Phase 18 verification hardening](./verification-hardening.md)
- [project state](../../../project/state.md)
- [project roadmap](../../../project/roadmap.md)

## Baseline Scenario Set

Phase 19 baseline은 새로운 시나리오를 만들지 않는다. Phase 17에서 고정한 must-have set을 Phase 18의 exact proof command 위에 그대로 재사용한다.

### Functional Baseline Scenarios

- `CORE-01` outbound basic call
- `CORE-02` inbound basic call
- `CORE-03` hold / retrieve
- `CORE-04` blind transfer
- `CORE-05` mute transfer

### Runtime Safety Baseline

- cleanup completion
- restart after cleanup
- concurrent start prevention

### Why This Set

- 이미 functional correctness proof가 Phase 18에서 정리되어 있다.
- future performance work는 새로운 correctness scope를 여는 대신, 이 반복 실행 세트를 timing / artifact reading 대상으로 삼으면 된다.

## Baseline Command Set

### Engine / Runtime Baseline

```bash
go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID|TestCreateInstances_Basic|TestManagedInstance_IncomingQueueFIFO|TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification|TestIntegration_EventStreamVerification|TestSupportedCommands|TestSupportedEvents|TestWithSIPMessage_Note|TestWithSIPMessage_NoNote|TestWithSIPMessage_EmptyNote|TestWithCallID'
```

Use this when:

- checking repeatability before future performance runs
- verifying log field propagation
- confirming cleanup/restart safety is still intact

### Contract / Build Baseline

```bash
go test ./internal/binding/... ./internal/pkg/eventhandler/...
npm --prefix frontend run build
```

Use this when:

- confirming backend/frontend event shape stayed compatible
- confirming log-surface type changes still ship cleanly

## Backend Log Field Matrix

| Surface | Field | Source file | How it is emitted | Baseline meaning |
|---------|-------|-------------|-------------------|------------------|
| `scenario:node-state` | `nodeId` | `internal/engine/events.go` | `emitNodeState()` | node-level execution anchor |
| `scenario:node-state` | `timestamp` | `internal/engine/events.go` | `time.Now().UnixMilli()` | state-transition timestamp |
| `scenario:action-log` | `nodeId` | `internal/engine/events.go` | `emitActionLog()` | log-to-node correlation key |
| `scenario:action-log` | `instanceId` | `internal/engine/events.go` | `emitActionLog()` | lane / UA correlation key |
| `scenario:action-log` | `timestamp` | `internal/engine/events.go` | `emitActionLog()` | log-order / latency anchor |
| `scenario:action-log` | `callId` | `internal/engine/events.go`, `internal/engine/executor.go` | `WithCallID(callIDOrDefault(node))` via `emitNodeActionLog()` | logical dialog correlation key |
| `scenario:action-log.sipMessage` | `callId` | `internal/engine/events.go`, `internal/engine/executor.go` | `WithCallID()` fills blank SIP callId with logical callId fallback | SIP-log correlation fallback |
| `scenario:action-log.sipMessage` | `note` | `internal/engine/events.go`, `internal/engine/executor.go` | `WithSIPMessage(..., note)` | extra protocol context such as SDP direction |

## Frontend Field Preservation Matrix

| Surface | File | Fields preserved | Notes |
|---------|------|------------------|-------|
| execution event types | `frontend/src/features/execution/types/execution.ts` | `nodeId`, `instanceId`, `timestamp`, top-level `callId`, nested `sipMessage.callId`, `sipMessage.note` | Type layer now models Phase 19 analysis fields |
| execution store | `frontend/src/features/execution/store/execution-store.ts` | top-level `callId`, nested `sipMessage.callId`, nested `sipMessage.note` | store also backfills `sipMessage.callId` from top-level `callId` |
| execution log UI | `frontend/src/features/execution/components/execution-log.tsx` | visible: `timestamp`, `instanceId`, `nodeId`, `callId`, SIP `method`, `responseCode`, `note` | best surface for textual analysis |
| execution timeline UI | `frontend/src/features/execution/components/execution-timeline.tsx` | visible: `timestamp`, SIP `method`, `responseCode`, meta string (`callId`, `note`) | compact protocol-oriented surface |
| canvas animation trigger | `frontend/src/features/scenario/builder/components/canvas.tsx` | `sipMessage.method`, `timestamp`, `nodeId` | animation is informative, not analysis-complete |

## Interpretation Rules

### Success Anchors

- scenario-level success:
  - `scenario:completed`
- node-level success:
  - `scenario:node-state` where `newState == completed`
- cleanup success:
  - action log `"Starting cleanup"` followed by `"Cleanup completed"`

### Failure Anchors

- scenario-level failure:
  - `scenario:failed`
- node-level failure:
  - `scenario:node-state` where `newState == failed`
- contract/build failure:
  - non-zero exit in baseline command set

### Latency Anchors

Use these timestamps for future elapsed-time comparisons:

- scenario start:
  - `scenario:started.timestamp`
- first node start:
  - first `scenario:node-state` transition to `running`
- cleanup window:
  - `"Starting cleanup"` action log timestamp to `"Cleanup completed"` action log timestamp
- per-message sequencing:
  - `scenario:action-log.timestamp`

### Correlation Keys

- `nodeId`: same logical graph node across runs
- `instanceId`: same execution lane / SIP instance across runs
- `callId`: same logical dialog across node/action/SIP surfaces

`callId` in this baseline is the logical call identifier, not necessarily raw SIP `Call-ID` from the wire. That distinction is intentional because v1.4 regression scope is centered on scenario/dialog addressing semantics.

## What Phase 19 Hardened

### 1. Logical Call ID Propagation For Node Logs

- backend `emitNodeActionLog()` appends `WithCallID(callIDOrDefault(node))`
- top-level ActionLog now carries `callId`
- nested `sipMessage.callId` gets the same value as fallback when the call site has no raw SIP Call-ID

This closes the biggest `READY-03` gap in the current codebase: many `WithSIPMessage()` call sites used empty `callId`.

### 2. Frontend Type And Store Preservation For Analysis Fields

- frontend execution types now model:
  - top-level `callId`
  - nested `sipMessage.note`
- execution store preserves both and backfills `sipMessage.callId` from the top-level value

This prevents Phase 19 fields from being lost between Wails event payload and UI/store state.

### 3. Analysis-Visible Rendering

- execution log now renders:
  - `instanceId`
  - `nodeId`
  - top-level `callId`
  - SIP direction / method / response code
  - SIP `note`
- execution timeline now renders compact meta text for:
  - `callId`
  - `note`

This is not a visualization redesign. It is only enough exposure to make field presence auditable.

## Stored Vs Rendered

### Stored And Rendered Now

- `timestamp`
- `instanceId`
- `nodeId`
- logical `callId`
- SIP `method`
- SIP `responseCode`
- SIP `note`

### Stored But Still Not A Full Analysis Surface

- actual raw SIP `Call-ID` is not guaranteed on every `WithSIPMessage()` call site
- execution timeline still uses simplified lane routing logic

## Deferred Work

- real benchmark orchestration
- raw SIP wire-level `Call-ID` extraction everywhere it is technically available
- dedicated performance dashboard or artifact export
- richer live-mode load validation for multi-dialog / multi-INVITE conditions

## Exit Condition For Phase 19

- `READY-03` field matrix is explicit and verified
- repeatable baseline command set is frozen
- project docs can describe v1.4 as close-ready
