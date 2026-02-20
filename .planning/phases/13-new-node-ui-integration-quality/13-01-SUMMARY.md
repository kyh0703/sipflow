---
phase: "13"
plan: "01"
subsystem: frontend
tags: [react, typescript, ui, nodes, palette, properties, dnd]

dependencies:
  requires:
    - "10-01: Hold/Retrieve 백엔드 (Hold/Retrieve 커맨드 타입)"
    - "11-01: BlindTransfer 백엔드 (BlindTransfer 커맨드 + TargetUser/TargetHost)"
    - "12-01: Activity Bar + Resizable 레이아웃 (UI 프레임워크)"
  provides:
    - "UI-03: 새 노드 Properties 패널, 아이콘, 팔레트 항목"
    - "NF-03: 기존 DnD 패턴 일관성"
  affects:
    - "시나리오 빌더 전체 UX"

tech-stack:
  added: []
  patterns:
    - "COMMAND_TYPES/EVENT_TYPES 배열 확장 패턴"
    - "COMMAND_ICONS 매핑 + lucide-react 아이콘 패턴"
    - "command-properties 분기 조건 패턴 (BlindTransfer targetUser/targetHost)"
    - "Properties 패널 auto-expand/collapse (useEffect + panelRef.expand/collapse)"

key-files:
  created: []
  modified:
    - frontend/src/features/scenario-builder/types/scenario.ts
    - frontend/src/features/scenario-builder/components/nodes/command-node.tsx
    - frontend/src/features/scenario-builder/components/node-palette.tsx
    - frontend/src/features/scenario-builder/components/properties/command-properties.tsx
    - frontend/src/features/scenario-builder/components/properties/event-properties.tsx
    - frontend/src/features/scenario-builder/components/scenario-builder.tsx

decisions:
  - item: "Hold/Retrieve는 Properties에 추가 파라미터 불필요"
    rationale: "백엔드에서 target 없이 동작, Label + SIP Instance만 표시"
  - item: "BlindTransfer 인라인 표시 To: user@host"
    rationale: "MakeCall의 targetUri 인라인 표시와 동일 UX 패턴"
  - item: "Properties 패널 auto-expand/collapse"
    rationale: "노드 미선택 시 캔버스 공간 최대화, defaultLayout + expand()/collapse() 사용"

metrics:
  duration: "15 minutes"
  completed: "2026-02-20"
---

# Phase 13 Plan 01: 새 노드 프론트엔드 UI Summary

## One-Line Summary

6개 새 노드(Hold, Retrieve, BlindTransfer, HeldEvent, RetrievedEvent, TransferEvent)의 타입, 아이콘, 팔레트, Properties 패널을 완성하고, Properties 패널 auto-expand/collapse 기능 추가

## What Was Built

### Task 1: TypeScript 타입 + Command 노드 아이콘 + 팔레트 + Properties 완성

1. **scenario.ts** — `COMMAND_TYPES`에 `'Hold'`, `'Retrieve'`, `'BlindTransfer'` 추가. `CommandNodeData`에 `targetUser?`, `targetHost?` 필드 추가.

2. **command-node.tsx** — `COMMAND_ICONS`에 `Hold: Pause`, `Retrieve: Play`, `BlindTransfer: ArrowRightLeft` 매핑. BlindTransfer 노드에 `To: {targetUser}@{targetHost}` 인라인 표시.

3. **node-palette.tsx** — Commands 섹션에 Hold(Pause), Retrieve(Play), BlindTransfer(ArrowRightLeft) 팔레트 항목 추가. 파란색 테마(bg-blue-50 border-blue-400).

4. **command-properties.tsx** — BlindTransfer 전용 분기: Target User, Target Host 입력 필드. 도움말 텍스트 "host:port" 형식 안내.

5. **event-properties.tsx** — HELD/RETRIEVED/TRANSFERRED 이벤트에 Timeout 입력 필드 추가 (기본값 10000ms, 범위 1000-60000ms).

### Orchestrator Fix: Properties 패널 auto-expand/collapse + 레이아웃 개선

6. **scenario-builder.tsx** — defaultLayout으로 Group 레벨 레이아웃 관리. Panel ID 기반 + 문자열 퍼센트 minSize/maxSize. 노드 선택 시 Properties 패널 expand(), 해제 시 collapse(). 초기 상태에서 Properties 패널 숨김.

### Task 2: 사용자 시각적 검증 — APPROVED

6개 새 노드의 팔레트 표시, DnD, Properties 패널, 캔버스 렌더링을 사용자가 직접 확인하고 승인.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TypeScript 타입 + 아이콘 + 팔레트 + Properties | a01bbc5 | scenario.ts, command-node.tsx, node-palette.tsx, command-properties.tsx, event-properties.tsx |
| fix | Properties 패널 auto-expand/collapse + 레이아웃 | 1f697e6 | scenario-builder.tsx |
| 2 | 사용자 시각적 검증 | — | (checkpoint: human-verify, approved) |

## Decisions Made

1. **Hold/Retrieve에 추가 파라미터 없음** — 백엔드에서 현재 세션에만 적용되므로 Label + SIP Instance 선택만 표시.

2. **BlindTransfer 인라인 표시 패턴** — MakeCall의 targetUri 표시와 동일하게 `To: carol@192.168.1.100:5060` 패턴 사용.

3. **Properties 패널 auto-expand/collapse** — `defaultLayout`에 properties: 22를 설정하되 mount 시 collapse()로 숨김. 노드 선택/해제에 따라 expand()/collapse() 호출. resize() 대신 expand()를 사용해야 collapsed 상태에서 정상 복원됨.

## Deviations from Plan

1. **Properties 패널 auto-expand/collapse 추가** (deviation rule #2: 중요한 것 자동 추가) — 계획에는 없었으나, 사용자 검증 시 "노드 미선택 시 Properties 패널 숨김" 요청으로 scenario-builder.tsx에 useEffect + panelRef 기반 auto-expand/collapse 구현. defaultLayout을 Group 레벨로 이동하고 Panel ID 기반 레이아웃으로 전환.

## Next Phase Readiness

- UI-03 충족: 6개 새 노드에 Properties 패널, 아이콘, 팔레트 항목 완성
- NF-03 충족: 기존 MakeCall, Answer, Release와 동일한 DnD/Properties UX 패턴
- TypeScript 빌드 성공
- 사용자 시각적 검증 통과

## Self-Check: PASSED

All modified files exist. Commits a01bbc5 and 1f697e6 verified in git log.
