# Phase 09 Context: Integration & Polish

> 새 미디어 기능이 기존 시나리오와 통합되어 안정적으로 동작하고, 프로덕션 사용을 위한 품질 기준을 충족한다

## 논의된 영역

1. [상태 관리 리팩토링](#1-상태-관리-리팩토링)
2. [Resizable 레이아웃](#2-resizable-레이아웃)

---

## 1. 상태 관리 리팩토링

### 결정사항

**XYFlow Uncontrolled Mode 전환:** Controlled → Uncontrolled
- 현재 Zustand `scenario-store`에서 `nodes[]`, `edges[]`를 관리하고 `<ReactFlow nodes={nodes} edges={edges} />`로 controlled props 전달하는 패턴을 제거
- `<ReactFlow defaultNodes={nodes} defaultEdges={edges} />`로 uncontrolled mode 전환
- XYFlow 내장 Zustand 스토어가 nodes/edges의 Single Source of Truth
- `ReactFlowProvider` 내부 컴포넌트에서 `useReactFlow()` hooks로 접근

**앱 레벨 상태 — 경량 Zustand 유지:**
- nodes/edges를 제거한 축소 Zustand 스토어 유지
- 유지 대상: `currentScenarioId`, `currentScenarioName`, `isDirty`, `saveStatus`, `validationErrors`, `selectedNodeId`
- 이것들은 XYFlow가 모르는 앱 도메인 상태이므로 별도 관리 필수

**Properties 패널 접근 — useReactFlow() hooks:**
- `useReactFlow().getNode(id)` / `useReactFlow().setNodes()`로 노드 데이터 직접 읽기/쓰기
- 현재 Zustand `nodes.find()` + `updateNodeData()` 패턴 제거
- 중간 추상화 레이어(커스텀 hook) 없이 XYFlow hooks 직접 사용

**자동저장 전략 — 현재 방식 유지:**
- `onNodesChange` / `onEdgesChange` 콜백에서 `isDirty` 플래그 설정
- 기존 `subscribe(isDirty)` → 2초 디바운스 → `SaveScenario()` 패턴 유지
- 저장 시 `useReactFlow().getNodes()` / `getEdges()`로 현재 상태 추출

**execution-store — 변경 없음:**
- 런타임 전용 스토어로서 현재 구조 적절
- Wails EventsOn/EventsOff 구독 패턴 유지
- 리팩토링 범위에서 제외

### 현재 상태 (Phase 9 시작 전)

- `scenario-store.ts`: nodes[], edges[], selectedNodeId, isDirty, saveStatus, validationErrors, onNodesChange, onEdgesChange, onConnect, updateNodeData, addNode 등 관리
- `execution-store.ts`: nodeStates, actionLogs, sipMessages, edgeAnimations, scenarioError 관리
- `<ReactFlow>`: controlled mode — `nodes={nodes}` `edges={edges}` props 전달
- `useReactFlow()`: Canvas에서 `screenToFlowPosition()` 한 곳만 사용
- `useStoreApi()`: 미사용
- 자동저장: 스토어 외부 `useScenarioStore.subscribe()` + 커스텀 debounce 2000ms

### 리팩토링 범위

| 변경 대상 | 현재 | 목표 |
|-----------|------|------|
| `scenario-store.ts` | nodes/edges + 앱 상태 혼합 | 앱 상태만 (isDirty, saveStatus, scenarioId 등) |
| `canvas.tsx` | `useScenarioStore(nodes, edges, handlers)` | `defaultNodes/defaultEdges` + XYFlow uncontrolled |
| `properties-panel.tsx` | `useScenarioStore(nodes).find()` | `useReactFlow().getNode()` |
| `command-properties.tsx` | `onUpdate → updateNodeData` | `useReactFlow().setNodes()` |
| `event-properties.tsx` | `onUpdate → updateNodeData` | `useReactFlow().setNodes()` |
| `sip-instance-properties.tsx` | `onUpdate → updateNodeData` | `useReactFlow().setNodes()` |
| 노드 컴포넌트들 | `useScenarioStore(validationErrors)` | 유지 (validationErrors는 앱 상태) |
| 자동저장 로직 | `subscribe(isDirty)` + Zustand nodes | `subscribe(isDirty)` + `getNodes()/getEdges()` |

---

## 2. Resizable 레이아웃

### 결정사항

**shadcn Resizable 전면 적용:**
- 좌측 사이드바, 우측 사이드바, 하단 로그 패널 모두 리사이즈 가능
- `@/components/ui/resizable` (shadcn의 ResizablePanelGroup, ResizablePanel, ResizableHandle) 사용

**좌측 사이드바 — 아이콘 네비게이션 바 + 탭 전환:**
- 좌측에 항시 표시되는 수직 아이콘 네비게이션 바 (thin rail, ~48px)
- 아이콘 클릭으로 ScenarioTree / NodePalette 간 전환 (탭 패턴)
- 현재 50:50 세로 분할 제거
- 컨텐츠 영역은 접기(collapse) 가능 — 아이콘 바만 남김
- 접혀 있을 때 아이콘 클릭하면 다시 펼쳐짐

**우측 Properties 패널 — 선택 기반 자동 표시/숨김:**
- collapse 버튼 없음
- 노드 선택 시 자동 표시
- 캔버스 배경 클릭 (선택 해제) 시 자동 숨김
- 숨김 시 캔버스가 전체 너비 차지

**하단 로그 패널 — 현재 동작 유지 + 리사이즈:**
- idle 시 숨김, 실행 시 자동 표시 (기존 동작)
- 표시 시 세로 리사이즈 가능 (shadcn Resizable 세로 방향)

### 목표 레이아웃

```
┌────────────────────────────────────────────────────────┐
│  Header (40px 고정)                                      │
├──┬─────────┬─────────────────────────┬─────────────────┤
│  │         │                         │                 │
│ I│  Tab    │   Canvas                │  Properties     │
│ c│  Content│   (XYFlow)              │  (노드 선택시    │
│ o│  Area   │                         │   자동 표시)     │
│ n│         │                         │                 │
│  │ 📋 or 🧩│                         │                 │
│ N│         ├─────────────────────────┤                 │
│ a│ ↕resize │  Log Panel (실행 시)     │                 │
│ v│         │  ↕ 세로 리사이즈         │                 │
├──┴─────────┴─────────────────────────┴─────────────────┤
 48px ↔ resize   ↔ flex-1 ↔ resize   ↔ Properties
```

### 현재 레이아웃 (변경 전)

| 영역 | 크기 | 리사이즈 | Collapse |
|------|------|---------|----------|
| 헤더 | 40px 고정 | 불가 | 불가 |
| 좌측 (Tree + Palette) | 200px 고정 | 불가 | 불가 |
| 캔버스 | flex-1 가변 | 불가 | 불가 |
| 하단 로그 | max-h-200px | 불가 | 조건부 표시 |
| 우측 Properties | 280px 고정 | 불가 | 불가 |

### 변경 후

| 영역 | 기본 크기 | 리사이즈 | Collapse/숨김 |
|------|-----------|---------|---------------|
| 헤더 | 40px 고정 | 불가 | 불가 |
| 아이콘 Nav Bar | ~48px 고정 | 불가 | 항시 표시 |
| 좌측 컨텐츠 | ~200px | 가로 | 접기 가능 |
| 캔버스 | flex-1 가변 | 가로+세로 | 불가 |
| 하단 로그 | ~200px | 세로 | 실행 시 자동 표시 |
| 우측 Properties | ~280px | 가로 | 노드 선택 시 자동 표시 |

---

## 논의하지 않은 영역 (Claude 판단)

### A. 테스트 범위 & 전략

사용자가 이 영역을 선택하지 않았으므로, Claude가 기존 패턴 기반으로 판단합니다:

**테스트 대상 (v1.1 신규 코드):**
- `isValidDTMF` — 순수 함수, 단위 테스트 용이 (경계값: 0-9, *, #, A-D, 유효하지 않은 문자)
- `stringToCodecs` — 순수 함수, 코덱 문자열 → diago 타입 변환 + telephone-event 자동 추가
- `MediaBinding.ValidateWAVFile` — WAV 헤더 검증 로직 (8kHz mono PCM)
- `ParseScenario` DTMF/Media 필드 파싱 — 기존 graph_test.go 패턴 확장

**diago 의존 코드 (executePlayAudio, executeSendDTMF, executeDTMFReceived):**
- diago DialogMedia API는 인터페이스가 아닌 구체 타입이므로 직접 목킹 어려움
- 기존 integration_test.go 패턴으로 시뮬레이션 모드 통합 테스트 권장
- 에러 경로(dialog 없음, 파일 없음 등)는 단위 테스트 가능

**커버리지 기준:** ROADMAP의 "internal/media/ 70%+" → 실제로는 해당 패키지 미존재, executor.go 내 미디어 관련 함수 + media_binding.go의 테스트 커버리지로 해석

### B. E2E 테스트 환경

사용자가 이 영역을 선택하지 않았으므로, Claude가 판단합니다:

- ROADMAP 성공기준 4번 (Asterisk/FreeSWITCH 연동)은 외부 인프라 의존
- Phase 9에서는 **로컬 시뮬레이션 모드 기반 통합 테스트**에 집중
- 실 SIP 서버 E2E는 환경 구성이 필요하며, 별도 검증 시점에서 수행
- 기존 `TestIntegration_TwoPartyCallSimulation` 패턴 (TIMEOUT 체인)을 미디어/DTMF 노드로 확장

### C. 사용자 문서 범위

사용자가 이 영역을 선택하지 않았으므로, Claude가 판단합니다:

- README.md를 프로젝트 고유 내용으로 교체 (현재 Wails 기본 템플릿 텍스트)
- 포함 내용: 프로젝트 소개, 기술 스택, 빌드 방법, 기본 사용법
- WAV 파일 요구사항 (8kHz mono PCM), 코덱 선택 가이드, DTMF 사용 예시는 README 내 섹션으로
- 별도 docs/ 디렉토리나 인앱 도움말은 현재 범위 초과

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| execution-store 리팩토링 | Phase 9 논의 | 현재 구조 적절, 필요 시 향후 리팩토링 |
| 인앱 도움말/튜토리얼 | Phase 9 분석 | v2.0+ 사용자 온보딩에서 고려 |
| Docker 기반 SIP 서버 E2E 환경 | Phase 9 분석 | CI/CD 파이프라인 구축 시 고려 |
| 재생 진행 프로그레스 바 | Phase 7 미뤄진 아이디어 | diago Play()가 blocking이라 정확한 진행률 추정 복잡 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 9` — Phase 9의 상세 실행 계획(PLAN.md) 생성
