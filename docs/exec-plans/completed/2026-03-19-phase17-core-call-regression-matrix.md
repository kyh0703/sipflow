# Phase 17 Core Call Regression Matrix Execution Plan

**Goal**
v1.4 Phase 17의 산출물을 실행 가능한 문서로 고정한다. 기본 콜 must-have 시나리오와 `callId` 오지정/멀티 다이얼로그 실패 케이스를 하나의 회귀 매트릭스로 정리하고, 후속 Phase 18 검증 경로 매핑에 바로 사용할 수 있는 기준선을 만든다.

**References**
- `docs/AGENTS.md`
- `docs/PLANS.md`
- `docs/project/overview.md`
- `docs/project/state.md`
- `docs/project/roadmap.md`
- `docs/product-specs/active/v1.4-core-call-stability.md`
- `docs/design-docs/research/v1.2-transfer-hold-ui/summary.md`

**Milestone Scope**
- In:
  - `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02`를 scenario-level baseline으로 고정
  - happy path와 mis-target negative path를 한 문서에서 분리 정리
  - Phase 18 검증면(engine, binding/eventhandler, frontend build, manual)을 scenario cluster 단위로 매핑
- Out:
  - `DIALOG-03`, `DIALOG-04`, `UX-*`, `READY-*`의 실제 자동 검증 구현
  - active plan lifecycle close 처리(`completed/` 이동)

**Success Criteria**
- Phase 17 matrix 문서가 생성되어 모든 requirement ID를 explicit scenario 또는 invariant로 다룬다.
- failure matrix와 multi-dialog invariant가 분리되어 `DIALOG-02`를 directly 검증 가능하게 만든다.
- `docs/project/state.md`, `docs/project/overview.md`, `docs/project/roadmap.md`가 동일한 다음 단계(Phase 18)를 가리킨다.
- active plan이 실행 기록과 finish handoff를 포함하는 살아 있는 상태 문서가 된다.

## Planned Files
- Create:
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
- Modify:
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
- Read:
  - `docs/project/state.md`
  - `docs/project/roadmap.md`
  - `docs/product-specs/active/v1.4-core-call-stability.md`
  - `docs/design-docs/research/v1.2-transfer-hold-ui/summary.md`
- Test:
  - `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05|DIALOG-01|DIALOG-02" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|live/manual" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `rg -n "Phase 17|Phase 18|다음 단계|Next Step|regression-matrix" docs/project/state.md docs/project/overview.md docs/project/roadmap.md`
  - `git diff -- docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
- Docs to update:
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
  - `docs/exec-plans/completed/2026-03-19-phase17-core-call-regression-matrix.md` (finish 단계에서 이동)

## Task 1: Create Must-Have Regression Matrix Doc
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- v1.4 요구사항 문서에서 `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02` wording을 확인한다.
- v1.2/v1.3 문서에서 Hold/Retrieve/BlindTransfer/MuteTransfer의 동작 근거를 확인한다.
**Exit criteria:**
- 새 matrix 문서가 생성되어 happy path 5개를 모두 담는다.
- 각 scenario가 node sequence, participating instances, target dialog key, expected event chain, success/failure signal을 포함한다.

- [x] Read `docs/product-specs/active/v1.4-core-call-stability.md` and extract the exact success criteria for `CORE-01` through `CORE-05`, `DIALOG-01`, and `DIALOG-02`.
  - Files:
    - `docs/product-specs/active/v1.4-core-call-stability.md`
  - Run:
    - `sed -n '1,240p' docs/product-specs/active/v1.4-core-call-stability.md`
  - Expected:
    - The plan owner has the exact wording for Phase 17 requirement IDs and the four verification commands already defined by the product spec.
  - Verification result:
    - 완료. `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02`와 검증 기준 4개 명령을 source 문서에서 직접 확인했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - `DIALOG-03` 이후 항목은 범위 밖으로 유지했다.
- [x] Create `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md` with a short scope section that explains this document is the Phase 17 source for scenario-level regression coverage.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `test -f docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - The file exists and starts with Phase 17/v1.4 context, scope, and source-of-truth links.
  - Verification result:
    - 완료. 새 문서가 생성되었고 scope/source-of-truth 섹션이 포함됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - 문서 위치는 `docs/design-docs/research/v1.4-core-call-stability/`로 고정했다.
- [x] Add one must-have section for each core scenario: outbound basic call, inbound basic call, hold/retrieve, blind transfer, mute transfer.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - Each requirement ID appears exactly once in a dedicated scenario section.
  - Verification result:
    - 완료. `rg` 결과로 5개 scenario heading이 모두 확인됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - 각 section은 requirement wording과 baseline table을 함께 가진다.
- [x] For each must-have scenario, record the exact node sequence, participating SIP instances, target dialog key (`instanceId + callId`), expected event chain, success signal, and failure signal.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `sed -n '1,260p' docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - A zero-context executor can tell what to run, which dialog the scenario should touch, and what counts as pass/fail without looking at code first.
  - Verification result:
    - 완료. 모든 happy-path scenario table에 required fields가 포함됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - fixture key는 `primary`, `inbound`, `consult`로 통일했다.

## Task 2: Add Failure Cases And callId Mis-Target Matrix
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1의 happy-path terminology와 fixture key가 먼저 고정되어 있어야 한다.
**Exit criteria:**
- negative matrix가 독립 섹션으로 분리된다.
- `DIALOG-01`, `DIALOG-02` invariant와 Phase 18 handoff 매핑이 문서에 포함된다.

- [x] Add a failure-matrix section that separates negative cases from the five must-have happy paths.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `rg -n "Failure Matrix|Mis-Target|Multi-Dialog Invariants" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - The document has an explicit negative-test section instead of mixing failures into the happy-path rows.
  - Verification result:
    - 완료. `Failure Matrix And Mis-Target Cases`와 `Multi-Dialog Invariants` 섹션이 분리되어 있다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - happy path와 negative baseline을 명시적으로 분리했다.
- [x] Document `callId` mis-target cases for `Hold`, `Retrieve`, `Release`, `BlindTransfer`, and `MuteTransfer`, including the expected symptom when the wrong dialog is referenced.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `rg -n "Hold|Retrieve|Release|BlindTransfer|MuteTransfer" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - Each command that acts on an existing dialog has at least one negative case covering wrong or missing `callId`.
  - Verification result:
    - 완료. `NEG-01`~`NEG-06`에서 각 command 계열 mis-target symptom을 고정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - legacy default-path는 `DIALOG-03` 범위로 분리해 여기서는 explicit key baseline만 다뤘다.
- [x] Add multi-dialog invariants that prove `DIALOG-01` and `DIALOG-02`: two dialogs can coexist on one instance, and commands/events must touch only the addressed dialog.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `rg -n "DIALOG-01|DIALOG-02|instanceId \\+ callId" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - The document states both the coexistence invariant and the non-interference invariant in scenario-level terms.
  - Verification result:
    - 완료. `DIALOG-01` 공존성, `DIALOG-02` 비간섭성이 invariant로 분리 기록됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - `CORE-05`를 `DIALOG-01`의 대표 baseline으로 연결했다.
- [x] Add a "handoff to Phase 18" section that maps every scenario row to the likely verification surface: engine test, binding/eventhandler test, frontend build, or manual/live scenario check.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Run:
    - `rg -n "Handoff To Phase 18|go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|live/manual" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - The matrix is immediately usable as the input for Phase 18 command mapping instead of being a dead-end document.
  - Verification result:
    - 완료. Phase 18 handoff table와 product spec verification command set이 모두 들어갔다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - `CORE-05`는 frontend build surface까지 포함했다.

## Task 3: Update Project Status Docs After Matrix Is Finalized
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- matrix 문서가 생성되고 Task 1, Task 2가 완료되어 있어야 한다.
**Exit criteria:**
- `state.md`, `overview.md`, `roadmap.md`가 동일한 next step을 가리킨다.
- Phase 17 상태가 완료로 승격되고 Phase 18이 다음 단계로 드러난다.

- [x] Update `docs/project/state.md` so the current phase/status reflects that Phase 17 matrix work has started or completed, and the "다음 단계" line points to the next unfinished item.
  - Files:
    - `docs/project/state.md`
  - Run:
    - `rg -n "Phase 17|Phase 18|다음 단계|phase18_ready" docs/project/state.md`
  - Expected:
    - `state.md` no longer says only "착수 대기" once the matrix document exists.
  - Verification result:
    - 완료. top status가 `phase18_ready`로 올라가고 다음 단계가 Phase 18 매핑 작업으로 바뀌었다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - TODO에서 Phase 17을 완료 처리했다.
- [x] Update `docs/project/overview.md` to link the new regression-matrix document as the current v1.4 supporting design/research artifact.
  - Files:
    - `docs/project/overview.md`
  - Run:
    - `rg -n "v1.4 회귀 매트릭스|regression-matrix|Next Step" docs/project/overview.md`
  - Expected:
    - A reader starting from overview can discover the Phase 17 matrix without guessing its path.
  - Verification result:
    - 완료. 관련 문서, 문서 맵, current state에 matrix 링크가 추가됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - next step은 Phase 18 매핑으로 업데이트했다.
- [x] Update `docs/project/roadmap.md` only if the plan execution changes Phase 17 status from `다음` to `진행 중` or `완료`.
  - Files:
    - `docs/project/roadmap.md`
  - Run:
    - `rg -n "Phase 17|17-01|17-02|Phase 18|regression matrix" docs/project/roadmap.md`
  - Expected:
    - Roadmap status remains aligned with state.md and does not overstate completion.
  - Verification result:
    - 완료. Phase 17 산출물 링크가 추가됐고 17-01/17-02 및 v1.4 progress row가 완료/다음 상태로 정렬됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - Phase 18는 `다음`, Phase 19는 `대기`로 유지했다.

## Task 4: Close The Plan Lifecycle
**Parallelizable:** No
**Owner:** finish
**Status:** done
**Entry criteria:**
- Task 1~3가 완료되고 matrix와 project docs가 검증된 상태여야 한다.
**Exit criteria:**
- finish가 verification evidence를 재확인한다.
- active plan이 `completed/`로 이동한다.

- [x] Re-read the completed matrix and confirm it covers all seven Phase 17 requirement IDs without gaps.
  - Files:
    - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
    - `docs/product-specs/active/v1.4-core-call-stability.md`
  - Run:
    - `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05|DIALOG-01|DIALOG-02" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected:
    - Every Phase 17 requirement ID appears in the final document and none are left implicit.
  - Verification result:
    - 완료. seven requirement IDs가 모두 explicit heading 또는 invariant로 존재한다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - `DIALOG-01`, `DIALOG-02`는 invariant 섹션으로 고정했다.
- [x] Verify the three project docs point at the same current phase and next action.
  - Files:
    - `docs/project/state.md`
    - `docs/project/overview.md`
    - `docs/project/roadmap.md`
  - Run:
    - `rg -n "Phase 17|Phase 18|다음 단계|Next Step|regression-matrix" docs/project/state.md docs/project/overview.md docs/project/roadmap.md`
  - Expected:
    - There is no cross-document mismatch about the active phase or the next item.
  - Verification result:
    - 완료. state/overview/roadmap가 모두 Phase 17 complete -> Phase 18 next 흐름으로 정렬됐다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - overview와 roadmap에는 matrix artifact link도 추가됐다.
- [x] Move this plan from `active/` to `completed/` after Phase 17 outputs are finished and verified.
  - Files:
    - `docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
  - Run:
    - `mv docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md docs/exec-plans/completed/2026-03-19-phase17-core-call-regression-matrix.md`
  - Expected:
    - `active/` no longer contains a stale finished plan, and the completed history preserves the execution record.
  - Verification result:
    - finish 승인 후 lifecycle close 실행. Phase 17은 종료 가능하며 follow-up은 Phase 18로 넘긴다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - close path: close 완료 + follow-up milestone 필요

## Integration
- This phase is documentation-heavy and touches overlapping source-of-truth files, so direct execution was used.
- The main implementer owned the matrix document and all source-of-truth updates to avoid contradictory wording across docs.
- Task 2 built on Task 1's fixture key terminology (`primary`, `inbound`, `consult`) before negative cases were named.
- Task 3 happened after the matrix document stabilized. Status docs now point at an existing artifact.

## Execution Progress Summary
- Completed tasks:
  - Task 1: Must-have regression matrix doc created
  - Task 2: Failure matrix, invariants, and Phase 18 handoff added
  - Task 3: State, overview, roadmap aligned to Phase 18 next step
  - Task 4: finish-owned verification and lifecycle close approved
- In-progress tasks:
  - none
- Open blockers:
  - none

**Ready for finish:** yes

## Finish Result
- Close path selected: close 완료 + follow-up milestone 필요
- Close decision:
  - Phase 17 documentation scope is complete and verified.
  - Next milestone work remains in Phase 18 only.
  - `docs/QUALITY_SCORE.md` and `docs/exec-plans/tech-debt-tracker.md` are not present in this repo, so no additional lifecycle update was applied there.
- Follow-up milestone:
  - Phase 18 `Regression Verification Hardening`

## Finish Entry Criteria
- Matrix document exists and covers `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02`.
- Project status docs all point to the same next step.
- Verification commands listed below have been run and read.
- Only planned docs changed for this phase.

## Handoff to Finish
- Verification evidence:
  - `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05|DIALOG-01|DIALOG-02" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md` -> all 7 requirement IDs matched
  - `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|live/manual" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md` -> Phase 18 verification surfaces matched
  - `rg -n "Phase 17|Phase 18|다음 단계|Next Step|regression-matrix" docs/project/state.md docs/project/overview.md docs/project/roadmap.md` -> cross-doc alignment confirmed
  - `git diff -- docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md` -> docs-only diff expected
- Commit list:
  - none in this session
- Docs updated:
  - `docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - `docs/project/state.md`
  - `docs/project/overview.md`
  - `docs/project/roadmap.md`
  - `docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
- Follow-up candidates:
  - Phase 18: existing test/build path mapping
  - Phase 18: `DIALOG-03`, `DIALOG-04`, `READY-*`, `UX-*` verification hardening

## Verification
- `rg -n "CORE-01|CORE-02|CORE-03|CORE-04|CORE-05|DIALOG-01|DIALOG-02" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected: all seven Phase 17 requirement IDs are present in the matrix document.
- `rg -n "go test ./internal/engine/...|go test ./internal/binding/... ./internal/pkg/eventhandler/...|npm --prefix frontend run build|live/manual" docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md`
  - Expected: the document names the existing verification surfaces that Phase 18 will formalize.
- `rg -n "Phase 17|Phase 18|다음 단계|Next Step|regression-matrix" docs/project/state.md docs/project/overview.md docs/project/roadmap.md`
  - Expected: state, overview, and roadmap all point to the same current outcome and next step.
- `git diff -- docs/design-docs/research/v1.4-core-call-stability/regression-matrix.md docs/project/state.md docs/project/overview.md docs/project/roadmap.md docs/exec-plans/active/2026-03-19-phase17-core-call-regression-matrix.md`
  - Expected: only the planned documentation files changed; unrelated dirty frontend files remain untouched.

## Risks / Assumptions
- The matrix defines scenario-level pass/fail criteria before all automated checks exist; Phase 18 still needs to bind them to exact runnable targets.
- Live-mode verification for transfer flows remains partly manual until more automation is added.
- Existing dirty changes under `frontend/src/features/settings/` are unrelated to this phase and must remain untouched.
