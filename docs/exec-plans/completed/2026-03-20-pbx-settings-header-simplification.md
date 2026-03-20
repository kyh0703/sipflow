# PBX Settings Header Simplification Execution Plan

**Goal**
PBX settings 화면에서 중복으로 보이는 헤더 정보를 정리한다. 상단 settings 헤더는 `PBX` 텍스트만 유지하고, 내부 그리드 상단의 `PBX 인스턴스` 제목과 설명 문구는 제거해서 화면 첫 인상과 정보 계층을 단순화한다.

**References**
- `docs/AGENTS.md`
- `docs/PLANS.md`
- `frontend/src/layouts/settings-layout.tsx`
- `frontend/src/features/settings/components/settings-panel.tsx`
- `frontend/src/features/settings/components/settings-panel.test.tsx`

**Milestone Scope**
- In:
  - PBX settings 상단 헤더에서 description 제거
  - PBX grid 상단의 중복 제목/설명 제거 또는 최소화
  - 관련 테스트/빌드로 회귀 확인
- Out:
  - settings 다른 탭(`General`, `Media`)의 정보 구조 변경
  - PBX grid 컬럼/행 편집 동작 변경
  - settings 전체 레이아웃 리디자인

**Success Criteria**
- `/settings/pbx` 화면 상단에는 `PBX`만 보이고 `SIP/PBX connection settings` 문구는 사라진다.
- PBX grid 바로 위에서 `PBX 인스턴스` 제목과 설명 문구가 사라져 헤더가 한 번만 읽힌다.
- `행 추가`, grid 편집, 삭제 버튼 동작은 그대로 유지된다.
- 관련 테스트와 frontend build가 통과한다.

## Planned Files
- Create:
  - `docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
- Modify:
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/features/settings/components/settings-panel.tsx`
  - `frontend/src/features/settings/components/settings-panel.test.tsx` (if rendered text assertions need updating)
- Read:
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/features/settings/components/settings-panel.tsx`
  - `frontend/src/features/settings/components/settings-panel.test.tsx`
- Test:
  - `npm --prefix frontend test -- settings-panel.test.tsx`
  - `npm --prefix frontend run build`
  - `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/components/settings-panel.test.tsx docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
- Docs to update:
  - `docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
  - `docs/exec-plans/completed/2026-03-20-pbx-settings-header-simplification.md` (finish 시 이동)

## Task 1: Confirm Current Header Ownership And Target UI
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- PBX settings 화면의 중복 헤더 위치가 스크린샷과 코드에서 확인된다.
**Exit criteria:**
- 상단 layout header와 panel 내부 header 중 무엇을 남기고 무엇을 제거할지 문서에 고정된다.

- [x] Read the settings layout metadata and PBX panel header block to map which text renders in which layer.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/features/settings/components/settings-panel.tsx`
  - Run:
    - `rg -n "description|PBX 인스턴스|SIP/PBX connection settings|space-y-1" frontend/src/layouts/settings-layout.tsx frontend/src/features/settings/components/settings-panel.tsx`
  - Expected:
    - The plan identifies the top-level `PBX` title/description block and the panel-level `PBX 인스턴스` title/description block separately.
  - Commit intent:
    - freeze the exact UI scope before editing
  - Verification result:
    - 완료. `settings-layout.tsx`가 페이지 레벨 `PBX` 제목/description을 렌더링하고, `settings-panel.tsx`가 `PBX 인스턴스` 제목과 helper copy를 별도로 렌더링한다는 점을 확인했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - user request is to keep only `PBX` and drop the redundant description area.

## Task 2: Remove Redundant PBX Description And Nested Header Copy
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 has fixed the exact ownership of the duplicated text.
**Exit criteria:**
- PBX tab keeps a single visible title hierarchy without the duplicated description block.
- Row add/edit/delete controls stay in place.

- [x] Edit the settings layout so the PBX tab header no longer renders the English description line.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
  - Run:
    - `rg -n "SETTINGS_META|description" frontend/src/layouts/settings-layout.tsx`
  - Expected:
    - The PBX tab renders only the `PBX` title in the top header area.
  - Commit intent:
    - remove top-level duplicate description with the smallest diff
  - Verification result:
    - 완료. `SETTINGS_META.pbx.description`를 제거하고 description이 있을 때만 `<p>`를 렌더링하도록 바꿨다. PBX 탭 상단에는 `PBX` 제목만 남는다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - avoid changing General/Media copy unless the shared structure forces a minimal generalization.
- [x] Edit the PBX settings panel so the inner `PBX 인스턴스` title and helper description are removed while leaving the action button and table intact.
  - Files:
    - `frontend/src/features/settings/components/settings-panel.tsx`
  - Run:
    - `rg -n "PBX 인스턴스|SIP Instance" frontend/src/features/settings/components/settings-panel.tsx`
  - Expected:
    - The first visible content under the page header is the `행 추가` action row and the table card, without a second section title.
  - Commit intent:
    - eliminate redundant inner header copy without changing PBX grid behavior
  - Verification result:
    - 완료. panel 상단 텍스트 블록을 제거하고 액션 영역을 `행 추가` 버튼만 보이도록 정리했다. 그리드 구조와 추가/삭제/edit 로직은 그대로 유지했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - keep spacing balanced after removing the text block.

## Task 3: Recheck UI Contract And Prepare Finish Handoff
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- UI edits are applied locally.
**Exit criteria:**
- Relevant tests/build pass.
- Active plan contains enough verification evidence for finish.

- [x] Update or keep the PBX settings tests depending on whether rendered text assertions are affected.
  - Files:
    - `frontend/src/features/settings/components/settings-panel.test.tsx`
  - Run:
    - `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx`
  - Expected:
    - The component test passes after the header-copy removal.
  - Commit intent:
    - preserve existing PBX panel behavior checks while accommodating the copy change
  - Verification result:
    - 완료. 기존 테스트가 삭제 confirm 동작만 검증하고 있어서 별도 수정은 필요 없었다. `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx` 실행 결과 `1 passed`, `2 passed`.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - 초기 `npm --prefix frontend test -- settings-panel.test.tsx`는 `test` script 부재로 실패했고, vitest 바이너리 직접 실행으로 대체했다.
- [x] Run the frontend build and capture the minimal diff for the changed files.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/features/settings/components/settings-panel.tsx`
    - `frontend/src/features/settings/components/settings-panel.test.tsx`
    - `docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
  - Run:
    - `npm --prefix frontend run build`
    - `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/components/settings-panel.test.tsx docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
  - Expected:
    - Build succeeds and diff is limited to the PBX settings header simplification scope.
  - Commit intent:
    - close the UI cleanup with explicit verification evidence
  - Verification result:
    - 완료. `npm.cmd --prefix frontend run build`를 sandbox 밖에서 재실행해 production build 성공을 확인했다. `git diff -- ...` 결과는 `settings-layout.tsx`, `settings-panel.tsx`와 active plan만 바뀌었다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - PowerShell execution policy 때문에 `npm` 대신 `npm.cmd`를 사용했고, build는 sandbox의 `esbuild spawn EPERM` 제약 때문에 escalate해서 실행했다.

## Integration
- `settings-layout.tsx` owns the page-level title/description shell for all settings tabs.
- `settings-panel.tsx` owns PBX-specific section copy and grid controls.
- The requested cleanup should be surgical: remove duplicated text without broadening into a settings IA redesign.

## Execution Progress Summary
- Completed tasks:
  - Task 1: current header ownership confirmed
  - Task 2: PBX duplicated header copy removed
  - Task 3: frontend verification completed
- In-progress tasks:
  - none
- Open blockers:
  - none

**Ready for finish:** yes

## Finish Entry Criteria
- PBX settings page shows only one title hierarchy.
- The duplicated English description and nested PBX section description are removed.
- `행 추가` button and PBX table interactions remain intact.
- Relevant frontend test/build commands have been run and recorded.

## Handoff to Finish
- Verification evidence:
  - `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`
  - `npm.cmd --prefix frontend run build` -> `vite v5.4.21 building for production...`, `✓ built in 3.32s`
  - `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/components/settings-panel.test.tsx docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md` -> only PBX header simplification scope changed
- Commit list:
  - none in this session
- Docs updated:
  - `docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/features/settings/components/settings-panel.tsx`
- Follow-up candidates:
  - if other settings tabs have the same duplication pattern, assess them separately instead of expanding this task

## Verification
- `npm --prefix frontend test -- settings-panel.test.tsx`
  - Expected: PBX panel behavior test remains green after copy cleanup.
- `npm --prefix frontend run build`
  - Expected: settings UI change ships without frontend build regressions.
- `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/components/settings-panel.test.tsx docs/exec-plans/active/2026-03-20-pbx-settings-header-simplification.md`
  - Expected: only the PBX header simplification scope is changed.

## Risks / Assumptions
- Shared layout metadata may tempt a broader cleanup, but this task should stay PBX-only unless a tiny shared conditional is unavoidable.
- The screenshot is treated as the source of truth for this request: retain `PBX`, remove redundant descriptive copy.
