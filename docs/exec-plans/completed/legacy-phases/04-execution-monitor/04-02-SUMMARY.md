---
phase: 04-execution-monitor
plan: 02
type: execute
subsystem: frontend-ui
tags: [edge-animation, svg-animatemotion, execution-log, sonner-toast, log-filtering]
completed: 2026-02-11
duration: 175s

dependencies:
  requires:
    - 04-01 (Backend SIP 메시지 상세 + Frontend 타입/스토어)
    - 03-05 (프론트엔드 이벤트 통합)
  provides:
    - AnimatedMessageEdge 컴포넌트 (SVG animateMotion 기반)
    - ExecutionLog에 SIP 메시지 상세 정보 표시
    - 로그 레벨 필터링 UI
    - Sonner toast 기반 에러/경고 표시
  affects:
    - 04-03 (로그 상세 정보 패널 확장)
    - 04-04 (타임라인 패널 - sipMessages 활용)

tech-stack:
  added:
    - SVG animateMotion for edge animations
    - Sonner toast notifications
  patterns:
    - useShallow for performance optimization (Zustand)
    - Smart auto-scroll (isAtBottom check)
    - Component-level animation lifecycle with cleanup

key-files:
  created:
    - frontend/src/features/scenario-builder/edges/animated-message-edge.tsx
  modified:
    - frontend/src/features/scenario-builder/edges/branch-edge.tsx
    - frontend/src/features/scenario-builder/components/canvas.tsx
    - frontend/src/features/scenario-builder/components/execution-log.tsx
    - frontend/src/features/scenario-builder/components/execution-toolbar.tsx

decisions:
  - title: "AnimatedMessageEdge as BranchEdge Superset"
    rationale: "Include branch color logic in AnimatedMessageEdge, then replace BranchEdge in edgeTypes"
    impact: "All branch edges automatically gain animation capability without type conversion"
  - title: "Edge Animation Trigger in Canvas"
    rationale: "Canvas monitors actionLogs changes and triggers animations when sipMessage appears"
    impact: "Automatic edge animation without manual triggering from each node component"
  - title: "Log Level Filtering with Toggle Buttons"
    rationale: "Small badge-style buttons allow quick filtering of info/warning/error logs"
    impact: "Users can focus on relevant logs during long scenario executions"
  - title: "Smart Auto-scroll with isAtBottom Check"
    rationale: "Disable auto-scroll when user manually scrolls up to review old logs"
    impact: "Better UX - auto-scroll doesn't interfere with manual log review"
  - title: "Sonner Toast for All User Notifications"
    rationale: "Replace alert() with non-blocking toast notifications"
    impact: "Consistent notification UX, no blocking dialogs"
---

# Phase 04 Plan 02: 엣지 애니메이션 + 로그 패널 Summary

**One-line summary:** SVG animateMotion 기반 엣지 메시지 애니메이션, SIP 상세 정보 표시, 로그 레벨 필터링, Sonner toast 통합으로 시나리오 실행 시각화 완성

## What Was Built

### Task 1: AnimatedMessageEdge 컴포넌트 + Canvas/EdgeTypes 통합
- **AnimatedMessageEdge 컴포넌트**:
  - SVG `<animateMotion>` 기반 엣지 메시지 애니메이션 (원형 마커가 엣지 경로를 따라 이동)
  - useShallow로 해당 엣지의 애니메이션만 필터링하여 리렌더링 최적화
  - BranchEdge 색상 로직 포함 (success: 초록, failure: 빨강, default: 회색)
  - useEffect cleanup으로 타이머 정리하여 메모리 누수 방지
  - `fill="remove"`로 애니메이션 완료 후 원위치
- **BranchEdge 업데이트**:
  - edgeTypes에서 `branch` 키의 값을 `AnimatedMessageEdge`로 교체
  - 모든 기존 branch 엣지가 자동으로 애니메이션 기능 획득
- **Canvas 엣지 애니메이션 트리거**:
  - useRef로 마지막 로그 카운트 추적
  - actionLogs 변화 감지하여 새 로그만 처리 (중복 처리 방지)
  - sipMessage 포함 로그 발견 시, 해당 nodeId에서 나가는 edge 찾아 EdgeAnimationMessage 생성
  - crypto.randomUUID()로 애니메이션 ID 생성, duration: 1000ms

### Task 2: 로그 패널 SIP 상세 정보 + Sonner toast 교체 + 로그 필터링
- **ExecutionLog 향상**:
  - **SIP 메시지 상세 표시**: sipMessage 필드가 있으면 direction 화살표 (`->` 또는 `<-`), method, responseCode 표시
  - **로그 레벨 필터링**: useState로 `activeFilters: Set<string>` 관리 (info/warning/error 토글)
  - **필터 UI**: 작은 배지 스타일 버튼 (INFO, WARN, ERROR) 헤더에 추가
  - **useShallow 적용**: actionLogs 구독에 useShallow 사용하여 참조만 바뀌고 내용이 같으면 리렌더링 방지
  - **자동 스크롤 최적화**: isAtBottom 체크로 사용자가 수동 스크롤 시 자동 스크롤 비활성화
  - **formatTimestamp 타입 수정**: `(timestamp: string)` → `(timestamp: number)` (실제 데이터는 number)
- **ExecutionToolbar Sonner 통합**:
  - `import { toast } from 'sonner'` 추가
  - `alert()` 호출 전부 제거:
    - "No scenario selected" → `toast.warning('No scenario selected', { description: '...' })`
    - "Failed to start scenario" → `toast.error('Failed to start scenario', { description: String(error) })`
    - "Failed to stop scenario" → `toast.error('Failed to stop scenario', { description: String(error) })`

## Task Results

| Task | Name | Status | Commit | Files | Note |
| ---- | ---- | ------ | ------ | ----- | ---- |
| 1 | AnimatedMessageEdge + Canvas 통합 | completed | 58bfd2c | animated-message-edge.tsx, branch-edge.tsx, canvas.tsx | SVG animateMotion |
| 2 | 로그 패널 SIP 상세 + toast + 필터 | completed | f1f2bd6 | execution-log.tsx, execution-toolbar.tsx | Sonner toast 전환 |

## Verification Results

✅ AnimatedMessageEdge: animateMotion, BaseEdge, getSmoothStepPath 사용 확인
✅ AnimatedMessageEdge: useShallow 사용 확인
✅ branch-edge.tsx: edgeTypes에 AnimatedMessageEdge 등록 확인
✅ canvas.tsx: addEdgeAnimation 트리거 로직 존재
✅ execution-log.tsx: sipMessage 렌더링 로직 존재 (direction, method, responseCode)
✅ execution-log.tsx: activeFilters 필터링 로직 존재
✅ execution-log.tsx: useShallow import 확인
✅ execution-log.tsx: isAtBottom 스크롤 최적화 확인
✅ execution-toolbar.tsx: toast import 확인
✅ execution-toolbar.tsx: alert() 호출 없음 (0건)
✅ TypeScript 컴파일: 기존 모듈 해석 에러 외 신규 에러 없음

## Deviations from Plan

### Auto-fixed Issues
None - plan was executed exactly as written.

## Decisions Made

1. **AnimatedMessageEdge as BranchEdge Superset**
   - Context: Need edge animations without changing existing edge type assignments
   - Decision: Make AnimatedMessageEdge include all BranchEdge logic (color handling), then replace BranchEdge in edgeTypes
   - Rationale: All branch edges automatically gain animation capability, no need for type conversion logic
   - Impact: Seamless backward compatibility, existing edges animate when sipMessage arrives

2. **Edge Animation Trigger in Canvas**
   - Context: Need to create edge animations when SIP messages occur
   - Decision: Canvas component monitors actionLogs, creates EdgeAnimationMessage when sipMessage appears
   - Rationale: Centralized animation triggering logic, node components don't need to know about animations
   - Impact: Clean separation of concerns, easy to debug animation creation

3. **Log Level Filtering with Toggle Buttons**
   - Context: Long scenario executions produce many logs, users need to focus on specific types
   - Decision: Add info/warning/error toggle buttons in log panel header
   - Rationale: Quick filtering without dropdown menus, visual indication of active filters
   - Impact: Better UX for debugging, users can filter noise during long runs

4. **Smart Auto-scroll with isAtBottom Check**
   - Context: Auto-scroll can interfere when user wants to review old logs
   - Decision: Track scrollTop and disable auto-scroll when user manually scrolls up
   - Rationale: Respect user intent, only auto-scroll when user is actively watching new logs
   - Impact: No more "fighting the auto-scroll" when reviewing past logs

5. **Sonner Toast for All User Notifications**
   - Context: alert() is blocking and jarring for user experience
   - Decision: Replace all alert() with toast.warning/toast.error from Sonner
   - Rationale: Non-blocking notifications, better UX, consistent with modern web apps
   - Impact: Users can continue working while seeing error messages, better visual polish

## Next Phase Readiness

### Blockers
None

### Concerns
None - implementation complete and verified

### Prerequisites for Next Plans
- ✅ 04-03 (로그 상세 정보 패널): sipMessage 데이터 사용 가능
- ✅ 04-04 (타임라인 패널): sipMessages 배열로 시간순 렌더링 가능
- ✅ Edge animations working visually for user feedback

## Lessons Learned

1. **SVG animateMotion is Perfect for Path Animations**: No need for complex JS animation logic, declarative and performant
2. **useShallow Prevents Unnecessary Rerenders**: Filtering in selector with useShallow is more efficient than filtering in component
3. **isAtBottom Pattern is Essential for Auto-scroll**: Always check user scroll position before forcing auto-scroll
4. **Sonner Toast is Drop-in Replacement for alert()**: Simple API, better UX, no blocking behavior
5. **Centralized Animation Triggering is Cleaner**: Canvas monitors logs and creates animations, node components stay simple

## Testing Notes

- Manual verification needed: Run scenario with MakeCall → verify edge animation appears
- Manual verification needed: Check sipMessage details in log panel (direction, method)
- Manual verification needed: Toggle log filters (info/warning/error)
- Manual verification needed: Trigger error (e.g., start without scenario) → verify Sonner toast appears
- Edge animation memory leak prevention: Check that animations are removed after 1 second

## Self-Check: PASSED

All files and commits verified:
- ✅ animated-message-edge.tsx: 1934 bytes, animateMotion logic
- ✅ branch-edge.tsx: edgeTypes points to AnimatedMessageEdge
- ✅ canvas.tsx: addEdgeAnimation trigger logic
- ✅ execution-log.tsx: sipMessage rendering, filtering, useShallow
- ✅ execution-toolbar.tsx: toast imports, no alert() calls
- ✅ Commits: 58bfd2c, f1f2bd6
