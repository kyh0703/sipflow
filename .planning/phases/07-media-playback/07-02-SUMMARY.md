---
phase: 07
plan: 02
subsystem: frontend
tags: [playaudio, ui, wails-binding, file-dialog, wav-validation]
dependencies:
  requires: [07-01]
  provides: [playaudio-frontend-ui, wav-file-selection]
  affects: [07-03]
tech-stack:
  added: []
  patterns: [wails-binding-pattern, toast-feedback, polymorphic-node-ui]
key-files:
  created:
    - frontend/wailsjs/go/binding/MediaBinding.js
    - frontend/wailsjs/go/binding/MediaBinding.d.ts
  modified:
    - frontend/src/features/scenario-builder/types/scenario.ts
    - frontend/src/features/scenario-builder/components/node-palette.tsx
    - frontend/src/features/scenario-builder/components/nodes/command-node.tsx
    - frontend/src/features/scenario-builder/components/properties/command-properties.tsx
    - frontend/wailsjs/go/models.ts
decisions:
  - slug: volume2-icon-for-playaudio
    choice: Volume2 (스피커) 아이콘 채택
    rationale: 오디오 재생의 직관적 시각 표현, lucide-react 표준 아이콘
    impact: 노드 팔레트 및 캔버스 일관성
  - slug: filepath-badge-display
    choice: 파일명만 표시, 전체 경로는 tooltip
    rationale: 긴 경로로 인한 UI 깨짐 방지, 사용자는 파일명만으로도 식별 가능
    impact: 캔버스 노드 및 Properties 패널 레이아웃
  - slug: immediate-toast-feedback
    choice: SelectWAVFile() 에러 시 즉시 toast 표시
    rationale: 파일 선택 직후 검증 피드백 제공, 실행 시점까지 기다리지 않음
    impact: UX 향상, 사용자가 즉시 올바른 파일 선택 가능
  - slug: isselecting-state
    choice: isSelecting 상태로 버튼 비활성화
    rationale: 다이얼로그 중복 열림 방지, 버튼 텍스트 "Selecting..." 표시
    impact: Properties 패널 버튼 상호작용
metrics:
  duration: 0h 5m 16s
  tasks_completed: 2
  checkpoints_passed: 1
  completed: 2026-02-12
---

# Phase 7 Plan 02: PlayAudio Frontend UI Summary

**한 줄 요약:** Volume2 아이콘 기반 PlayAudio 노드 UI 구현 — 팔레트 드래그, 캔버스 렌더링, Wails 네이티브 파일 다이얼로그, 8kHz mono PCM 검증 및 toast 피드백

## Overview

PlayAudio Command 노드의 전체 프론트엔드 파이프라인을 구현했습니다. 사용자는 노드 팔레트에서 PlayAudio를 드래그하여 캔버스에 배치하고, Properties 패널에서 WAV 파일을 선택할 수 있습니다. 선택된 파일은 즉시 8kHz mono PCM 포맷으로 검증되며, 검증 실패 시 toast 에러가 표시됩니다. 유효한 파일 선택 시 파일명이 캔버스 노드 배지와 Properties 패널에 표시됩니다.

## What Was Built

### Task 1: 타입 정의 + 팔레트 등록 + 캔버스 노드 렌더링

**변경된 파일:**
- `frontend/src/features/scenario-builder/types/scenario.ts`
- `frontend/src/features/scenario-builder/components/node-palette.tsx`
- `frontend/src/features/scenario-builder/components/nodes/command-node.tsx`

**구현 내용:**

1. **타입 시스템 확장:**
   - `COMMAND_TYPES`에 `'PlayAudio'` 추가
   - `CommandNodeData` 인터페이스에 `filePath?: string` 필드 추가 (WAV 파일 절대 경로 저장)

2. **노드 팔레트 등록:**
   - `Volume2` 아이콘 import (lucide-react)
   - Commands 섹션에 PlayAudio PaletteItem 추가
   - blue 계열 스타일 적용 (기존 Command 노드와 일관성)

3. **캔버스 노드 렌더링:**
   - `COMMAND_ICONS`에 `PlayAudio: Volume2` 매핑
   - `data.filePath` 존재 시 파일명 배지 표시
   - 배지는 최대 140px로 truncate, `title` 속성으로 전체 경로 tooltip 제공
   - 경로 구분자(`/` 또는 `\`) 기준으로 파일명만 추출

**검증:**
- `npm run build` 성공 (TypeScript 컴파일 에러 없음)
- PlayAudio가 COMMAND_TYPES에 포함됨

### Task 2: Properties 패널 파일 선택 UI + Wails 바인딩 연동

**변경된 파일:**
- `frontend/src/features/scenario-builder/components/properties/command-properties.tsx`
- `frontend/wailsjs/go/binding/MediaBinding.js` (자동 생성)
- `frontend/wailsjs/go/binding/MediaBinding.d.ts` (자동 생성)
- `frontend/wailsjs/go/models.ts` (자동 업데이트)

**구현 내용:**

1. **파일 선택 핸들러:**
   ```typescript
   const handleSelectAudioFile = async () => {
     setIsSelecting(true);
     try {
       const filePath = await SelectWAVFile();
       if (!filePath) return;
       onUpdate({ filePath });
       toast.success('Audio file selected');
     } catch (err: any) {
       toast.error(`Invalid WAV file: ${err?.message || err}`);
     } finally {
       setIsSelecting(false);
     }
   };
   ```

2. **PlayAudio 전용 UI:**
   - **파일 미선택 시:** "Select File" 버튼 표시
   - **파일 선택 후:** 파일명 Badge + "Change" 버튼 표시
   - **버튼 상태:** `isSelecting` 상태로 "Selecting..." 텍스트 및 비활성화
   - **안내 문구:** "Required: 8kHz mono PCM WAV format"

3. **Wails 바인딩:**
   - `SelectWAVFile()` 호출로 네이티브 파일 다이얼로그 열기
   - 백엔드에서 즉시 WAV 검증 수행 (8kHz mono PCM)
   - 검증 실패 시 에러 throw → toast 에러 표시
   - 검증 성공 시 파일 경로 반환 → toast 성공 메시지

**검증:**
- `npm run build` 성공
- `command-properties.tsx`에 PlayAudio 분기 및 SelectWAVFile import 존재
- Wails 바인딩 파일 자동 생성 완료

### Task 3: human-verify Checkpoint

**검증 항목:**
1. PlayAudio가 노드 팔레트에 Volume2 아이콘과 함께 표시됨
2. 캔버스에 드래그 앤 드롭 가능, blue 스타일 렌더링
3. Properties 패널에서 "Select File" 버튼 확인
4. 파일 선택 클릭 시 OS 네이티브 다이얼로그 열림
5. 잘못된 WAV 선택 시 toast 에러 표시, filePath 저장 안 됨
6. 유효한 WAV 선택 시 파일명 Badge 및 캔버스 배지 표시
7. 파일명 hover 시 전체 경로 tooltip
8. 시나리오 저장/로드 시 filePath 유지
9. 버튼이 다이얼로그 열림 중 "Selecting..." 상태 표시

**결과:** ✅ 사용자 승인 완료

## Deviations from Plan

### Auto-fixed Issues

**1. [규칙 3 - 차단] Wails 바인딩 파일 미생성**

- **발견 시점:** Task 2 빌드 시
- **이슈:** `frontend/wailsjs/go/binding/MediaBinding.js` 파일이 존재하지 않아 TypeScript 컴파일 에러 발생
- **수정:** `wails dev -noreload`를 짧게 실행하여 Wails 바인딩 자동 생성 트리거
- **수정된 파일:** `MediaBinding.js`, `MediaBinding.d.ts` (자동 생성)
- **커밋:** Task 2 커밋에 포함 (e2d2be1)

**이유:** Wails는 바인딩 파일을 실행 시점에 자동 생성하므로, 한 번 실행하여 생성 필요. 이것은 정상적인 Wails 워크플로우입니다.

## Task Commits

| Task | Name | Status | Commit | Files |
|------|------|--------|--------|-------|
| 1 | 타입 정의 + 팔레트 등록 + 캔버스 노드 렌더링 | completed | 85532fe | scenario.ts, node-palette.tsx, command-node.tsx |
| 2 | Properties 패널 파일 선택 UI + Wails 바인딩 연동 | completed | e2d2be1 | command-properties.tsx, MediaBinding.js, MediaBinding.d.ts, models.ts |
| 3 | human-verify checkpoint | approved | — | — |

## Decisions Made

### 1. Volume2 아이콘 채택

**컨텍스트:** PlayAudio 노드의 시각적 표현

**결정:** lucide-react `Volume2` (스피커) 아이콘 사용

**이유:**
- 오디오 재생의 직관적 시각 표현
- 기존 Command 노드 아이콘 패턴 (Phone, PhoneIncoming, PhoneOff)과 일관성
- lucide-react 표준 아이콘으로 추가 의존성 없음

**영향:**
- 노드 팔레트 Commands 섹션에 일관된 아이콘 세트
- 캔버스에서 PlayAudio 노드 즉시 식별 가능

### 2. 파일명만 표시, 전체 경로는 Tooltip

**컨텍스트:** 캔버스 노드 및 Properties 패널에 filePath 표시

**결정:**
- 파일명만 화면에 표시 (`filePath.split(/[\\/]/).pop()`)
- 전체 절대 경로는 `title` 속성으로 tooltip 제공

**이유:**
- 긴 절대 경로로 인한 노드 레이아웃 깨짐 방지
- 사용자는 일반적으로 파일명만으로도 식별 가능
- 필요 시 마우스 hover로 전체 경로 확인 가능

**영향:**
- 캔버스 노드: 최대 140px truncate, 깔끔한 배지 표시
- Properties 패널: 최대 200px truncate Badge

### 3. 즉시 Toast 피드백

**컨텍스트:** WAV 파일 검증 실패 처리

**결정:** `SelectWAVFile()` 에러 시 즉시 toast 에러 표시

**이유:**
- 파일 선택 직후 검증 피드백 제공 (실행 시점까지 기다리지 않음)
- 사용자가 즉시 다른 파일 선택 가능
- 07-01에서 구현된 백엔드 즉시 검증 패턴과 일관성

**영향:**
- UX 향상: 잘못된 파일 선택 시 즉시 알림
- 실행 시점 에러 방지 (유효한 파일만 filePath에 저장됨)

### 4. isSelecting 상태 관리

**컨텍스트:** 파일 다이얼로그 중복 열림 방지

**결정:** `isSelecting` useState로 버튼 비활성화 및 "Selecting..." 텍스트 표시

**이유:**
- 다이얼로그가 이미 열려있을 때 중복 클릭 방지
- 사용자에게 현재 파일 선택 진행 중임을 명확히 표시
- 비동기 작업 중 버튼 상태 일관성 유지

**영향:**
- Properties 패널 "Select File" 및 "Change" 버튼 UX 개선
- 다이얼로그 중복 열림으로 인한 혼란 방지

## Technical Details

### 타입 시스템

**CommandNodeData 확장:**
```typescript
export interface CommandNodeData extends Record<string, unknown> {
  label: string;
  command: (typeof COMMAND_TYPES)[number];
  sipInstanceId?: string;
  targetUri?: string; // for MakeCall
  timeout?: number; // milliseconds
  filePath?: string; // for PlayAudio WAV file absolute path
}
```

**COMMAND_TYPES 배열:**
```typescript
export const COMMAND_TYPES = ['MakeCall', 'Answer', 'Release', 'PlayAudio'] as const;
```

### 노드 렌더링

**COMMAND_ICONS 매핑:**
```typescript
const COMMAND_ICONS = {
  MakeCall: Phone,
  Answer: PhoneIncoming,
  Release: PhoneOff,
  PlayAudio: Volume2,
} as const;
```

**filePath 배지:**
```tsx
{data.command === 'PlayAudio' && data.filePath && (
  <div className="px-3 pb-2">
    <div className="text-xs text-muted-foreground truncate max-w-[140px]" title={data.filePath}>
      {data.filePath.split(/[\\/]/).pop()}
    </div>
  </div>
)}
```

### Wails 바인딩 호출

**SelectWAVFile() 에러 처리:**
```typescript
try {
  const filePath = await SelectWAVFile();
  if (!filePath) return; // User cancelled
  onUpdate({ filePath });
  toast.success('Audio file selected');
} catch (err: any) {
  toast.error(`Invalid WAV file: ${err?.message || err}`);
}
```

**백엔드 검증 로직 (07-01에서 구현됨):**
- 8kHz sample rate 확인
- mono (1 channel) 확인
- PCM 포맷 (WavAudioFormat = 1) 확인
- 검증 실패 시 에러 반환 → 프론트엔드 toast 표시

## Verification

### 빌드 검증
- ✅ `npm run build` 성공 (TypeScript 에러 없음)
- ✅ `go build` 성공 (백엔드 컴파일 에러 없음)

### 기능 검증 (human-verify checkpoint)
- ✅ PlayAudio 노드 팔레트 등록 (Volume2 아이콘, blue 스타일)
- ✅ 캔버스 드래그 앤 드롭
- ✅ Properties 패널 파일 선택 UI
- ✅ Wails 네이티브 다이얼로그 열림
- ✅ 잘못된 WAV 선택 시 toast 에러
- ✅ 유효한 WAV 선택 시 파일명 배지 표시
- ✅ 파일명 hover → 전체 경로 tooltip
- ✅ 시나리오 저장/로드 시 filePath 유지

### 코드 품질
- TypeScript strict 모드 통과
- 기존 Command 노드 패턴 일관성 유지 (polymorphic design)
- Sonner toast로 일관된 알림 UX
- nodrag 클래스로 React Flow 충돌 방지

## Next Phase Readiness

### 완료된 의존성 제공
- ✅ `playaudio-frontend-ui`: PlayAudio 노드 전체 UI 파이프라인
- ✅ `wav-file-selection`: Wails 파일 다이얼로그 + 검증 통합

### 다음 계획 (07-03)에 필요한 것
- PlayAudio 노드가 캔버스에 배치 가능
- filePath가 시나리오에 저장됨
- 백엔드 executePlayAudio가 filePath를 읽을 수 있음 (07-01에서 구현됨)

### 차단 요소
없음. 07-03 (PlayAudio 통합 테스트)는 즉시 시작 가능합니다.

## Memory-Influenced Decisions

- **Domain Knowledge:** "Command 노드는 SIP 액션을 능동적으로 실행하는 노드" → PlayAudio를 Command 노드로 분류, blue 스타일 적용
- **Technical Constraint:** "Command 노드 polymorphic 패턴" → 하나의 CommandNode 컴포넌트, `data.command` 분기로 PlayAudio UI 추가
- **User Preference:** "Sonner toast로 알림 표시" → WAV 검증 피드백에 toast 사용
- **Established Pattern:** "nodrag 클래스로 React Flow 캔버스 드래그 충돌 방지" → Properties 패널 최상위 div에 `nodrag` 적용 (기존 패턴 유지)
- **Wails Binding Path:** "wailsjs/go/binding/MediaBinding" → SelectWAVFile import 경로 정확히 사용
- **Icon Pattern:** "기존 COMMAND_ICONS 패턴 (Phone, PhoneIncoming, PhoneOff)" → Volume2 추가로 일관성 유지

## Self-Check: PASSED

**생성된 파일 확인:**
- ✅ `frontend/wailsjs/go/binding/MediaBinding.js` 존재
- ✅ `frontend/wailsjs/go/binding/MediaBinding.d.ts` 존재

**수정된 파일 확인:**
- ✅ `frontend/src/features/scenario-builder/types/scenario.ts` — PlayAudio 타입 추가
- ✅ `frontend/src/features/scenario-builder/components/node-palette.tsx` — PlayAudio 팔레트 항목
- ✅ `frontend/src/features/scenario-builder/components/nodes/command-node.tsx` — PlayAudio 아이콘 + 배지
- ✅ `frontend/src/features/scenario-builder/components/properties/command-properties.tsx` — PlayAudio 파일 선택 UI

**커밋 확인:**
- ✅ `85532fe` 존재 (Task 1)
- ✅ `e2d2be1` 존재 (Task 2)

**빌드 확인:**
- ✅ `npm run build` 통과
- ✅ `go build` 통과

모든 검증 통과. 계획이 정확히 실행되었습니다.
