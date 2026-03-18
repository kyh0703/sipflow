---
phase: 05-ui-completion
plan: 02
subsystem: ui
tags: [zustand, autosave, debounce, sonner, react, typescript]

# Dependency graph
requires:
  - phase: 05-01
    provides: ThemeProvider, ThemeToggle, 다크모드 지원
  - phase: 04-02
    provides: Sonner toast 전면 도입
  - phase: 03-05
    provides: Zustand store 패턴
  - phase: 02-02
    provides: SaveScenario Wails 바인딩
provides:
  - Zustand subscribe 기반 자동 저장 시스템
  - 2000ms debounce로 변경사항 자동 저장
  - saveStatus 상태 ('saved' | 'modified' | 'saving')
  - 드래그 중 저장 방지, 드래그 완료 후 저장
  - 헤더 저장 상태 인디케이터 (Check/Circle/Loader2 아이콘)
  - saveNow 액션으로 수동 저장 + debounce 취소
affects: [06-polish, ux-refinement, state-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand subscribe 외부 모듈 스코프에서 호출"
    - "인라인 debounce 유틸리티 (외부 의존성 불필요)"
    - "Wails 바인딩 직접 import (hooks 아님)"
    - "saveStatus와 isDirty 분리 관리"
    - "onNodesChange에서 position 변경 분리"
    - "시나리오 전환 시 pending autosave 취소"

key-files:
  created: []
  modified:
    - frontend/src/features/scenario-builder/store/scenario-store.ts
    - frontend/src/features/scenario-builder/components/scenario-builder.tsx
    - frontend/src/features/scenario-builder/components/canvas.tsx

key-decisions:
  - "2000ms debounce 딜레이 (AUTOSAVE_DEBOUNCE_MS)"
  - "saveStatus를 isDirty와 별도 관리 (변경 추적 vs 저장 상태)"
  - "onNodesChange에서 position 변경 무시, onNodeDragStop에서 isDirty 설정"
  - "인라인 debounce 구현 (lodash/use-debounce 불필요)"
  - "SaveScenario를 Wails 바인딩에서 직접 import (store 외부에서 사용)"
  - "Sonner toast로 alert() 전면 교체"

patterns-established:
  - "Zustand subscribe를 store 정의 파일 하단에서 호출 (모듈 로드 시 1회)"
  - "debounce 함수를 모듈 스코프에서 생성 (React 렌더 외부)"
  - "시나리오 전환 시 debouncedSave.cancel() 호출로 pending save 취소"
  - "saveNow 액션: debounce 취소 후 즉시 저장 (Ctrl+S 처리)"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 05-02: Zustand 자동 저장 Summary

**Zustand subscribe + 2000ms debounce로 자동 저장, 드래그 완료 후 저장, 헤더 저장 상태 인디케이터 (Check/Circle/Loader2)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T02:27:55Z
- **Completed:** 2026-02-11T02:31:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Zustand subscribe 기반 자동 저장 시스템 구축 (2000ms debounce)
- 노드 드래그 중 저장 방지, 드래그 완료 후에만 저장
- 헤더 저장 상태 인디케이터 3가지 (saved/modified/saving)
- Ctrl+S 수동 저장 시 debounce 취소 후 즉시 저장
- Sonner toast로 alert() 전면 교체

## Task Commits

Each task was committed atomically:

1. **Task 1: 자동 저장 subscribe 로직 + 드래그 방지 + saveStatus 상태** - `1f5bcc3` (feat)
2. **Task 2: 헤더 저장 상태 인디케이터 UI** - `543bd23` (feat)

## Files Created/Modified

- `frontend/src/features/scenario-builder/store/scenario-store.ts`
  - saveStatus 상태 추가 ('saved' | 'modified' | 'saving')
  - 인라인 debounce 유틸리티 구현
  - useScenarioStore.subscribe로 isDirty 감지 → 자동 저장
  - SaveScenario Wails 바인딩 직접 import
  - setSaveStatus, saveNow 액션 추가
  - onNodesChange: position 변경 시 isDirty 설정 안 함
  - setCurrentScenario: 시나리오 전환 시 debouncedSave.cancel()

- `frontend/src/features/scenario-builder/components/canvas.tsx`
  - onNodeDragStop 핸들러 추가 (드래그 완료 후 isDirty 설정)
  - Ctrl+S 단축키: saveNow 호출, toast 사용

- `frontend/src/features/scenario-builder/components/scenario-builder.tsx`
  - saveStatus 기반 인디케이터 UI (Check/Circle/Loader2 아이콘)
  - handleSave: saveNow 호출, toast 사용
  - alert() → toast.error/success 교체

## Decisions Made

1. **AUTOSAVE_DEBOUNCE_MS: 2000ms**
   - 계획에서 "사용자 결정 1-2초 범위 내" → 2000ms 채택

2. **saveStatus와 isDirty 분리**
   - isDirty: 변경 추적용 (boolean)
   - saveStatus: 저장 진행/완료 상태용 ('saved' | 'modified' | 'saving')
   - 분리하여 UI에서 저장 프로세스 명확히 표시

3. **position 변경 분리**
   - onNodesChange: position 변경 시 isDirty 설정 안 함 (드래그 중 저장 방지)
   - onNodeDragStop: 드래그 완료 시 isDirty 설정

4. **인라인 debounce 구현**
   - lodash, use-debounce 등 외부 의존성 추가 없이 인라인 구현
   - cancel 메서드 포함하여 수동 저장 시 pending save 취소 가능

5. **Wails 바인딩 직접 import**
   - hooks 대신 Wails 바인딩에서 SaveScenario 직접 import
   - store 외부에서 호출하므로 Wails API 직접 사용

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- 자동 저장 시스템 완료, 사용자 경험 크게 개선
- 저장 상태 인디케이터로 사용자 피드백 명확
- Phase 05-03 (E2E 테스트 + 빌드 검증) 이미 완료
- UI Completion 페이즈 거의 완료 (20/21 plans)

## Self-Check: PASSED

All files and commits verified successfully.

---
*Phase: 05-ui-completion*
*Completed: 2026-02-11*
