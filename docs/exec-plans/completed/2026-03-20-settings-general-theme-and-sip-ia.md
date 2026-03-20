# Settings General Theme And SIP IA Execution Plan

**Goal**
settings 정보 구조를 정리한다. 현재 헤더에 떠 있는 theme toggle을 General 탭의 기본 설정 영역으로 옮기고, settings 좌측 탭과 관련 화면에서 `PBX`라는 사용자 표시명을 `SIP` 중심 구조로 재정렬한다. 결과적으로 General은 앱 기본 설정을 담당하고, 기존 PBX 화면은 SIP 연결/인스턴스 설정을 담당하도록 역할을 분리한다.

**References**
- `docs/AGENTS.md`
- `docs/PLANS.md`
- `frontend/src/layouts/settings-layout.tsx`
- `frontend/src/components/ui/theme-toggle.tsx`
- `frontend/src/routes/settings.general.tsx`
- `frontend/src/routes/settings.pbx.tsx`
- `frontend/src/routes/settings.index.tsx`
- `frontend/src/router-types.ts`
- `frontend/src/features/settings/components/settings-panel.tsx`
- `frontend/src/features/settings/store/app-settings-store.ts`
- `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
- `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`

**Milestone Scope**
- In:
  - settings header에서 theme toggle 제거
  - General 탭에 theme selection 중심의 기본 설정 섹션 추가
  - settings 내 `PBX` 사용자 표시명을 `SIP` 방향으로 정리
  - SIP settings 화면의 제목/설명/empty state를 역할에 맞게 재서술
  - 필요한 범위의 route redirect / tab label / pending copy 정리
- Out:
  - theme system 자체(`next-themes`, 토큰, 다크/라이트 동작) 재설계
  - PBX/SIP 엔진 동작 변경
  - settings 전체를 Obsidian 수준으로 완전 재디자인
  - 내부 타입/파일명/스토어 key를 무조건 전면 `sip*`로 rename

**Success Criteria**
- settings 헤더에는 더 이상 theme toggle이 없고, General 탭에서 theme를 바꿀 수 있다.
- General 탭은 placeholder 한 줄이 아니라 “기본 설정” 역할이 보이는 실제 설정 섹션을 가진다.
- settings 탭 라벨과 page title에서 `PBX`가 아닌 `SIP`가 보인다.
- SIP instance를 선택/참조하는 관련 UI 문구가 새 settings IA와 충돌하지 않는다.
- 변경 후 build 및 관련 테스트가 통과한다.

## Planned Files
- Create:
  - `docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
- Modify:
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/components/ui/theme-toggle.tsx` (if General 전용 variant 또는 재사용 prop이 필요하면)
  - `frontend/src/routes/settings.general.tsx`
  - `frontend/src/routes/settings.pbx.tsx`
  - `frontend/src/routes/settings.index.tsx` (if default redirect target should change)
  - `frontend/src/router-types.ts`
  - `frontend/src/layouts/app-sidebar.tsx` (if settings landing route label/target changes)
  - `frontend/src/features/settings/components/settings-panel.tsx`
  - `frontend/src/features/settings/store/app-settings-store.ts`
  - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
  - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
  - `frontend/src/routeTree.gen.ts` (router regeneration result if route path changes)
- Read:
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/components/ui/theme-toggle.tsx`
  - `frontend/src/routes/settings.general.tsx`
  - `frontend/src/routes/settings.pbx.tsx`
  - `frontend/src/routes/settings.index.tsx`
  - `frontend/src/router-types.ts`
  - `frontend/src/features/settings/components/settings-panel.tsx`
  - `frontend/src/features/settings/store/app-settings-store.ts`
  - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
  - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
- Test:
  - `.\\node_modules\\.bin\\vitest.cmd run src/components/ui/theme-toggle.test.tsx`
  - `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx`
  - `npm.cmd --prefix frontend run build`
  - `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/components/ui/theme-toggle.tsx frontend/src/routes/settings.general.tsx frontend/src/routes/settings.pbx.tsx frontend/src/routes/settings.index.tsx frontend/src/router-types.ts frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/store/app-settings-store.ts frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
- Docs to update:
  - `docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
  - `docs/exec-plans/completed/2026-03-20-settings-general-theme-and-sip-ia.md` (finish 시 이동)

## Task 1: Fix Scope And IA Boundary Before Editing
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- current settings IA와 theme toggle 위치가 코드에서 확인된다.
**Exit criteria:**
- 이번 작업이 다루는 “theme 이동 범위”와 “PBX -> SIP rename 범위”가 문서에 고정된다.

- [x] Audit where theme controls currently exist and whether the request applies only to settings or to every header that currently exposes `ThemeToggle`.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/features/scenario/builder/components/scenario-builder.tsx`
    - `frontend/src/components/ui/theme-toggle.tsx`
  - Run:
    - `rg -n "ThemeToggle" frontend/src/layouts/settings-layout.tsx frontend/src/features/scenario/builder/components/scenario-builder.tsx frontend/src/components/ui/theme-toggle.tsx`
  - Expected:
    - The implementer can state whether only settings header loses the toggle or whether flow toolbar also needs a follow-up.
  - Commit intent:
    - freeze the theme-control move scope before editing
  - Verification result:
    - 완료. `ThemeToggle`는 settings header와 flow toolbar 두 곳에서 사용 중이었고, 이번 작업은 settings header에서만 제거하는 것으로 범위를 고정했다. flow toolbar toggle은 그대로 유지했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - working assumption for this plan: remove theme toggle from settings header only; flow toolbar toggle is out of scope unless the user expands it.
- [x] Audit the current `PBX` surface area and split “user-facing label rename” from “internal identifier/path rename”.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/routes/settings.pbx.tsx`
    - `frontend/src/features/settings/store/app-settings-store.ts`
    - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
    - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
  - Run:
    - `rg -n "PBX|pbx" frontend/src/layouts/settings-layout.tsx frontend/src/routes/settings.pbx.tsx frontend/src/features/settings/store/app-settings-store.ts frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
  - Expected:
    - The plan can explicitly distinguish cheap user-facing copy updates from broader route/store/type rename work.
  - Commit intent:
    - avoid an accidental repo-wide rename when the user-facing IA change may be enough
  - Verification result:
    - 완료. UI 라벨, route pending copy, default display name, scenario-builder helper text는 `SIP`로 바꾸고, 내부 route/file/store 식별자(`settings.pbx`, `pbxInstances`, `pbxInstanceId`)는 안정성을 위해 유지하기로 결정했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - working assumption for this plan: user-facing labels/titles move to `SIP`, but internal route/store ids may stay `pbx*` unless a small targeted rename is clearly beneficial.

## Task 2: Move Theme Controls Into General Settings
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 scope is fixed.
**Exit criteria:**
- settings header no longer owns theme controls.
- General tab exposes the default theme control as a real settings section.

- [x] Remove `ThemeToggle` from the settings workspace header and keep the header itself visually stable without creating a dead empty corner.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
  - Run:
    - `rg -n "ThemeToggle|Settings" frontend/src/layouts/settings-layout.tsx`
  - Expected:
    - Settings header keeps title/navigation framing but does not render the theme control.
  - Commit intent:
    - move global-looking theme control out of the settings shell
  - Verification result:
    - 완료. `settings-layout.tsx`에서 `ThemeToggle` import와 헤더 렌더링을 제거하고, shell header는 `Settings` 텍스트만 남기도록 정리했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - do not remove unrelated shell structure while relocating the control.
- [x] Replace the General placeholder with a structured settings panel that includes the theme selector and leaves room for future “기본 설정” items.
  - Files:
    - `frontend/src/routes/settings.general.tsx`
    - `frontend/src/components/ui/theme-toggle.tsx` (if variant or label customization is needed)
  - Run:
    - `Get-Content frontend/src/routes/settings.general.tsx`
    - `Get-Content frontend/src/components/ui/theme-toggle.tsx`
  - Expected:
    - General page contains at least one real settings section/card for theme selection and a coherent placeholder/future-settings layout.
  - Commit intent:
    - turn General from placeholder into the home for app defaults
  - Verification result:
    - 완료. `settings.general.tsx`를 placeholder 한 줄에서 실제 설정 카드로 교체했고, `next-themes` 기반 기본 테마 선택 Select와 future defaults placeholder 영역을 추가했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - image reference suggests an Obsidian-like stacked settings list, not just a standalone button.

## Task 3: Rename Settings IA From PBX To SIP
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Task 1 rename scope is fixed.
**Exit criteria:**
- settings navigation and page copy present the SIP settings mental model consistently.
- scenario property surfaces do not contradict the new naming.

- [x] Update settings tab labels, page metadata, route pending copy, and settings panel copy so the user sees `SIP` instead of `PBX`.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/routes/settings.pbx.tsx`
    - `frontend/src/features/settings/components/settings-panel.tsx`
  - Run:
    - `rg -n "PBX|Loading PBX settings|PBX 설정|PBX 인스턴스" frontend/src/layouts/settings-layout.tsx frontend/src/routes/settings.pbx.tsx frontend/src/features/settings/components/settings-panel.tsx`
  - Expected:
    - The settings IA reads as `SIP` / `SIP instance` / `SIP settings` rather than a PBX-only screen.
  - Commit intent:
    - align the settings information architecture with broader SIP scope
  - Verification result:
    - 완료. settings 탭 라벨/메타, `settings.pbx.tsx` pending copy, `settings-panel.tsx`의 toast/empty state/placeholder/aria-label을 `SIP` 기준으로 정리했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - keep the actual stored endpoint fields (`host`, `port`, `transport`, `registerInterval`) unchanged unless required.
- [x] Reconcile scenario-builder-facing labels so users do not see `PBX` in one place and `SIP` in another for the same settings concept.
  - Files:
    - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
    - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
    - `frontend/src/features/settings/store/app-settings-store.ts`
  - Run:
    - `rg -n "PBX|pbx" frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx frontend/src/features/settings/store/app-settings-store.ts`
  - Expected:
    - Labels, placeholder text, and default names are either consistently renamed or explicitly documented as deferred if internal IDs stay as-is.
  - Commit intent:
    - prevent a split vocabulary between settings and scenario builder
  - Verification result:
    - 완료. `sip-instance-properties.tsx`와 `sip-instance-node.tsx`를 다시 써서 `Unnamed PBX`, `PBX Instance`, helper copy 등을 `SIP` 중심 표현으로 맞췄다. store 기본 표시명도 `SIP 1`로 변경했다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - internal store key names may remain `pbxInstances` if a user-facing rename is sufficient for now.
- [x] Decide whether `/settings/pbx` remains as a stable internal route or should be renamed/redirected to a SIP route.
  - Files:
    - `frontend/src/routes/settings.index.tsx`
    - `frontend/src/routes/settings.pbx.tsx`
    - `frontend/src/router-types.ts`
    - `frontend/src/layouts/app-sidebar.tsx`
  - Run:
    - `rg -n "/settings/pbx|SettingsTab = 'pbx'|to=\"/settings/pbx\"" frontend/src/routes/settings.index.tsx frontend/src/routes/settings.pbx.tsx frontend/src/router-types.ts frontend/src/layouts/app-sidebar.tsx`
  - Expected:
    - The plan can record whether route/file renaming is part of this task or deliberately deferred behind UI-label cleanup.
  - Commit intent:
    - avoid hidden navigation regressions while changing the settings IA label
  - Verification result:
    - 완료. `/settings/pbx` 경로와 internal `pbx` tab id는 유지하고, `/settings` 기본 진입은 `/settings/general`로 변경했다. sidebar settings 버튼도 `/settings/general`로 이동하도록 바꿨다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - default assumption: keep `/settings/pbx` path stable in this pass unless the route rename is cheap and testable.

## Task 4: Verify UI Contract And Prepare Finish Handoff
**Parallelizable:** No
**Owner:** main implementer
**Status:** done
**Entry criteria:**
- Tasks 2~3 edits are applied.
**Exit criteria:**
- Theme/general UI and SIP naming changes are verified.
- Active plan contains enough evidence for finish.

- [x] Re-run the directly affected component tests or keep them unchanged only if the copy/layout changes do not invalidate them.
  - Files:
    - `frontend/src/components/ui/theme-toggle.test.tsx`
    - `frontend/src/features/settings/components/settings-panel.test.tsx`
  - Run:
    - `.\\node_modules\\.bin\\vitest.cmd run src/components/ui/theme-toggle.test.tsx`
    - `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx`
  - Expected:
    - Theme toggle rendering and settings panel behavior still pass after relocation and copy updates.
  - Commit intent:
    - keep UI relocation honest with lightweight test coverage
  - Verification result:
    - 완료. `.\\node_modules\\.bin\\vitest.cmd run src/components/ui/theme-toggle.test.tsx src/features/settings/components/settings-panel.test.tsx src/layouts/app-sidebar.test.tsx src/layouts/app-sidebar-guard.test.tsx` 실행 결과 `Test Files 4 passed`, `Tests 7 passed`.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - sidebar settings target이 `/settings/general`로 바뀌어서 관련 sidebar tests도 함께 갱신/실행했다.
- [x] Run the frontend build and capture the diff for all settings IA changes.
  - Files:
    - `frontend/src/layouts/settings-layout.tsx`
    - `frontend/src/components/ui/theme-toggle.tsx`
    - `frontend/src/routes/settings.general.tsx`
    - `frontend/src/routes/settings.pbx.tsx`
    - `frontend/src/routes/settings.index.tsx`
    - `frontend/src/router-types.ts`
    - `frontend/src/features/settings/components/settings-panel.tsx`
    - `frontend/src/features/settings/store/app-settings-store.ts`
    - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
    - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
    - `docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
  - Run:
    - `npm.cmd --prefix frontend run build`
    - `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/components/ui/theme-toggle.tsx frontend/src/routes/settings.general.tsx frontend/src/routes/settings.pbx.tsx frontend/src/routes/settings.index.tsx frontend/src/router-types.ts frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/store/app-settings-store.ts frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
  - Expected:
    - The build passes and the diff stays inside settings/theme/SIP IA scope.
  - Commit intent:
    - close the IA cleanup with explicit verification evidence
  - Verification result:
    - 완료. `npm.cmd --prefix frontend run build`가 성공했고, 변경 diff는 settings shell, General/SIP routes, settings panel, scenario-builder SIP labels, sidebar target, active plan 범위 안에 머물렀다.
  - Commit evidence:
    - not committed in this session
  - Notes:
    - route path 자체는 유지해서 router regeneration은 하지 않았다.

## Integration
- `settings-layout.tsx` owns shell-level navigation and should stop acting as the place where app defaults are changed.
- `settings.general.tsx` becomes the landing area for user-facing defaults such as theme.
- existing `PBX` surface area spans settings, route labels, default names, and scenario-builder helper text; those must be reconciled together or deliberately deferred.
- route/path renaming is the highest-risk subtask here; it should be kept separate from simple user-facing copy changes unless it is clearly bounded.

## Execution Progress Summary
- Completed tasks:
  - Task 1: theme move scope and SIP rename boundary fixed
  - Task 2: theme control moved into General settings
  - Task 3: user-facing PBX labels realigned to SIP
  - Task 4: tests and build verification completed
- In-progress tasks:
  - none
- Open blockers:
  - none

**Ready for finish:** yes

## Finish Entry Criteria
- settings header no longer renders the theme toggle.
- General tab exposes theme selection in a real settings section.
- settings/user-facing copy reads as `SIP` consistently enough that users do not see competing `PBX` vs `SIP` labels for the same concept.
- route/copy decisions around `/settings/pbx` are explicit and documented.
- relevant vitest/build verification has been run and recorded.

## Handoff to Finish
- Verification evidence:
  - `.\\node_modules\\.bin\\vitest.cmd run src/components/ui/theme-toggle.test.tsx src/features/settings/components/settings-panel.test.tsx src/layouts/app-sidebar.test.tsx src/layouts/app-sidebar-guard.test.tsx` -> `Test Files 4 passed`, `Tests 7 passed`
  - `npm.cmd --prefix frontend run build` -> `vite v5.4.21 building for production...`, `✓ built in 3.56s`
- Commit list:
  - none in this session
- Docs updated:
  - `docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
  - `frontend/src/layouts/settings-layout.tsx`
  - `frontend/src/routes/settings.general.tsx`
  - `frontend/src/routes/settings.pbx.tsx`
  - `frontend/src/routes/settings.index.tsx`
  - `frontend/src/routes/settings.media.tsx`
  - `frontend/src/layouts/app-sidebar.tsx`
  - `frontend/src/features/settings/components/settings-panel.tsx`
  - `frontend/src/features/settings/store/app-settings-store.ts`
  - `frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx`
  - `frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx`
  - `frontend/src/features/settings/components/settings-panel.test.tsx`
  - `frontend/src/layouts/app-sidebar.test.tsx`
  - `frontend/src/layouts/app-sidebar-guard.test.tsx`
- Follow-up candidates:
  - full internal `pbx*` -> `sip*` rename if UI-label cleanup is not sufficient
  - richer General preferences beyond theme selection
  - separate media/settings IA pass if General and SIP cleanup reveals more structural gaps

## Verification
- `.\\node_modules\\.bin\\vitest.cmd run src/components/ui/theme-toggle.test.tsx`
  - Expected: relocated theme selector behavior still renders and responds correctly.
- `.\\node_modules\\.bin\\vitest.cmd run src/features/settings/components/settings-panel.test.tsx`
  - Expected: SIP settings panel behavior stays green after copy/label updates.
- `npm.cmd --prefix frontend run build`
  - Expected: settings IA changes ship without frontend build regressions.
- `git diff -- frontend/src/layouts/settings-layout.tsx frontend/src/components/ui/theme-toggle.tsx frontend/src/routes/settings.general.tsx frontend/src/routes/settings.pbx.tsx frontend/src/routes/settings.index.tsx frontend/src/router-types.ts frontend/src/features/settings/components/settings-panel.tsx frontend/src/features/settings/store/app-settings-store.ts frontend/src/features/scenario/builder/components/properties/sip-instance-properties.tsx frontend/src/features/scenario/builder/components/nodes/sip-instance-node.tsx docs/exec-plans/active/2026-03-20-settings-general-theme-and-sip-ia.md`
  - Expected: diff stays within theme relocation and SIP IA scope.

## Risks / Assumptions
- `PBX -> SIP` may mean UI-only relabeling or full route/store rename; this plan assumes UI-first cleanup and treats broader renaming as conditional.
- settings shell currently exposes a quick theme toggle while flow toolbar also has one; this plan assumes only the settings-shell toggle is moving to General.
- route path renaming would touch generated router files and navigation tests, so it should not be done casually inside an otherwise UI-only pass.
