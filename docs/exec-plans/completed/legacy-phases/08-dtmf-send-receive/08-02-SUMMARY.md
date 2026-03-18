---
phase: 08-dtmf-send-receive
plan: 02
subsystem: ui
tags: [frontend, dtmf, node-palette, properties, typescript]
requires: [07-02]
provides:
  - SendDTMF Command 노드 UI (타입, 팔레트, 캔버스, Properties)
  - DTMFReceived Event 노드 UI (타입, 팔레트, 캔버스, Properties)
  - DTMF digits 입력 필터링 (0-9*#A-D)
  - intervalMs 파라미터 (50-1000ms)
  - expectedDigit 파라미터 (단일 문자)
affects: [08-01]
tech-stack:
  added: []
  patterns:
    - "lucide-react Hash/Ear 아이콘 사용"
    - "regex 필터링 onChange 패턴"
    - "Math.max/min 클램프 패턴"
key-files:
  created: []
  modified:
    - frontend/src/features/scenario-builder/types/scenario.ts
    - frontend/src/features/scenario-builder/components/node-palette.tsx
    - frontend/src/features/scenario-builder/components/nodes/command-node.tsx
    - frontend/src/features/scenario-builder/components/nodes/event-node.tsx
    - frontend/src/features/scenario-builder/components/properties/command-properties.tsx
    - frontend/src/features/scenario-builder/components/properties/event-properties.tsx
decisions: 5
metrics:
  duration: 3m 13s
  tasks: 2
  commits: 2
  files_modified: 6
completed: 2026-02-19
---

# Phase 8 Plan 02: SendDTMF & DTMFReceived Frontend UI Summary

**One-line:** lucide-react Hash/Ear 아이콘을 사용한 SendDTMF Command와 DTMFReceived Event 노드의 프론트엔드 UI 완전 구현 (타입, 팔레트, 캔버스 렌더링, Properties 패널)

## What Was Built

### SendDTMF Command Node
- **타입 정의**: COMMAND_TYPES에 'SendDTMF' 추가, CommandNodeData에 `digits?: string`, `intervalMs?: number` 추가
- **노드 팔레트**: Hash 아이콘, blue-50 배경색
- **캔버스 렌더링**: Hash 아이콘 + digits 텍스트 표시
- **Properties 패널**:
  - Digits 입력: regex 필터 (`/[^0-9*#A-Da-d]/g`)로 유효하지 않은 문자 즉시 제거, 자동 대문자 변환, 최대 20자
  - Interval Between Digits: 50-1000ms 범위로 클램프, 기본값 100ms

### DTMFReceived Event Node
- **타입 정의**: EVENT_TYPES에 'DTMFReceived' 추가, EventNodeData에 `expectedDigit?: string` 추가
- **노드 팔레트**: Ear 아이콘, amber-50 배경색
- **캔버스 렌더링**: Ear 아이콘 + expectedDigit 텍스트 표시 (설정된 경우)
- **Properties 패널**:
  - Expected Digit: 단일 유효 DTMF 문자만 허용 (regex + `slice(0, 1)`), 빈 값 = 모든 digit 허용
  - Timeout: 1000-60000ms 범위로 클램프, 기본값 10000ms

## Task Commits

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | 타입 정의 + 노드 팔레트 + 캔버스 렌더링 | 9df957c | scenario.ts, node-palette.tsx, command-node.tsx, event-node.tsx |
| 2 | SendDTMF + DTMFReceived Properties 패널 UI | ca8e44d | command-properties.tsx, event-properties.tsx |

## Decisions Made

| # | Decision | Rationale | Impact |
|---|----------|-----------|--------|
| 1 | Ear 아이콘을 DTMFReceived에 채택 | 연구에서 PhoneIncoming 제안했으나 이미 Answer 노드에 사용 중. Ear는 "digit을 듣고 대기한다"는 의미를 직관적으로 전달 | DTMFReceived 노드 시각화 |
| 2 | onChange에서 regex 필터 적용 | 유효하지 않은 문자를 입력 시점에 즉시 제거하여 실시간 피드백 제공 | digits/expectedDigit 입력 UX 향상 |
| 3 | intervalMs 50-1000ms 클램프 | RFC 2833 최소 제약 준수 (50ms 미만은 불안정), 최대 1초는 UX 상 적절한 범위 | SendDTMF 실행 안정성 |
| 4 | expectedDigit 단일 문자 제한 | DTMFReceived는 한 번에 하나의 digit만 대기 (연속 digit은 여러 노드로 체인) | 시나리오 그래프 명확성 |
| 5 | timeout 기본값 10000ms (DTMFReceived) | 사용자 입력 대기 시간은 SIP 이벤트보다 길어야 함 (TIMEOUT 이벤트는 5000ms 기본) | DTMFReceived 이벤트 타임아웃 정책 |

## Verification Results

### TypeScript Compilation
✅ `npx tsc --noEmit` — 에러 없음

### Must-Have Truths
✅ 사용자가 노드 팔레트에서 SendDTMF Command 노드를 캔버스에 드래그앤드롭할 수 있다
✅ 사용자가 노드 팔레트에서 DTMFReceived Event 노드를 캔버스에 드래그앤드롭할 수 있다
✅ 사용자가 SendDTMF 노드 Properties 패널에서 DTMF digits(0-9, *, #, A-D)를 입력할 수 있다
✅ 사용자가 SendDTMF 노드 Properties 패널에서 전송 간격(intervalMs)을 설정할 수 있다
✅ 사용자가 DTMFReceived 노드 Properties 패널에서 expectedDigit를 설정할 수 있다
✅ 캔버스에서 SendDTMF 노드에 Hash 아이콘이, DTMFReceived 노드에 Ear 아이콘이 표시된다

### Artifact Assertions
✅ scenario.ts: COMMAND_TYPES에 'SendDTMF', EVENT_TYPES에 'DTMFReceived' 존재
✅ scenario.ts: CommandNodeData에 digits/intervalMs, EventNodeData에 expectedDigit 존재
✅ node-palette.tsx: SendDTMF와 DTMFReceived PaletteItem 존재
✅ command-node.tsx: COMMAND_ICONS에 SendDTMF: Hash 매핑 존재
✅ event-node.tsx: EVENT_ICONS에 DTMFReceived: Ear 매핑 존재
✅ command-properties.tsx: data.command === 'SendDTMF' 조건부 블록 존재
✅ event-properties.tsx: data.event === 'DTMFReceived' 조건부 블록 존재

### Key Links Validated
✅ node-palette.tsx → scenario.ts: 'command-SendDTMF', 'event-DTMFReceived' 문자열 매핑
✅ command-properties.tsx → scenario.ts: data.digits, data.intervalMs 참조
✅ event-properties.tsx → scenario.ts: data.expectedDigit 참조

## Deviations from Plan

None - 계획이 작성된 대로 정확히 실행되었습니다.

## Next Phase Readiness

### Blockers
None

### Concerns
None

### Dependencies for 08-01
Phase 08-01 (SendDTMF/DTMFReceived Backend)은 이 프론트엔드 UI에서 정의된 타입과 파라미터를 백엔드에 바인딩해야 합니다:
- `digits` 문자열 → Go `SendDTMF(digits string, intervalMs int)` 메서드
- `intervalMs` → DTMF digit 간 지연
- `expectedDigit` → DTMF 수신 대기 로직
- `timeout` (DTMFReceived) → DTMF 이벤트 타임아웃

## Self-Check: PASSED

모든 수정된 파일이 존재하고, 모든 커밋이 git 히스토리에 존재합니다.
