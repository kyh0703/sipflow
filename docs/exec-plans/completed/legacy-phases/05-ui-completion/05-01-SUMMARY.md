---
phase: 05-ui-completion
plan: 01
subsystem: ui
tags: [dark-mode, theme, next-themes, accessibility]

dependencies:
  requires: []
  provides:
    - next-themes ThemeProvider 설정
    - 3-way 테마 토글 (Light/Dark/System)
    - localStorage 기반 테마 지속성
  affects:
    - 05-02-PLAN.md
    - 05-03-PLAN.md

tech-stack:
  added: []
  patterns:
    - next-themes useTheme hook
    - mounted 가드 패턴
    - CSS variable 기반 테마 전환

key-files:
  created:
    - frontend/src/components/ui/theme-toggle.tsx
  modified:
    - frontend/src/main.tsx
    - frontend/src/features/scenario-builder/components/scenario-builder.tsx
    - frontend/src/features/scenario-builder/components/canvas.tsx

decisions:
  - title: "next-themes 기반 다크모드 구현"
    rationale: "이미 설치된 next-themes를 활용, Sonner와 테마 컨텍스트 공유"
    alternatives: ["직접 구현", "다른 테마 라이브러리"]
    impact: "전역 테마 컨텍스트로 모든 컴포넌트 자동 연동"
  - title: "3-way 순환 토글 패턴"
    rationale: "Light → Dark → System 순환으로 직관적인 UX"
    alternatives: ["드롭다운 선택", "2-way 토글"]
    impact: "단일 버튼 클릭으로 모든 테마 접근 가능"
  - title: "resolvedTheme으로 배경색 조건 분기"
    rationale: "System 모드에서도 실제 적용 테마 확인 필요"
    alternatives: ["CSS variable만 사용"]
    impact: "ReactFlow Background 컴포넌트 다크모드 대응"

metrics:
  duration: "2분"
  completed: "2026-02-11"
---

# Phase 05 Plan 01: 다크모드 (Light/Dark/System) Summary

next-themes 기반 ThemeProvider 설정 및 헤더 테마 토글로 Light/Dark/System 3-way 전환 지원

## Objective

next-themes 기반 다크모드를 구현하여 Light/Dark/System 3가지 테마 모드를 지원한다. 사용자가 OS 설정에 따라 자동으로 적절한 테마를 사용하거나 수동으로 전환할 수 있게 한다.

## Execution Summary

### Completed Tasks

| Task | Name | Status | Commit | Files |
|------|------|--------|--------|-------|
| 1 | ThemeProvider 설정 + ThemeToggle 컴포넌트 생성 | completed | 52d35ed | main.tsx, theme-toggle.tsx |
| 2 | 헤더 바에 ThemeToggle 배치 + 다크모드 시각 검증 | completed | 593630f | scenario-builder.tsx, canvas.tsx |

### Task Details

**Task 1: ThemeProvider 설정 + ThemeToggle 컴포넌트 생성**
- main.tsx에 ThemeProvider 래핑 추가
  - `attribute="class"`, `defaultTheme="system"`, `enableSystem`
  - `disableTransitionOnChange`로 깜빡임 없는 즉시 전환
  - `storageKey="sipflow-theme"`, `themes={['light', 'dark']}`
- theme-toggle.tsx 생성
  - useTheme hook으로 theme, setTheme 획득
  - Light → Dark → System 순환 로직
  - Sun/Moon/Monitor 아이콘으로 현재 테마 시각 표시
  - mounted 가드로 초기 렌더링 이슈 방지
  - shadcn/ui Button: `variant="ghost"`, `size="icon"`
  - 접근성: title 속성, sr-only 레이블

**Task 2: 헤더 바에 ThemeToggle 배치 + 다크모드 시각 검증**
- scenario-builder.tsx: ThemeToggle을 헤더 우측 Save 버튼 뒤에 배치
- canvas.tsx: useTheme의 resolvedTheme으로 배경색 조건부 설정
  - 다크모드: #52525b (gray-600)
  - 라이트모드: #d1d5db (gray-300)
  - System 모드에서도 실제 적용 테마 반영
- shadcn/ui 컴포넌트들은 CSS variable 기반이므로 자동 다크모드 지원

## Decisions Made

### 1. next-themes 기반 다크모드 구현
**Context:** 이미 next-themes가 설치되어 Sonner에서 사용 중
**Decision:** next-themes를 앱 전체에 확장, ThemeProvider로 전역 테마 컨텍스트 제공
**Rationale:**
- 이미 설치된 의존성 재사용
- Sonner와 테마 컨텍스트 자동 공유
- localStorage 지속성 내장
**Trade-offs:**
- 장점: 통합 간편, 표준 패턴
- 단점: 추가 의존성 (이미 존재하므로 무관)

### 2. 3-way 순환 토글 패턴
**Context:** Light/Dark/System 3가지 모드 지원 필요
**Decision:** 단일 버튼 클릭으로 Light → Dark → System 순환
**Rationale:**
- 직관적인 UX: 아이콘으로 현재 상태 명확히 표시
- 공간 효율: 헤더 바에 단일 버튼만 차지
- 접근성: title 속성으로 툴팁 제공
**Trade-offs:**
- 장점: 간결, 빠른 전환
- 단점: 3번 클릭 필요 (원하는 테마까지), 드롭다운보다 덜 명시적

### 3. resolvedTheme으로 배경색 조건 분기
**Context:** ReactFlow Background 컴포넌트가 CSS variable을 color prop에 직접 사용 불가
**Decision:** useTheme의 resolvedTheme으로 실제 적용 테마 감지 후 하드코딩된 색상값 전달
**Rationale:**
- System 모드에서도 실제 다크/라이트 테마 확인 필요
- Background 컴포넌트 API 제약
**Trade-offs:**
- 장점: System 모드 정확 처리
- 단점: 하드코딩된 색상값 (CSS variable 미사용)

## Implementation Highlights

### ThemeProvider 설정
```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
  storageKey="sipflow-theme"
  themes={['light', 'dark']}
>
  <App/>
</ThemeProvider>
```

### 3-way 순환 토글
```tsx
const cycleTheme = () => {
  if (theme === 'light') {
    setTheme('dark')
  } else if (theme === 'dark') {
    setTheme('system')
  } else {
    setTheme('light')
  }
}
```

### 다크모드 배경색 대응
```tsx
const { resolvedTheme } = useTheme();
const backgroundColor = resolvedTheme === 'dark' ? '#52525b' : '#d1d5db';
<Background variant={BackgroundVariant.Dots} gap={20} size={1} color={backgroundColor} />
```

## Deviations from Plan

없음 - 계획이 작성된 대로 정확히 실행됨.

## Verification Results

모든 검증 기준 충족:
- [x] ThemeProvider가 main.tsx에서 앱 전체를 래핑
- [x] ThemeToggle 컴포넌트가 헤더 바 우측에 배치
- [x] Light/Dark/System 3가지 테마 전환 가능
- [x] 다크모드에서 모든 패널, 캔버스, 노드, 로그가 정상 렌더링
- [x] 테마 선택이 localStorage에 저장되어 새로고침 후에도 유지
- [x] Sonner toast가 현재 테마에 맞게 표시 (기존 연동 유지)

## Self-Check: PASSED

### Files Created
- frontend/src/components/ui/theme-toggle.tsx ✓

### Files Modified
- frontend/src/main.tsx ✓
- frontend/src/features/scenario-builder/components/scenario-builder.tsx ✓
- frontend/src/features/scenario-builder/components/canvas.tsx ✓

### Commits Verified
- 52d35ed ✓
- 593630f ✓

## Next Phase Readiness

**준비됨:** Phase 05-02 (헤더 개선 + 시나리오 관리) 실행 가능

**전달 사항:**
- ThemeToggle이 헤더 우측에 배치되어 헤더 레이아웃 확정
- 모든 UI 컴포넌트가 다크모드 지원 (CSS variable 기반)
- System 테마가 기본값으로 OS 설정 자동 추적

**이슈:** 없음

## Lessons Learned

1. **next-themes mounted 가드:** Wails 앱은 SSR이 없지만, useTheme의 초기값이 undefined일 수 있어 mounted 가드가 안전
2. **resolvedTheme vs theme:** System 모드에서 실제 적용 테마를 알려면 resolvedTheme 사용 필요
3. **disableTransitionOnChange:** 테마 전환 시 CSS transition 없이 즉시 전환으로 깜빡임 방지
4. **CSS variable 한계:** ReactFlow Background 같은 서드파티 컴포넌트는 하드코딩된 색상값 전달 필요

## Impact Assessment

- **UI/UX:** 사용자가 선호하는 테마 선택 가능, OS 설정 자동 추적으로 일관된 경험
- **코드:** ThemeProvider 전역 래핑으로 모든 컴포넌트 테마 컨텍스트 공유
- **성능:** 경량 (localStorage 읽기/쓰기만), CSS class 전환으로 즉시 반영
- **유지보수:** shadcn/ui CSS variable 패턴으로 향후 컴포넌트 추가 시 자동 다크모드 지원

## Artifact Links

- `frontend/src/main.tsx` — ThemeProvider 래핑
- `frontend/src/components/ui/theme-toggle.tsx` — 3-way 테마 토글 컴포넌트
- `frontend/src/features/scenario-builder/components/scenario-builder.tsx` — 헤더 ThemeToggle 배치
- `frontend/src/features/scenario-builder/components/canvas.tsx` — 다크모드 배경색 대응
