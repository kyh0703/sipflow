# Phase 19 Performance-Ready Baseline Execution Plan

**Goal**
아직 성능 테스트를 구현하지 않되, 나중에 성능 측정으로 전환할 수 있도록 반복 실행 baseline과 로그 판독 기준을 고정한다. `READY-03`을 기준으로 ActionLog / SIP log의 식별자(`nodeId`, `instanceId`, `timestamp`, `callId`)와 분석용 메모(`note`)가 어디서 생성되고 어디까지 전달되는지 문서화하고, 필요한 최소 hardening으로 future performance profiling의 출발점을 만든다.

**References**
- `docs/AGENTS.md`
- `docs/PLANS.md`
- `docs/project/state.md`
- `docs/project/overview.md`
- `docs/project/roadmap.md`
- `docs/ARCHITECTURE.md`
- `docs/product-specs/active/v1.4-core-call-stability.md`
- `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
- `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
- `docs/exec-plans/completed/2026-03-19-phase18-regression-verification-hardening.md`

**Milestone Scope**
- In:
  - `READY-03`에 필요한 ActionLog / SIP log field baseline 문서화
  - repeatable baseline scenario/command set을 Phase 17~18 proof 위에 고정
  - backend emit path와 frontend execution surface 사이의 field propagation gap을 최소 수정으로 정리
  - 향후 성능 측정 시 어떤 로그 필드로 성공/실패/지연을 읽을지 기준선 작성
- Out:
  - 실제 performance benchmark 구현
  - 새로운 telemetry storage / tracing backend 도입
  - 대형 execution monitor redesign

**Success Criteria**
- Phase 19 산출물 문서가 baseline scenario, exact command set, log interpretation rule을 한 곳에 고정한다.
- `READY-03` 관점에서 `nodeId`, `instanceId`, `timestamp`, `callId`가 backend emit path와 frontend surface에 어떻게 남는지 exact file 기준으로 설명된다.
- `WithSIPMessage()` / ActionLog path의 identifier gap이 있으면 최소 code/test change로 닫힌다.
- frontend execution 타입/표시 surface가 future log analysis에 필요한 필드를 잃지 않도록 정리된다.
- 완료 시 project docs가 v1.4 마일스톤 close-ready 상태 또는 다음 상위 milestone 판단 상태로 정렬된다.

## Planned Files
- Create:
  - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - `docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
- Modify:
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `internal/engine/events.go` (if log field shape needs tightening)
  - `internal/engine/executor.go` (if `callId` propagation to SIP log is incomplete)
  - `internal/engine/executor_test.go` (if READY-03 proof needs focused field assertions)
  - `internal/engine/integration_test.go` (if event-stream or cleanup proof needs additional identifier assertions)
  - `frontend/src/features/execution/types/execution.ts` (if `note` / `callId` surface is incomplete)
  - `frontend/src/features/execution/store/execution-store.ts` (if field preservation needs tightening)
  - `frontend/src/features/execution/components/execution-log.tsx` (if analysis-visible fields need rendering or labeling)
  - `frontend/src/features/execution/components/execution-timeline.tsx` (if SIP message baseline needs note/callId visibility)
  - `docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
- Read:
  - `docs/product-specs/active/v1.4-core-call-stability.md`
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/project/state.md`
  - `docs/project/roadmap.md`
  - `docs/ARCHITECTURE.md`
  - `internal/engine/events.go`
  - `internal/engine/executor.go`
  - `internal/engine/executor_test.go`
  - `internal/engine/integration_test.go`
  - `frontend/src/features/execution/types/execution.ts`
  - `frontend/src/features/execution/store/execution-store.ts`
  - `frontend/src/features/execution/components/execution-log.tsx`
  - `frontend/src/features/execution/components/execution-timeline.tsx`
  - `frontend/src/features/scenario/builder/components/canvas.tsx`
- Test:
  - `go test ./internal/engine/... -run 'TestWithSIPMessage_Note|TestWithSIPMessage_NoNote|TestWithSIPMessage_EmptyNote|TestIntegration_EventStreamVerification|TestIntegration_CleanupVerification'`
  - `go test ./internal/binding/... ./internal/pkg/eventhandler/...`
  - `npm --prefix frontend run build`
  - `rg -n "READY-03|nodeId|instanceId|timestamp|callId|note|baseline command" docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - `git diff -- docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md internal/engine/events.go internal/engine/executor.go internal/engine/executor_test.go internal/engine/integration_test.go frontend/src/features/execution/types/execution.ts frontend/src/features/execution/store/execution-store.ts frontend/src/features/execution/components/execution-log.tsx frontend/src/features/execution/components/execution-timeline.tsx docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
- Docs to update:
  - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
  - `docs/exec-plans/completed/2026-03-19-phase19-performance-ready-baseline.md` (Phase 19 종료 시 이동)

## Task 1: Create The Performance-Ready Baseline Artifact
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Phase 18 proof map이 완료되어 있어야 한다.
- `READY-03` wording과 Phase 19 roadmap success criteria를 다시 읽은 상태여야 한다.
**Exit criteria:**
- 새 performance-ready-baseline 문서가 생성된다.
- baseline scenario set, command set, log interpretation sections이 존재한다.

- [ ] Re-read `READY-03`, Phase 19 roadmap criteria, and the existing Phase 17/18 artifacts to extract what must be fixed versus what is already proven.
  - Files:
    - `docs/product-specs/active/v1.4-core-call-stability.md`
    - `docs/project/roadmap.md`
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `sed -n '1,260p' docs/product-specs/active/v1.4-core-call-stability.md`
    - `sed -n '160,220p' docs/project/roadmap.md`
    - `sed -n '1,220p' docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected:
    - The implementer has the exact wording for `READY-03` and the three Phase 19 success criteria.
  - Commit intent:
    - none
  - Verification result:
    - 완료. `READY-03`와 Phase 19 roadmap success criteria, Phase 17/18 산출물을 다시 읽고 baseline 범위를 고정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - Phase 19 must build on the exact command set fixed in Phase 18, not replace it.
- [ ] Create `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md` with sections for baseline scenarios, baseline commands, log field map, log interpretation rules, and deferred performance work.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Run:
    - `test -f docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Expected:
    - The new file exists and starts with Phase 19 scope, references, and a `READY-03` field matrix.
  - Commit intent:
    - create the main Phase 19 baseline artifact
  - Verification result:
    - 완료. `performance-ready-baseline.md`를 생성했고 baseline scenario, command set, backend/frontend field matrix, interpretation rule, deferred work를 포함했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - this is the main deliverable of Phase 19.
- [ ] Define the repeatable baseline scenario/command set by selecting which exact commands from Phase 18 become the future performance rehearsal path.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Run:
    - `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - Expected:
    - The Phase 19 doc names which command set is the baseline and which checks remain only functional proof, not performance proof.
  - Commit intent:
    - freeze the repeatable baseline command set before any future perf instrumentation
  - Verification result:
    - 완료. Phase 18 exact proof command 셋 위에 engine/runtime + contract/build baseline command set을 고정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - do not over-expand the baseline beyond the smallest reusable set.

## Task 2: Audit And Harden Backend Log Field Propagation
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 artifact exists.
- backend emit paths are identified.
**Exit criteria:**
- `READY-03` backend field matrix is explicit.
- any missing `callId` or `note` propagation is fixed or recorded as a deliberate gap.

- [ ] Trace the ActionLog and SIP message field shape from `emitActionLog()` / `WithSIPMessage()` into actual executor call sites.
  - Files:
    - `internal/engine/events.go`
    - `internal/engine/executor.go`
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Run:
    - `rg -n "emitActionLog\\(|WithSIPMessage\\(" internal/engine/events.go internal/engine/executor.go`
    - `sed -n '1,220p' internal/engine/events.go`
  - Expected:
    - The implementer can name which fields are always present and which are currently passed as empty strings at the call site.
  - Commit intent:
    - expose the exact backend log field matrix before changing behavior
  - Verification result:
    - 완료. `emitActionLog()` / `WithSIPMessage()` 구조와 executor call sites를 추적해 top-level `callId` 부재와 nested `sipMessage.callId` 공백 패턴을 확인했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - current `WithSIPMessage()` call sites appear to pass empty `callId` in many places; confirm before patching.
- [ ] Add the smallest possible backend hardening so the baseline logs carry the identifiers required for future analysis.
  - Files:
    - `internal/engine/events.go`
    - `internal/engine/executor.go`
    - `internal/engine/executor_test.go`
    - `internal/engine/integration_test.go`
  - Run:
    - `go test ./internal/engine/... -run 'TestWithSIPMessage_Note|TestWithSIPMessage_NoNote|TestWithSIPMessage_EmptyNote|TestIntegration_EventStreamVerification|TestIntegration_CleanupVerification'`
  - Expected:
    - The engine tests pass and the doc can state exactly when `callId`, `nodeId`, `instanceId`, `timestamp`, and `note` are emitted.
  - Commit intent:
    - close READY-03 backend field gaps with surgical changes only
  - Verification result:
    - 완료. `WithCallID()`와 `emitNodeActionLog()`를 추가하고 executor의 node log 경로를 helper로 통일했다. `TestWithCallID`, `TestIntegration_EventStreamVerification`, `TestIntegration_CleanupVerification` 포함 targeted engine tests가 통과했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - prefer adding focused assertions over broad refactoring.
- [ ] Record the ActionLog/SIP log interpretation rules: which field identifies success, failure, cleanup, and latency anchor points.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
    - `internal/engine/integration_test.go`
  - Run:
    - `rg -n "scenario:action-log|scenario:started|scenario:completed|scenario:failed|scenario:stopped|Starting cleanup|Cleanup completed" internal/engine/integration_test.go internal/engine/events.go`
  - Expected:
    - The doc states which event or log lines are future performance timing anchors and which are merely descriptive.
  - Commit intent:
    - make log interpretation deterministic before future perf work
  - Verification result:
    - 완료. `performance-ready-baseline.md`에 success/failure/cleanup/latency anchor와 correlation key를 명시했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - distinguish timing anchors from informational logs.

## Task 3: Audit And Harden Frontend Execution Surfaces
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 2 backend field map exists.
- frontend execution surface files are identified.
**Exit criteria:**
- frontend types/store/log/timeline do not discard Phase 19 analysis fields.
- any missing field visibility is either fixed minimally or explicitly documented as deferred.

- [ ] Trace how ActionLog and SIP message fields travel through execution types and store state.
  - Files:
    - `frontend/src/features/execution/types/execution.ts`
    - `frontend/src/features/execution/store/execution-store.ts`
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Run:
    - `rg -n "callId|note|sipMessage|ActionLogEvent|ActionLog" frontend/src/features/execution/types/execution.ts frontend/src/features/execution/store/execution-store.ts`
  - Expected:
    - The implementer can name which fields are typed, stored, and available for future analysis.
  - Commit intent:
    - expose frontend field preservation before changing UI or types
  - Verification result:
    - 완료. execution types/store를 읽어 `callId`는 존재하지만 `note`가 타입에 없고 top-level `callId` 저장도 빠진 상태를 확인했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - current frontend types include `callId` but may omit `note`.
- [ ] Harden frontend execution types or UI surfaces only if they currently hide or discard fields needed for Phase 19 analysis.
  - Files:
    - `frontend/src/features/execution/types/execution.ts`
    - `frontend/src/features/execution/store/execution-store.ts`
    - `frontend/src/features/execution/components/execution-log.tsx`
    - `frontend/src/features/execution/components/execution-timeline.tsx`
    - `frontend/src/features/scenario/builder/components/canvas.tsx`
  - Run:
    - `npm --prefix frontend run build`
    - `rg -n "sipMessage|callId|note|timestamp|instanceId|nodeId" frontend/src/features/execution/types/execution.ts frontend/src/features/execution/store/execution-store.ts frontend/src/features/execution/components/execution-log.tsx frontend/src/features/execution/components/execution-timeline.tsx frontend/src/features/scenario/builder/components/canvas.tsx`
  - Expected:
    - The build passes and the Phase 19 doc can state exactly which analysis fields are available in the UI/store today.
  - Commit intent:
    - preserve READY-03 fields across the frontend execution surface with the smallest diff
  - Verification result:
    - 완료. `execution.ts`, `execution-store.ts`, `execution-log.tsx`, `execution-timeline.tsx`를 수정해 `callId`/`note`를 보존하고 최소 표시를 추가했다. frontend build가 통과했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - do not redesign the execution UI; only preserve or expose required identifiers.
- [ ] Document which fields are preserved but not yet rendered prominently, and which are intentionally deferred for future performance tooling.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
    - `frontend/src/features/execution/components/execution-log.tsx`
    - `frontend/src/features/execution/components/execution-timeline.tsx`
  - Run:
    - `rg -n "ExecutionLog|ExecutionTimeline|sipMessages|actionLogs" frontend/src/features/execution/components/execution-log.tsx frontend/src/features/execution/components/execution-timeline.tsx frontend/src/features/execution/store/execution-store.ts`
  - Expected:
    - The doc distinguishes "available for analysis now" from "rendered in UI now" so future perf work does not over-claim visibility.
  - Commit intent:
    - make the baseline honest about stored vs rendered analysis fields
  - Verification result:
    - 완료. artifact 문서에 backend field matrix, frontend preservation matrix, stored-vs-rendered 구분을 명시했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - this task is about clarity and honesty, not polish.

## Task 4: Update Source-Of-Truth Docs And Prepare Finish Handoff
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Tasks 1~3 evidence is stable.
- any required hardening is already verified.
**Exit criteria:**
- Phase 19 artifact and project docs point to the same milestone state.
- active plan is ready for finish with exact verification evidence.

- [ ] Update `verification-hardening.md` so it points to the Phase 19 baseline artifact for future performance-oriented work.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
    - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Run:
    - `rg -n "Phase 19|performance-ready-baseline|READY-03" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Expected:
    - A reader can move from functional proof to performance-ready baseline without guessing the next artifact.
  - Commit intent:
    - connect Phase 18 proof map and Phase 19 baseline artifact
  - Verification result:
    - 완료. `verification-hardening.md` source-of-truth와 deferred section에서 `performance-ready-baseline.md`로 넘어가는 링크를 추가했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - keep the Phase 18 document focused on proof; Phase 19 owns analysis readiness.
- [ ] Update `docs/project/state.md`, `docs/project/overview.md`, and `docs/project/roadmap.md` when Phase 19 outputs are complete so v1.4 milestone close status is explicit.
  - Files:
    - `docs/project/state.md`
    - `docs/project/overview.md`
    - `docs/project/roadmap.md`
  - Run:
    - `rg -n "Phase 19|v1.4|다음 단계|Next Step|performance-ready-baseline" docs/project/state.md docs/project/overview.md docs/project/roadmap.md`
  - Expected:
    - The three project docs describe the same current milestone state and next decision point.
  - Commit intent:
    - keep project-level source-of-truth docs aligned after Phase 19 completion
  - Verification result:
    - 완료. `state.md`, `overview.md`, `roadmap.md`를 `v1.4 close-ready` 상태와 다음 단계(마감/다음 milestone 결정) 기준으로 정렬했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - do not over-claim v1.4 full close until the baseline artifact is complete and rechecked.
- [ ] Update this active plan with execution status, verification outputs, commit evidence, and finish handoff fields as work lands.
  - Files:
    - `docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
  - Run:
    - `sed -n '1,360p' docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
  - Expected:
    - The active plan remains a living execution record and can be moved to `completed/` by finish without reconstruction.
  - Commit intent:
    - preserve execution history inside the active plan
  - Verification result:
    - 완료. active plan에 실제 verification 결과와 finish handoff 근거를 기록했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - finish should move this file only after all baseline evidence is rechecked.

## Integration
- Phase 19 is documentation-led but may require surgical backend/frontend field propagation fixes.
- Shared source-of-truth docs (`verification-hardening.md`, `state.md`, `overview.md`, `roadmap.md`) should have a single owner to avoid inconsistent milestone status.
- Backend and frontend log surfaces are tightly coupled; if a field is added or tightened in one layer, the other layer must be checked in the same execution pass.
- The new Phase 19 artifact document is the integration center. Project-doc status updates should happen only after it stabilizes.

## Execution Progress Summary
- Completed tasks:
  - Task 1: performance-ready baseline artifact created
  - Task 2: backend callId propagation and interpretation rules hardened
  - Task 3: frontend execution field preservation and minimal visibility hardened
  - Task 4: source-of-truth docs updated and finish handoff prepared
- In-progress tasks:
  - none
- Open blockers:
  - none

**Ready for finish:** yes

## Finish Result
- Close path selected: close 완료 + 현재 상태 유지
- Close decision:
  - Phase 19 baseline artifact and minimal field hardening are complete.
  - v1.4 milestone is now close-ready from a docs and verification perspective.
  - `docs/QUALITY_SCORE.md`와 `docs/exec-plans/tech-debt-tracker.md`는 저장소에 없어 추가 lifecycle update를 적용하지 않았다.
- Next-step posture:
  - current branch/worktree 유지
  - merge/PR 또는 다음 milestone planning은 사용자가 이후 결정

## Finish Entry Criteria
- `performance-ready-baseline.md` exists and covers `READY-03` with exact fields, exact commands, and interpretation rules.
- Any backend/frontend field propagation gaps are fixed or explicitly documented as deferred with justification.
- Exact proof commands have been run and their outputs read.
- `verification-hardening.md`, `state.md`, `overview.md`, and `roadmap.md` all point to the same current milestone state.

## Handoff to Finish
- Verification evidence:
  - `go test ./internal/engine/... -run 'TestWithSIPMessage_Note|TestWithSIPMessage_NoNote|TestWithSIPMessage_EmptyNote|TestWithCallID|TestIntegration_EventStreamVerification|TestIntegration_CleanupVerification'` -> `ok   sipflow/internal/engine`
  - `go test ./internal/binding/... ./internal/pkg/eventhandler/...` -> `ok   sipflow/internal/binding`, `? sipflow/internal/pkg/eventhandler [no test files]`
  - `npm --prefix frontend run build` -> production build succeeded
  - `rg -n "READY-03|nodeId|instanceId|timestamp|callId|note|baseline command" docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md` -> READY-03 field matrix and baseline command set matched
  - `rg -n "performance-ready-baseline|verification-hardening|v1.4 close-ready|Phase 19|Next Step|다음 단계" docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md` -> cross-doc close-ready alignment confirmed
- Commit list:
  - none in this session
- Docs updated:
  - `docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - `docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/completed/2026-03-19-phase19-performance-ready-baseline.md`
- Follow-up candidates:
  - v1.4 milestone close summary
  - tech debt only if analysis-field gaps should not block close

## Verification
- `go test ./internal/engine/... -run 'TestWithSIPMessage_Note|TestWithSIPMessage_NoNote|TestWithSIPMessage_EmptyNote|TestWithCallID|TestIntegration_EventStreamVerification|TestIntegration_CleanupVerification'`
  - Expected: log field shape and event-stream assertions stay green after Phase 19 hardening.
- `go test ./internal/binding/... ./internal/pkg/eventhandler/...`
  - Expected: no contract regressions while tightening log fields.
- `npm --prefix frontend run build`
  - Expected: frontend execution surface changes remain build-clean.
- `rg -n "READY-03|nodeId|instanceId|timestamp|callId|note|baseline command" docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md`
  - Expected: the artifact doc explicitly names the Phase 19 analysis fields and baseline command set.
- `git diff -- docs/design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md docs/design-docs/research/v1.4-core-call-stability/verification-hardening.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md internal/engine/events.go internal/engine/executor.go internal/engine/executor_test.go internal/engine/integration_test.go frontend/src/features/execution/types/execution.ts frontend/src/features/execution/store/execution-store.ts frontend/src/features/execution/components/execution-log.tsx frontend/src/features/execution/components/execution-timeline.tsx docs/exec-plans/active/2026-03-19-phase19-performance-ready-baseline.md`
  - Expected: only Phase 19 baseline docs and the smallest required log-surface files changed.

## Risks / Assumptions
- `callId` in this baseline is the logical scenario/dialog ID, not guaranteed raw SIP `Call-ID` from the wire.
- execution timeline still uses simplified lane routing, so it is analysis-assistive rather than wire-accurate sequence evidence.
- `docs/QUALITY_SCORE.md` and `docs/exec-plans/tech-debt-tracker.md` are not present in the repository at planning time.
- Existing unrelated frontend/settings changes must remain untouched during Phase 19 work.
