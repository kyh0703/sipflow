# Phase 12 Context: UI 리디자인 (Activity Bar + Resizable)

> 사용자가 Activity Bar의 아이콘 클릭으로 사이드바 패널을 토글하고, 사이드바 너비를 자유롭게 조절할 수 있다

## 논의된 영역

1. [패널 분리 전략](#1-패널-분리-전략)
2. [사이드바 동작과 범위](#2-사이드바-동작과-범위)
3. [Activity Bar 시각 디자인](#3-activity-bar-시각-디자인)

---

## 1. 패널 분리 전략

### 결정사항

**개별 독립 패널 — ScenarioTree와 NodePalette를 Activity Bar에서 분리:**
- Activity Bar에 아이콘 2개 (ScenarioTree, NodePalette)
- 아이콘 클릭 시 해당 패널만 사이드바 영역에 표시
- 한 번에 하나의 패널만 열림 (VS Code Explorer/Search 패턴)
- 동일 아이콘 다시 클릭 시 사이드바 닫힘 (토글)
- 다른 아이콘 클릭 시 패널 전환 (닫힘 없이 즉시 교체)

**Activity Bar 항상 보임:**
- 사이드바가 닫혀도 Activity Bar는 좌측에 고정 표시
- 사용자가 언제든 아이콘 클릭으로 사이드바를 열 수 있음

**내부 분할 불필요:**
- 개별 패널이므로 ScenarioTree/NodePalette 사이의 상하 분할 비율 조절 불필요
- 추후 하나의 통합 패널이 필요하면 Resizable 내부 분할 추가 가능

### 레이아웃 다이어그램

```
현재 구조:
┌──────────┬─────────────────────────┬──────────┐
│ Sidebar  │                         │Properties│
│ (200px)  │       Canvas            │ (280px)  │
│ Tree+Pal │                         │          │
└──────────┴─────────────────────────┴──────────┘

Phase 12 구조:
┌─────┬──────────┬───────────────────┬──────────┐
│ Bar │ Sidebar  │                   │Properties│
│48px │(Resize)  │     Canvas        │(Resize)  │
│ [T] │ScenTree  │                   │          │
│ [P] │ (only)   │                   │          │
│     │          │                   │          │
│ --- │          │                   │          │
│ [⚙] │          │                   │          │
│ [🎨]│          │                   │          │
└─────┴──────────┴───────────────────┴──────────┘
```

---

## 2. 사이드바 동작과 범위

### 결정사항

**애니메이션 없음 — 즉시 표시/숨김:**
- 사이드바 토글 시 CSS transition 없이 즉시 렌더링
- shadcn Resizable 컴포넌트 자체가 애니메이션 미지원이므로 일관성 유지
- 구현 단순, 성능 최적

**기본 상태 — ScenarioTree 열림:**
- 앱 시작 시 ScenarioTree 패널이 기본으로 열림
- 사용자가 시나리오 선택으로 시작하는 자연스러운 워크플로우
- Activity Bar의 ScenarioTree 아이콘이 활성 상태로 표시

**양측 Resizable — 좌/우 모두 리사이즈 가능:**
- 좌측 사이드바: shadcn ResizablePanelGroup으로 너비 조절 가능
- 우측 Properties 패널: 동일하게 Resizable로 너비 조절 가능
- 일관된 UX 제공

**너비 제약 — 최소 200px / 최대 400px:**
- 좌측 사이드바와 우측 Properties 패널 모두 동일 제약 적용
- 현재 좌측 200px, 우측 280px을 최소값으로 유지
- 최대 400px로 확장 가능 (캔버스 영역 보호)
- shadcn ResizablePanel의 `minSize`/`maxSize` 속성 활용 (퍼센트 기반이므로 픽셀 환산 필요)

**너비 저장 — 세션 내 유지:**
- ROADMAP 성공기준 3번: "조절된 너비가 세션 내 유지됨"
- shadcn ResizablePanel의 `onResize` 콜백으로 상태 관리
- 세션 내 유지만 필요 (localStorage 불필요, React 상태로 충분)

---

## 3. Activity Bar 시각 디자인

### 결정사항

**VS Code 스타일 — 48px 아이콘 바:**
- 너비: 48px 고정
- 배경: 다크 배경 (테마에 따라 bg-muted 또는 커스텀)
- 활성 아이콘: 좌측 2px border 인디케이터 + 하이라이트 색상 (foreground)
- 비활성 아이콘: dim 처리 (muted-foreground)
- 아이콘 크기: 24px (lucide-react 기본)
- 아이콘 간격: 패딩으로 충분한 클릭 영역 확보

**아이콘 선택:**
| 패널 | 아이콘 | lucide-react | 의미 |
|------|--------|-------------|------|
| ScenarioTree | FileTree | `FileTree` | 시나리오 목록/트리 구조 |
| NodePalette | Puzzle | `Puzzle` | 노드를 조합하는 느낌 |
| 설정 | Settings | `Settings` | 앱 설정 (하단) |
| 테마 토글 | 기존 토글 | `Sun`/`Moon`/`Monitor` | 3-way 순환 토글 (하단) |

**하단 영역 — 설정 + 테마 토글:**
- Activity Bar를 상단/하단으로 분리 (flex justify-between)
- 상단: ScenarioTree, NodePalette 아이콘
- 하단: Settings 아이콘, 테마 토글 아이콘
- 테마 토글은 현재 헤더에 있는 ThemeToggle을 Activity Bar 하단으로 이동
- Settings 아이콘은 현재 기능 없음 (클릭 시 아무 동작 없이 비활성, 또는 향후 설정 패널 연결 준비)

### Activity Bar 시각 명세

```
┌──────────┐
│          │
│   [FT]   │  ◀ ScenarioTree (active: left border + highlight)
│          │
│   [Pz]   │  ◀ NodePalette (inactive: dim)
│          │
│          │
│  (space) │  ◀ flex-grow로 상단/하단 분리
│          │
│   [⚙]   │  ◀ Settings (하단, 비활성 준비)
│   [🌓]   │  ◀ ThemeToggle (하단, 3-way 순환)
│          │
└──────────┘
   48px
```

---

## 논의하지 않은 영역 (Claude 판단)

### A. 헤더 바 변경

- 현재 헤더(h-10)에 시나리오 이름, 저장 상태, 실행 컨트롤, 테마 토글이 배치됨
- 테마 토글이 Activity Bar 하단으로 이동하므로 헤더에서 제거
- 나머지 헤더 요소(시나리오 이름, 저장 상태, 실행 컨트롤)는 변경 없음

### B. 키보드 단축키

- Activity Bar 패널 토글 단축키는 Phase 12에서 구현하지 않음
- 향후 필요 시 `Ctrl+B` (사이드바 토글), `Ctrl+Shift+E/P` (패널 전환) 패턴 참고

### C. 반응형 동작

- Wails 데스크탑 앱이므로 모바일 반응형 불필요
- 최소 윈도우 크기 제약은 현재 없음 (Wails 기본값 유지)

### D. Properties 패널 토글

- Properties 패널은 Activity Bar에 포함하지 않음
- 노드 선택 시 자동으로 표시되는 기존 동작 유지
- Resizable만 적용하여 너비 조절 가능하게 변경

---

## 기존 인프라 활용

| 현재 구조 | Phase 12에서 변경 |
|-----------|-------------------|
| ScenarioBuilder 단일 컴포넌트 | Activity Bar + ResizablePanel 구조로 분리 |
| w-[200px] 고정 좌측 사이드바 | shadcn ResizablePanel (200-400px) |
| w-[280px] 고정 우측 Properties | shadcn ResizablePanel (200-400px) |
| ScenarioTree + NodePalette 상하 분할 | Activity Bar 아이콘으로 개별 패널 전환 |
| 헤더의 ThemeToggle | Activity Bar 하단으로 이동 |
| shadcn/ui new-york (설치됨) | Resizable 컴포넌트 추가 설치 필요 (`npx shadcn@latest add resizable`) |
| lucide-react v0.563.0 | FileTree, Puzzle, Settings 아이콘 사용 |

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| ScenarioTree+NodePalette 통합 패널 옵션 | 패널 분리 전략 논의 | 사용자가 개별 패널 선택, 추후 통합 옵션 추가 가능 |
| ScenarioTree/NodePalette 내부 Resizable 분할 | 내부 분할 논의 | 현재 불필요, 추후 통합 패널 시 추가 |
| 키보드 단축키 (Ctrl+B 등) | 미논의 | 향후 UX 개선 시 추가 |
| Settings 패널 | Activity Bar 하단 논의 | 현재 비활성 아이콘만 배치, 향후 연결 |
| localStorage 너비 영속화 | 세션 내 유지만 결정 | 필요 시 localStorage로 확장 가능 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 12` — Phase 12의 상세 실행 계획(PLAN.md) 생성
