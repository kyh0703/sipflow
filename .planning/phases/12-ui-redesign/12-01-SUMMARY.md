# Phase 12-01 Summary: Activity Bar + Resizable 레이아웃

## 완료된 작업

### Task 1: shadcn Resizable 컴포넌트 설치
- `npx shadcn@latest add resizable`로 `resizable.tsx` 생성
- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` export 확인
- `react-resizable-panels` v4.6.4 사용 (`orientation` prop, `panelRef` 패턴)

### Task 2: ActivityBar 컴포넌트 생성
- `activity-bar.tsx` 신규 생성
- 상단: FolderTree(ScenarioTree), Puzzle(NodePalette) 아이콘
- 하단: Settings(비활성), ThemeToggle(헤더에서 이동)
- 활성 아이콘: 좌측 2px primary 인디케이터
- 순수 프레젠테이션 컴포넌트 (상태는 부모에서 관리)

### Task 3: ScenarioBuilder 레이아웃 재구성
- 고정 200px/280px 사이드바 → ResizablePanelGroup 기반 3-패널 레이아웃
- ActivityBar(48px 고정) + 좌측 사이드바(17%, 15-30%) + 캔버스(61%) + 우측 Properties(22%, 15-30%)
- 좌측 사이드바: collapsible, panelRef로 프로그래밍 방식 토글
- `handlePanelToggle`: 동일 아이콘 재클릭 → collapse, 다른 아이콘 → 패널 전환
- `onResize` 콜백으로 드래그 collapse 시 activePanel null 동기화
- ThemeToggle 헤더에서 제거 완료

## 결정사항

| 결정 | 이유 | 영향 범위 |
|------|------|-----------|
| `panelRef` prop 사용 (ref 아닌) | react-resizable-panels v4는 React 19 ref 패턴, React 18에서 panelRef 사용 | 사이드바 imperative handle |
| `onResize` collapse 감지 | v4에 onCollapse 콜백 없음, onResize에서 asPercentage === 0으로 감지 | 사이드바 상태 동기화 |
| defaultSize 17+61+22=100% | ResizablePanelGroup 합계 100% 필수 | 레이아웃 비율 |

## 파일 변경

| 파일 | 변경 |
|------|------|
| `frontend/src/components/ui/resizable.tsx` | 신규 (shadcn 생성) |
| `frontend/src/features/scenario-builder/components/activity-bar.tsx` | 신규 |
| `frontend/src/features/scenario-builder/components/scenario-builder.tsx` | 재구성 |

## 검증

- [x] 프론트엔드 빌드 성공 (`npm run build`)
- [x] ThemeToggle: scenario-builder.tsx에서 제거됨
- [x] ThemeToggle: activity-bar.tsx에서 사용됨
- [x] collapsible, panelRef, handlePanelToggle, activePanel 모두 적용됨
- [x] defaultSize 합계 100%
- [x] 기존 컴포넌트 (ScenarioTree, NodePalette, PropertiesPanel, Canvas) 미변경
