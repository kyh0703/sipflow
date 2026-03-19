# Phase 18 Regression Verification Hardening Execution Plan

**Goal**
Phase 17에서 고정한 회귀 시나리오 baseline을 현재 코드베이스의 실제 검증면과 정확히 연결한다. `DIALOG-03`, `DIALOG-04`, `UX-01`, `UX-02`, `UX-03`, `READY-01`, `READY-02`, `READY-04`를 exact command, exact test target, exact contract checkpoint 기준으로 문서화하고, 근거가 비어 있는 곳은 최소 hardening으로 메운다.

**References**
- `docs/AGENTS.md`
- `docs/PLANS.md`
- `docs/project/state.md`
- `docs/project/overview.md`
- `docs/project/roadmap.md`
- `docs/ARCHITECTURE.md`
- `docs/product-specs/active/v1.4-core-call-stability.md`
- `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
- `docs/exec-plans/completed/2026-03-19-phase17-core-call-regression-matrix.md`

**Milestone Scope**
- In:
  - Phase 17 scenario baseline을 exact verification command와 연결
  - `DIALOG-03`, `DIALOG-04`, `UX-01`, `UX-02`, `UX-03`, `READY-01`, `READY-02`, `READY-04`의 증거 문서화
  - cleanup / restart / concurrent start prevention / backend contract / frontend validation / save-load persistence 체크포인트 고정
  - evidence gap이 있으면 최소 test 또는 계약 보강으로 Phase 18 close-ready 상태 확보
- Out:
  - 신규 기능 추가
  - 성능 분석용 로그 체계 확대 (`READY-03`, Phase 19 범위)
  - 대형 구조 리팩토링

**Success Criteria**
- Phase 18 산출물 문서가 각 requirement ID를 exact file, exact command, exact pass/fail signal로 매핑한다.
- 반복 실행 가능한 baseline command set이 `READY-01`, `READY-02`, `READY-04` 관점에서 정리된다.
- `DIALOG-03` 하위 호환성과 `DIALOG-04` 수신 처리 근거가 "existing proof" 또는 "minimal hardening 후 proof" 중 하나로 닫힌다.
- `UX-01`, `UX-02`, `UX-03`이 backend contract, palette/properties/validation, scenario persistence 기준으로 연결된다.
- Phase 18 완료 시 상태 문서가 다음 단계(Phase 19)로 정렬된다.

## Planned Files
- Create:
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `frontend/src/features/scenario/builder/lib/validation.test.ts`
  - `docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
- Modify:
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `internal/engine/integration_test.go`
  - `internal/engine/instance_manager_test.go`
  - `frontend/src/features/scenario/builder/lib/validation.ts`
  - `docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
- Read:
  - `docs/product-specs/active/v1.4-core-call-stability.md`
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/roadmap.md`
  - `docs/ARCHITECTURE.md`
  - `internal/engine/graph.go`
  - `internal/engine/graph_test.go`
  - `internal/engine/integration_test.go`
  - `internal/engine/instance_manager.go`
  - `internal/engine/instance_manager_test.go`
  - `internal/engine/types.go`
  - `internal/engine/types_test.go`
  - `internal/scenario/repository_test.go`
  - `internal/binding/engine_binding.go`
  - `internal/pkg/eventhandler/types.go`
  - `frontend/src/features/scenario/builder/types/scenario.ts`
  - `frontend/src/features/scenario/builder/lib/backend-contract.ts`
  - `frontend/src/features/scenario/builder/lib/validation.ts`
  - `frontend/src/features/scenario/builder/components/node-palette.tsx`
  - `frontend/src/features/scenario/builder/components/properties/command-properties.tsx`
  - `frontend/src/features/scenario/builder/components/properties/event-properties.tsx`
- Test:
  - `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID|TestParseScenario_BlindTransferFields|TestParseScenario_MuteTransferFields|TestCreateInstances_Basic|TestManagedInstance_IncomingQueueFIFO|TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification|TestSupportedCommands|TestSupportedEvents'`
  - `go test ./internal/scenario/... -run 'TestSaveAndLoadScenario'`
  - `go test ./internal/binding/... ./internal/pkg/eventhandler/...`
  - `npm --prefix frontend exec vitest run src/features/scenario/builder/lib/validation.test.ts`
  - `npm --prefix frontend run build`
  - `rg -n "DIALOG-03|DIALOG-04|UX-01|UX-02|UX-03|READY-01|READY-02|READY-04" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|manual|cleanup|StartScenario|StopScenario" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `git diff -- docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md internal/engine/integration_test.go internal/engine/instance_manager_test.go frontend/src/features/scenario/builder/lib/validation.ts frontend/src/features/scenario/builder/lib/validation.test.ts docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
- Docs to update:
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `frontend/src/features/scenario/builder/lib/validation.test.ts`
  - `docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
  - `docs/exec-plans/completed/2026-03-19-phase18-regression-verification-hardening.md` (Phase 18 종료 시 이동)

## Task 1: Create Exact Verification Map From The Phase 17 Baseline
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Phase 17 regression matrix가 source-of-truth 상태여야 한다.
- v1.4 requirement IDs와 roadmap 성공 기준을 다시 읽은 상태여야 한다.
**Exit criteria:**
- 새 verification-hardening 문서가 생성된다.
- 각 Phase 18 requirement ID가 scenario cluster, file path, command, proof type으로 매핑된다.

- [ ] Re-read the v1.4 requirements and Phase 17 regression matrix, then extract the exact Phase 18 requirement set and the existing verification surfaces already named there.
  - Files:
    - `docs/product-specs/active/v1.4-core-call-stability.md`
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
    - `docs/project/roadmap.md`
  - Run:
    - `sed -n '1,260p' docs/product-specs/active/v1.4-core-call-stability.md`
    - `sed -n '1,220p' docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
    - `sed -n '138,190p' docs/project/roadmap.md`
  - Expected:
    - The implementer has the exact wording for `DIALOG-03`, `DIALOG-04`, `UX-01`, `UX-02`, `UX-03`, `READY-01`, `READY-02`, and `READY-04`.
  - Commit intent:
    - none
  - Verification result:
    - 완료. 요구사항 8개와 Phase 17 handoff surface를 product spec, regression matrix, roadmap에서 다시 고정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - scenario cluster naming must stay aligned with Phase 17 matrix wording.
- [ ] Create `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md` with sections for requirement mapping, exact commands, machine-verdict signals, and known manual-only surfaces.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `test -f docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected:
    - The new file exists and starts with Phase 18 scope, references, and a requirement-to-proof table.
  - Commit intent:
    - create the primary Phase 18 artifact document
  - Verification result:
    - 완료. `verification-hardening.md`를 생성했고 requirement-to-proof map, baseline command set, hardening notes를 포함했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - this doc is the main Phase 18 deliverable.
- [ ] Map `CORE-*`, failure matrix, and follow-up requirements to exact proof types: existing Go test, existing build check, manual/live check, or gap requiring hardening.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05|DIALOG-03|DIALOG-04|UX-01|UX-02|UX-03|READY-01|READY-02|READY-04" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected:
    - Every Phase 18 requirement ID appears at least once with an exact verification surface or a clearly named gap.
  - Commit intent:
    - lock the Phase 18 requirement map to runnable surfaces
  - Verification result:
    - 완료. `DIALOG-03`, `DIALOG-04`, `UX-01`, `UX-02`, `UX-03`, `READY-01`, `READY-02`, `READY-04`가 모두 exact file/command/pass signal로 매핑됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - do not leave any requirement implied.

## Task 2: Lock Down Backward Compatibility, Incoming Handling, And Runtime Safety Proofs
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 requirement map exists.
- engine/runtime proof files have been identified.
**Exit criteria:**
- `DIALOG-03`, `DIALOG-04`, `READY-01`, `READY-02`, and `READY-04` have exact proof or an explicit minimal hardening task.
- baseline command set is repeatable and recorded.

- [ ] Audit current proof for `DIALOG-03` by tracing default `callId` behavior from parser code to existing backward-compatibility tests.
  - Files:
    - `internal/engine/graph.go`
    - `internal/engine/graph_test.go`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "defaultCallID|call-1|getStringField\\(node.Data, \"callId\"" internal/engine/graph.go internal/engine/graph_test.go`
    - `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility'`
  - Expected:
    - The doc can point to exact parser behavior and at least one passing backward-compatibility test command.
  - Commit intent:
    - capture or tighten proof for legacy scenario compatibility
  - Verification result:
    - 완료. `graph.go`의 `defaultCallID`, `TestParseScenario_V1_1_BackwardCompatibility`, `TestParseScenario_DefaultCallID`, `TestParseScenario_CustomCallID`를 exact proof로 연결했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - 추가 code change 없이 direct proof로 닫혔다.
- [ ] Audit current proof for `DIALOG-04` and decide whether the existing incoming buffer/runtime tests are sufficient to claim FIFO handling.
  - Files:
    - `internal/engine/integration_test.go`
    - `internal/engine/instance_manager.go`
    - `internal/engine/instance_manager_test.go`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "incomingCh|INCOMING|FIFO|buffer|Concurrent" internal/engine/integration_test.go internal/engine/instance_manager.go internal/engine/instance_manager_test.go`
    - `go test ./internal/engine/... -run 'TestIntegration_ConcurrentStartPrevention|TestIntegration_StopScenario|TestIntegration_CleanupVerification'`
  - Expected:
    - The implementer can either cite exact FIFO/incoming proof or name one minimal missing test that must be added before claiming `DIALOG-04`.
  - Commit intent:
    - close the incoming-handling evidence gap with the lightest possible change
  - Verification result:
    - 완료. `instance_manager.go` queue path를 읽고 `TestManagedInstance_IncomingQueueFIFO`를 추가해 FIFO dequeue order를 직접 증명했다. `TestCreateInstances_Basic`는 buffer cap `4`를 유지함을 확인한다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - broad SIP concurrency test 대신 queue-level proof로 닫았다.
- [ ] Build the repeatable Phase 18 baseline command set for `READY-01`, `READY-02`, and `READY-04`, including pass/fail signals for cleanup, restart, and concurrent-start prevention.
  - Files:
    - `internal/engine/integration_test.go`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "StartScenario|StopScenario|cleanup|already running|Starting cleanup" internal/engine/integration_test.go internal/engine/engine.go`
    - `go test ./internal/engine/... -run 'TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification'`
  - Expected:
    - The doc records exact commands, expected success strings or log signals, and what counts as a machine-verdict failure.
  - Commit intent:
    - turn runtime safety checks into a repeatable regression baseline
  - Verification result:
    - 완료. `buildTestFlowData()`에서 integration fixture의 `register=false`를 기본화해 local runtime tests가 PBX host 없이 반복 실행되도록 정리했고, stop/restart/concurrent-start proof command를 문서에 고정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - this is the core of `READY-01`, `READY-02`, and `READY-04`.

## Task 3: Harden Contract, Validation, And Persistence Coverage
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 mapping doc exists.
- frontend/backend contract files are identified.
**Exit criteria:**
- `UX-01`, `UX-02`, `UX-03` each have exact proof paths.
- contract or validation gaps are either fixed minimally or explicitly recorded as blockers.

- [ ] Audit backend/frontend command-event contract alignment for `UX-01`.
  - Files:
    - `internal/engine/types.go`
    - `internal/engine/types_test.go`
    - `internal/binding/engine_binding.go`
    - `frontend/src/features/scenario/builder/types/scenario.ts`
    - `frontend/src/features/scenario/builder/lib/backend-contract.ts`
    - `frontend/src/features/scenario/builder/components/node-palette.tsx`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `go test ./internal/engine/... -run 'TestSupportedCommands|TestSupportedEvents'`
    - `rg -n "COMMAND_TYPES|EVENT_TYPES|GetSupportedCommands|GetSupportedEvents|command-|event-" internal/engine/types.go internal/engine/types_test.go internal/binding/engine_binding.go frontend/src/features/scenario/builder/types/scenario.ts frontend/src/features/scenario/builder/lib/backend-contract.ts frontend/src/features/scenario/builder/components/node-palette.tsx`
  - Expected:
    - The doc can point to exact backend support lists, frontend type lists, and runtime contract validation entrypoints.
  - Commit intent:
    - lock backend/frontend contract evidence and patch only if mismatch is real
  - Verification result:
    - 완료. `types.go`/`types_test.go`, `engine_binding.go`, frontend `scenario.ts`, `backend-contract.ts`, `node-palette.tsx`, `scenario-builder.tsx`를 근거로 `UX-01` proof를 문서화했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - 실제 mismatch는 발견되지 않았다.
- [ ] Audit required-field validation and properties coverage for `UX-02`.
  - Files:
    - `frontend/src/features/scenario/builder/lib/validation.ts`
    - `frontend/src/features/scenario/builder/components/properties/command-properties.tsx`
    - `frontend/src/features/scenario/builder/components/properties/event-properties.tsx`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "required-field|MakeCall|BlindTransfer|MuteTransfer|INCOMING|TIMEOUT|DTMFReceived|consultCallId|targetUser|targetHost" frontend/src/features/scenario/builder/lib/validation.ts frontend/src/features/scenario/builder/components/properties/command-properties.tsx frontend/src/features/scenario/builder/components/properties/event-properties.tsx`
    - `npm --prefix frontend run build`
  - Expected:
    - The doc records which required fields are caught pre-flight and which node/property panels expose the same inputs.
  - Commit intent:
    - close validation-vs-properties mismatches with the smallest possible edit
  - Verification result:
    - 완료. `MuteTransfer.primaryCallId` 누락이 validation에서 빠져 있던 gap을 수정했고, `validation.test.ts`로 `primaryCallId`/`consultCallId` required-field proof를 추가했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - narrow frontend validation change만 적용했다.
- [ ] Audit save-load persistence and UI-visible field continuity for `UX-03`, then record exact proof or the minimal missing test/document gap.
  - Files:
    - `frontend/src/features/scenario/builder/types/scenario.ts`
    - `frontend/src/features/scenario/builder/components/nodes/command-node.tsx`
    - `frontend/src/features/scenario/builder/components/nodes/event-node.tsx`
    - `internal/engine/graph.go`
    - `internal/engine/graph_test.go`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "callId|primaryCallId|consultCallId|targetUser|targetHost|targetUri|timeout" frontend/src/features/scenario/builder/types/scenario.ts frontend/src/features/scenario/builder/components/nodes/command-node.tsx frontend/src/features/scenario/builder/components/nodes/event-node.tsx internal/engine/graph.go internal/engine/graph_test.go`
    - `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility'`
    - `npm --prefix frontend run build`
  - Expected:
    - The doc can name which fields persist through parse/save/load today and which proof remains indirect or missing.
  - Commit intent:
    - make save-load continuity explicit and reproducible
  - Verification result:
    - 완료. `TestSaveAndLoadScenario`로 repository round-trip, `TestParseScenario_BlindTransferFields`/`TestParseScenario_MuteTransferFields`/`TestParseScenario_DefaultCallID`/`TestParseScenario_CustomCallID`로 parser field preservation, `use-flow-editor-controller.ts`와 node components로 UI-visible continuity를 연결했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - existing repository + parser proofs로 direct evidence를 확보했다.

## Task 4: Update Source-Of-Truth Docs And Prepare Finish Handoff
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Tasks 1~3 evidence is stable.
- any required minimal hardening has already landed and been verified.
**Exit criteria:**
- Phase 18 artifact docs and project status docs all point to the same next step.
- active plan is ready for finish with exact verification evidence.

- [ ] Update the Phase 17 regression matrix so it links to the exact Phase 18 verification-hardening artifact instead of only naming likely surfaces.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "verification-hardening|Phase 18|go test|npm --prefix frontend run build" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected:
    - A reader can move from scenario baseline to exact proof map without guessing.
  - Commit intent:
    - connect Phase 17 baseline and Phase 18 proof artifact
  - Verification result:
    - 완료. `regression-matrix.md` source-of-truth와 handoff 섹션에 `verification-hardening.md` 링크를 추가했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - keep the Phase 17 document short; do not duplicate the entire Phase 18 proof map there.
- [ ] Update `docs/project/state.md`, `docs/project/overview.md`, and `docs/project/roadmap.md` when Phase 18 outputs are complete so they point to Phase 19 as the next milestone.
  - Files:
    - `docs/project/state.md`
    - `docs/project/overview.md`
    - `docs/project/roadmap.md`
  - Run:
    - `rg -n "Phase 18|Phase 19|다음 단계|Next Step|verification-hardening" docs/project/state.md docs/project/overview.md docs/project/roadmap.md`
  - Expected:
    - All project docs reflect the same current phase and next action.
  - Commit intent:
    - keep project-level source-of-truth docs aligned after Phase 18 completion
  - Verification result:
    - 완료. `state.md`, `overview.md`, `roadmap.md`가 모두 Phase 18 완료 -> Phase 19 다음 흐름으로 정렬됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - Phase 18 proof map과 required commands를 먼저 고정한 뒤 상태 문서를 올렸다.
- [ ] Update this active plan with execution status, verification outputs, commit evidence, and finish handoff fields as work lands.
  - Files:
    - `docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
  - Run:
    - `sed -n '1,360p' docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
  - Expected:
    - The active plan remains a living execution record and can be moved to `completed/` by finish without reconstruction.
  - Commit intent:
    - preserve execution history inside the active plan
  - Verification result:
    - 완료. active plan에 실제 verification result와 finish handoff evidence를 기록했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - finish should only move this file after all Phase 18 evidence is rechecked.

## Integration
- Phase 18 mixes docs, Go verification evidence, and frontend contract/validation evidence, so direct execution is preferred over parallel workers.
- Shared source-of-truth docs (`regression-matrix.md`, `state.md`, `overview.md`, `roadmap.md`) should have one owner to avoid contradictory phase status.
- Code/test hardening is conditional and must stay surgical. If a proof gap appears, patch only the narrow file that closes that exact requirement.
- The new Phase 18 artifact document is the central integration surface. All project-doc updates should happen after it stabilizes.

## Execution Progress Summary
- Completed tasks:
  - Task 1: exact verification map created
  - Task 2: backward compatibility, FIFO queue proof, runtime baseline hardened
  - Task 3: contract, validation, persistence proof fixed or documented
  - Task 4: source-of-truth docs updated and finish handoff prepared
- In-progress tasks:
  - none
- Open blockers:
  - none

**Ready for finish:** yes

## Finish Result
- Close path selected: close 완료 + follow-up milestone 필요
- Close decision:
  - Phase 18 proof map and minimal hardening are complete.
  - Phase 19만 다음 milestone 범위로 남는다.
  - `docs/QUALITY_SCORE.md`와 `docs/exec-plans/tech-debt-tracker.md`는 저장소에 없어 추가 lifecycle update를 적용하지 않았다.
- Follow-up milestone:
  - Phase 19 `Performance-Ready Baseline`

## Finish Entry Criteria
- `verification-hardening.md` exists and covers all eight Phase 18 requirement IDs.
- Exact proof commands have been run and their outputs read.
- Any required minimal hardening changes have passing verification.
- `regression-matrix.md`, `state.md`, `overview.md`, and `roadmap.md` all point to the same current outcome and next milestone.

## Handoff to Finish
- Verification evidence:
  - `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification|TestSupportedCommands|TestSupportedEvents|TestManagedInstance_IncomingQueueFIFO'` -> `ok   sipflow/internal/engine`
  - `go test ./internal/scenario/... -run 'TestSaveAndLoadScenario'` -> `ok   sipflow/internal/scenario`
  - `go test ./internal/engine/... -run 'TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID|TestParseScenario_BlindTransferFields|TestParseScenario_MuteTransferFields|TestCreateInstances_Basic'` -> `ok   sipflow/internal/engine`
  - `go test ./internal/binding/... ./internal/pkg/eventhandler/...` -> `ok   sipflow/internal/binding`, `? sipflow/internal/pkg/eventhandler [no test files]`
  - `npm --prefix frontend exec vitest run src/features/scenario/builder/lib/validation.test.ts` -> `1 passed`, `2 passed`
  - `npm --prefix frontend run build` -> production build succeeded
  - `rg -n "DIALOG-03|DIALOG-04|UX-01|UX-02|UX-03|READY-01|READY-02|READY-04" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md` -> all 8 requirement IDs matched
  - `rg -n "verification-hardening|Phase 18|Phase 19|다음 단계|Next Step" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md` -> cross-doc phase alignment confirmed
- Commit list:
  - none in this session
- Docs updated:
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/completed/2026-03-19-phase18-regression-verification-hardening.md`
- Follow-up candidates:
  - Phase 19 baseline/performance-ready documentation
  - tech debt only if Phase 18 reveals proof gaps that should not block close

## Verification
- `go test ./internal/engine/... -run 'TestParseScenario_V1_1_BackwardCompatibility|TestIntegration_StopScenario|TestIntegration_ConcurrentStartPrevention|TestIntegration_CleanupVerification|TestSupportedCommands|TestSupportedEvents|TestManagedInstance_IncomingQueueFIFO'`
  - Expected: backward compatibility, runtime safety, and contract list tests pass or point to one narrow gap to fix.
- `go test ./internal/scenario/... -run 'TestSaveAndLoadScenario'`
  - Expected: scenario persistence round-trip remains intact.
- `go test ./internal/engine/... -run 'TestParseScenario_DefaultCallID|TestParseScenario_CustomCallID|TestParseScenario_BlindTransferFields|TestParseScenario_MuteTransferFields|TestCreateInstances_Basic'`
  - Expected: parser field preservation and incoming buffer proof remain green.
- `go test ./internal/binding/... ./internal/pkg/eventhandler/...`
  - Expected: binding/event contract checks remain green.
- `npm --prefix frontend exec vitest run src/features/scenario/builder/lib/validation.test.ts`
  - Expected: frontend validation hardening tests pass.
- `npm --prefix frontend run build`
  - Expected: frontend contract and validation changes do not break the build.
- `rg -n "DIALOG-03|DIALOG-04|UX-01|UX-02|UX-03|READY-01|READY-02|READY-04" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected: every Phase 18 requirement ID is explicit in the artifact doc.
- `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|manual|cleanup|StartScenario|StopScenario" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected: the artifact doc names the repeatable command set and machine-verdict checkpoints.
- `git diff -- docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md internal/engine/integration_test.go internal/engine/instance_manager_test.go frontend/src/features/scenario/builder/lib/validation.ts frontend/src/features/scenario/builder/lib/validation.test.ts docs/exec-plans/active/2026-03-19-phase18-regression-verification-hardening.md`
  - Expected: only Phase 18-related docs and the smallest required hardening files changed.

## Risks / Assumptions
- `DIALOG-04` proof is queue-level rather than full live SIP concurrency simulation. That is sufficient for the current `incomingCh` architecture, but not a substitute for future live-mode load testing.
- `UX-03` proof is a composition of repository round-trip, parser field tests, and frontend build/runtime wiring. There is still no dedicated end-to-end UI save/load test for those fields.
- `docs/QUALITY_SCORE.md` and `docs/exec-plans/tech-debt-tracker.md` are not present in the repository at planning time.
- Existing unrelated frontend/settings changes must remain untouched during Phase 18 work.
