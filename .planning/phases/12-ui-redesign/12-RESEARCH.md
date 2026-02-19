# Phase 12: UI 리디자인 (Activity Bar + Resizable) - Research

**Researched:** 2026-02-19
**Domain:** React + shadcn Resizable + lucide-react — 프론트엔드 레이아웃 리디자인
**Confidence:** HIGH (소스 직접 확인, 라이브러리 API 검증 완료)

---

## Summary

Phase 12의 구현 범위는 세 가지다: Activity Bar 컴포넌트 신규 생성, ScenarioBuilder를 shadcn `ResizablePanelGroup`으로 재구성, ThemeToggle을 헤더에서 Activity Bar 하단으로 이동.

**현재 구조:** `ScenarioBuilder` 단일 컴포넌트가 헤더 + 좌측 사이드바(w-[200px] 고정) + 캔버스 + 우측 Properties(w-[280px] 고정)를 모두 포함. 좌측 사이드바에 `ScenarioTree`와 `NodePalette`가 상하 분할로 공존.

**Phase 12 후 구조:** Activity Bar(48px 고정) + 토글 가능한 좌측 사이드바(shadcn ResizablePanel, 200~400px) + 캔버스(ResizablePanel, flex-1) + 우측 Properties(shadcn ResizablePanel, 200~400px). ScenarioTree/NodePalette는 Activity Bar 아이콘으로 개별 전환.

**핵심 발견:**
- `react-resizable-panels` v4.6.4 이미 node_modules에 설치됨 — `npx shadcn@latest add resizable`만 실행하면 됨 (resizable.tsx UI 컴포넌트 추가)
- `FileTree` 아이콘은 lucide-react v0.563.0에 **존재하지 않음** — `FolderTree` 또는 `ListTree`로 대체 필요
- `Puzzle`, `Settings`, `Sun`, `Moon`, `Monitor`는 모두 존재 확인
- ResizablePanel의 `minSize`/`maxSize`는 **퍼센트(0-100)** 기반 — 픽셀→퍼센트 환산 필요
- Panel의 `collapsible` prop + `panelRef.collapse()/expand()` API로 Activity Bar 토글 구현
- 세션 내 너비 유지: `onLayoutChange`/`onLayoutChanged` 콜백으로 React state에 저장

---

## Standard Stack

이 페이즈에서 새 npm 패키지 추가는 없다. `react-resizable-panels`가 이미 설치되어 있으며, `shadcn add resizable`로 UI 래퍼 컴포넌트만 추가하면 된다.

### Core
| 라이브러리 | 버전 | 목적 | 표준인 이유 |
|-----------|------|------|------------|
| `react-resizable-panels` | v4.6.4 (설치됨) | ResizablePanelGroup, Panel, Separator | shadcn Resizable의 기반 라이브러리 |
| `shadcn/ui` Resizable | new-york 스타일 | shadcn 래퍼 컴포넌트 (resizable.tsx) | 프로젝트 shadcn/ui 채택 결정 |
| `lucide-react` | v0.563.0 (설치됨) | Activity Bar 아이콘 | 프로젝트 표준 아이콘 라이브러리 |
| `next-themes` | v0.4.6 (설치됨) | ThemeToggle (이동만, 변경 없음) | 기존 테마 시스템 |
| Zustand | v5.0.11 (설치됨) | 액티브 패널 상태 관리 | 프로젝트 표준 상태 관리 |

### 확인된 아이콘 (lucide-react v0.563.0 직접 검증)
| 용도 | CONTEXT.md 명세 | 실제 사용 가능 여부 | 대안 |
|------|----------------|-------------------|------|
| ScenarioTree | `FileTree` | **없음** | `FolderTree` 또는 `ListTree` (둘 다 존재) |
| NodePalette | `Puzzle` | 있음 | — |
| Settings | `Settings` | 있음 | — |
| 테마 Light | `Sun` | 있음 | — |
| 테마 Dark | `Moon` | 있음 | — |
| 테마 System | `Monitor` | 있음 | — |

**권장:** ScenarioTree 아이콘으로 `FolderTree` 사용 (폴더 트리 구조를 직관적으로 표현)

---

## Architecture Patterns

### 현재 ScenarioBuilder 레이아웃 구조

`/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/scenario-builder.tsx`:

```
ScenarioBuilder
├── ReactFlowProvider
│   └── DnDProvider
│       ├── Toaster
│       └── div.flex.flex-col.h-screen.w-screen
│           ├── Header (h-10) — 시나리오명, 저장상태, ExecutionToolbar, Save버튼, ThemeToggle
│           └── div.flex.flex-1.overflow-hidden
│               ├── Left Sidebar (w-[200px], border-r) — ScenarioTree + NodePalette
│               ├── Center Canvas (flex-1) — Canvas + 실행 패널 탭
│               └── Right Sidebar (w-[280px], border-l) — PropertiesPanel
```

### Phase 12 목표 구조

```
ScenarioBuilder
├── ReactFlowProvider
│   └── DnDProvider
│       ├── Toaster
│       └── div.flex.flex-col.h-screen.w-screen
│           ├── Header (h-10) — 시나리오명, 저장상태, ExecutionToolbar, Save버튼
│           │   (ThemeToggle 제거됨)
│           └── div.flex.flex-1.overflow-hidden
│               ├── ActivityBar (w-12, border-r) — 상단 패널 아이콘들, 하단 Settings + ThemeToggle
│               └── ResizablePanelGroup (orientation="horizontal", flex-1)
│                   ├── ResizablePanel (sidebarPanel, collapsible, minSize≈15%, maxSize≈30%)
│                   │   └── {activePanel === 'scenario' ? <ScenarioTree/> : <NodePalette/>}
│                   ├── ResizableHandle
│                   ├── ResizablePanel (canvas, flex-1)
│                   │   └── Canvas + 실행 패널 탭
│                   ├── ResizableHandle
│                   └── ResizablePanel (propertiesPanel, minSize≈15%, maxSize≈30%)
│                       └── PropertiesPanel
```

### 패턴 1: shadcn Resizable 컴포넌트 설치 및 사용

**설치 명령:**
```bash
npx shadcn@latest add resizable
```

이 명령이 `/Users/kyh0703/Project/sipflow/frontend/src/components/ui/resizable.tsx`를 생성한다. `react-resizable-panels`는 이미 node_modules에 있으므로 npm install은 불필요.

**shadcn resizable.tsx 컴포넌트 구조 (예상):**
```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle as PanelResizeHandle } from "react-resizable-panels"

// shadcn 래퍼 — withHandle prop으로 시각적 핸들 추가
export { ResizablePanelGroup, ResizablePanel }
export function ResizableHandle({ withHandle, ...props }) { ... }
```

### 패턴 2: 퍼센트 기반 minSize/maxSize 계산

`react-resizable-panels` v4의 Panel 크기 단위는 **부모 Group의 퍼센트(0-100)**다. 픽셀 값을 퍼센트로 환산해야 한다.

화면 너비 기준 (일반적인 데스크탑 1280px 기준):
- Activity Bar: 48px (고정, ResizablePanel 아님)
- 가용 너비: 1280 - 48 = 1232px
- 좌측 사이드바 최소 200px → 200/1232 ≈ 16.2%
- 좌측 사이드바 최대 400px → 400/1232 ≈ 32.5%
- 우측 Properties 최소 200px → 약 16%
- 우측 Properties 최대 400px → 약 32%

**실제 구현 시 근사값 사용:**
```tsx
<ResizablePanel
  defaultSize={17}   // ~200px at 1180px available width
  minSize={15}       // ~176px — 200px 근사
  maxSize={30}       // ~354px — 400px 근사
  collapsible
  collapsedSize={0}
  panelRef={sidebarRef}
>
```

**중요:** 정확한 픽셀 제어가 필요하면 `minSize`/`maxSize` 대신 CSS `min-width`/`max-width`를 Panel에 직접 적용하는 방법도 있으나, shadcn 권장 방식은 percent 기반이다.

### 패턴 3: Activity Bar 토글 — collapsible + panelRef

사이드바 Panel을 열고 닫는 핵심 API:

```tsx
import { usePanelRef } from "react-resizable-panels"
// 또는
import { useRef } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"

const sidebarRef = useRef<ImperativePanelHandle>(null)

// 토글 로직
const handleActivityIconClick = (panel: 'scenario' | 'palette') => {
  if (activePanel === panel && !sidebarRef.current?.isCollapsed()) {
    // 동일 아이콘 클릭 → 닫기
    sidebarRef.current?.collapse()
    setActivePanel(null)
  } else {
    // 다른 패널 아이콘 클릭 → 전환 또는 열기
    sidebarRef.current?.expand()
    setActivePanel(panel)
  }
}
```

**react-resizable-panels v4 API 확인:**
```ts
// panelRef.current 제공 메서드
collapse(): void
expand(): void
getSize(): number
isCollapsed(): boolean
resize(size: number): void
```

`panelRef` prop을 Panel에 전달:
```tsx
<ResizablePanel
  collapsible
  collapsedSize={0}
  panelRef={sidebarRef}
  ...
>
```

### 패턴 4: 세션 내 너비 유지 — React state

CONTEXT.md 결정: localStorage 불필요, React 상태로 충분.

```tsx
// ScenarioBuilder 내부 state
const [sidebarSize, setSidebarSize] = useState(17)   // 퍼센트
const [propertiesSize, setPropertiesSize] = useState(22) // 퍼센트

// ResizablePanelGroup의 onLayoutChanged 콜백 (드래그 완료 후 호출)
<ResizablePanelGroup
  orientation="horizontal"
  onLayoutChanged={(sizes) => {
    // sizes: [sidebarSize, canvasSize, propertiesSize]
    setSidebarSize(sizes[0])
    setPropertiesSize(sizes[2])
  }}
>
```

**v4 API 주의사항:**
- `onLayout` → `onLayoutChange` (드래그 중 연속 호출)
- `onLayoutChanged` (드래그 완료 후 1회 호출) — 저장 용도에 권장

### 패턴 5: Activity Bar 컴포넌트 구조

새 파일: `/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/activity-bar.tsx`

```tsx
interface ActivityBarProps {
  activePanel: 'scenario' | 'palette' | null
  onPanelToggle: (panel: 'scenario' | 'palette') => void
}

export function ActivityBar({ activePanel, onPanelToggle }: ActivityBarProps) {
  return (
    <div className="w-12 border-r border-border bg-muted flex flex-col items-center py-2">
      {/* 상단 패널 아이콘 */}
      <div className="flex flex-col items-center gap-1">
        <ActivityBarIcon
          icon={FolderTree}
          isActive={activePanel === 'scenario'}
          onClick={() => onPanelToggle('scenario')}
          title="Scenario Tree"
        />
        <ActivityBarIcon
          icon={Puzzle}
          isActive={activePanel === 'palette'}
          onClick={() => onPanelToggle('palette')}
          title="Node Palette"
        />
      </div>

      {/* 하단: flex-grow 스페이서 + Settings + ThemeToggle */}
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-1">
        <ActivityBarIcon
          icon={Settings}
          isActive={false}
          onClick={() => {}} // 현재 비활성
          title="Settings"
        />
        <ThemeToggle />
      </div>
    </div>
  )
}
```

**활성 아이콘 스타일 (VS Code 패턴):**
```tsx
function ActivityBarIcon({ icon: Icon, isActive, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        relative w-10 h-10 flex items-center justify-center rounded
        transition-colors
        ${isActive
          ? 'text-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-r'
          : 'text-muted-foreground hover:text-foreground'
        }
      `}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}
```

활성 아이콘 좌측 2px 인디케이터는 `::before` pseudo 요소 또는 absolute div로 구현.

### 패턴 6: ThemeToggle 이동 방법

**현재 위치:** `scenario-builder.tsx` 헤더 영역 (line 84)
**이동 대상:** `activity-bar.tsx` 하단

ThemeToggle 컴포넌트(`/Users/kyh0703/Project/sipflow/frontend/src/components/ui/theme-toggle.tsx`)는 변경 없이 그대로 사용. `scenario-builder.tsx`에서 import 제거, `activity-bar.tsx`에서 import 추가.

현재 ThemeToggle은 `size="icon"` variant `ghost` Button에 `size-8` — Activity Bar 맥락에서는 `ActivityBarIcon` 패턴으로 재렌더링하거나, ThemeToggle을 그대로 사용하되 `className` 오버라이드.

---

## 구현 파일 목록

```
frontend/src/
├── components/ui/
│   └── resizable.tsx                    [신규] shadcn add resizable로 생성
└── features/scenario-builder/
    └── components/
        ├── scenario-builder.tsx          [수정] ResizablePanelGroup 도입, ThemeToggle 제거
        ├── activity-bar.tsx              [신규] Activity Bar 컴포넌트
        ├── scenario-tree.tsx             [변경 없음]
        ├── node-palette.tsx              [변경 없음]
        ├── canvas.tsx                    [변경 없음]
        └── properties-panel.tsx          [변경 없음]
```

---

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|-------------|----------|------|
| 드래그 리사이즈 | 직접 mousedown/mousemove 구현 | `shadcn ResizablePanelGroup` | react-resizable-panels가 키보드 접근성, 드래그 처리 담당 |
| 사이드바 토글 CSS animation | CSS transition width | `panelRef.collapse()/expand()` | CONTEXT.md 결정: 애니메이션 없음 — 라이브러리 기본 동작이 즉시 처리 |
| 아이콘 라이브러리 | 커스텀 SVG | `lucide-react` | 프로젝트 표준 |
| 테마 토글 로직 | 직접 class 조작 | `ThemeToggle` 컴포넌트 재사용 | 기존 구현 재사용 (DRY) |
| 너비 localStorage 저장 | 영속화 | React state (session 내) | CONTEXT.md 결정사항 |

---

## Common Pitfalls

### 함정 1: FileTree 아이콘 존재 여부

**발생하는 문제:** CONTEXT.md에 `FileTree` 아이콘 사용으로 명시되어 있으나, lucide-react v0.563.0에 `FileTree`는 없다.

**확인 방법:**
```bash
node -e "const icons = Object.keys(require('./node_modules/lucide-react')); console.log('FileTree', icons.includes('FileTree'))"
# 출력: FileTree false
```

**사용 가능한 대안:**
```bash
# FolderTree: true, ListTree: true
node -e "const icons = Object.keys(require('./node_modules/lucide-react')); ['FolderTree','ListTree'].forEach(i => console.log(i, icons.includes(i)))"
```

**권장:** `FolderTree` 사용 — 폴더/트리 구조를 가장 직관적으로 표현.

**신뢰도:** HIGH — node_modules 직접 확인.

---

### 함정 2: ResizablePanel collapsible + minSize 상호작용

**발생하는 문제:** `collapsible` prop이 있는 Panel에서 사용자가 드래그로 `minSize` 이하로 줄이면 자동으로 collapse된다. Activity Bar 아이콘 클릭과 별개로 드래그로도 닫힐 수 있다.

**발생 이유:** `react-resizable-panels` 문서: "A collapsible panel will collapse when its size is less than the specified `minSize`"

**피하는 방법:** `collapsible` Panel에 `onCollapse`/`onExpand` 콜백을 추가하여 `activePanel` state와 동기화:
```tsx
<ResizablePanel
  collapsible
  collapsedSize={0}
  panelRef={sidebarRef}
  onCollapse={() => setActivePanel(null)}
  onExpand={() => { /* activePanel은 이미 설정됨 */ }}
>
```

**신뢰도:** HIGH — react-resizable-panels README 직접 확인.

---

### 함정 3: ResizablePanelGroup이 flex container — overflow 주의

**발생하는 문제:** `ResizablePanelGroup`은 내부적으로 `display: flex`를 사용하며 이 스타일은 오버라이드 불가. Panel 내부 컨텐츠가 flex 레이아웃에 맞게 조정되어야 한다.

**발생 이유:** react-resizable-panels 문서: "The following styles cannot be overridden: `display`, `flex-direction`, `flex-wrap`, and `overflow`"

**피하는 방법:**
- Panel 내부에 `h-full overflow-y-auto` 적용 (ScenarioTree, NodePalette, PropertiesPanel)
- 현재 `ScenarioTree`는 `flex flex-col h-full`로 이미 올바르게 구현됨
- `PropertiesPanel`은 현재 `space-y-4`만 있음 — Panel 래퍼에서 `overflow-y-auto p-4` 처리 필요

**신뢰도:** HIGH — react-resizable-panels README 직접 확인.

---

### 함정 4: style.css의 body 색상 충돌

**발생하는 문제:** `/Users/kyh0703/Project/sipflow/frontend/src/style.css`에 `body { color: white; background: rgba(27, 38, 54, 1) }` 하드코딩이 있어, Tailwind/shadcn 테마 색상과 충돌할 수 있다.

**현재 상태 확인:**
```css
/* style.css */
html { background-color: rgba(27, 38, 54, 1); color: white; }
body { margin: 0; color: white; }
```

**분석:** `index.css`의 `@layer base { body { @apply bg-background text-foreground; } }`가 우선 적용되므로 현재는 큰 문제 없음. 그러나 Activity Bar 배경(`bg-muted`)이 의도대로 렌더링되는지 확인 필요.

**권장:** Phase 12에서는 건드리지 않음. style.css 정리는 별도 리팩토링으로 처리.

---

### 함정 5: ResizablePanelGroup과 ReactFlow의 충돌

**발생하는 문제:** ReactFlow(`Canvas` 컴포넌트)는 `h-full w-full`을 가정한다. ResizablePanel 내부에서 부모 크기 변경 시 ReactFlow가 재계산해야 한다.

**현재 Canvas 구조:**
```tsx
// canvas.tsx
<ReactFlow ... fitView>
  <Background ... />
  <Controls />
  <MiniMap />
</ReactFlow>
```

**분석:** ReactFlow는 내부적으로 ResizeObserver를 사용하므로 Panel 크기 변경 시 자동으로 적응한다. 별도 처리 불필요.

**신뢰도:** HIGH — ReactFlow 문서 및 기존 동작 패턴 확인.

---

### 함정 6: v4 API 변경 — direction → orientation

**발생하는 문제:** react-resizable-panels v3에서 v4로 올라가면서 `direction` prop이 `orientation`으로 변경됨. shadcn resizable 문서 예제에 v3/v4 혼재.

**현재 설치 버전:** v4.6.4 (node_modules 확인)

**올바른 사용:**
```tsx
// v4 (현재)
<ResizablePanelGroup orientation="horizontal">

// v3 (구버전, 사용 금지)
<ResizablePanelGroup direction="horizontal">
```

**신뢰도:** HIGH — react-resizable-panels README "v4 API Changes" 섹션 직접 확인.

---

## Code Examples

### 예시 1: 수정된 ScenarioBuilder — ResizablePanelGroup 적용

```tsx
// scenario-builder.tsx (수정 후 핵심 구조)
import { useState, useRef } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ActivityBar } from './activity-bar';

export function ScenarioBuilder() {
  const [activePanel, setActivePanel] = useState<'scenario' | 'palette' | null>('scenario')
  const sidebarRef = useRef<ImperativePanelHandle>(null)

  const handlePanelToggle = (panel: 'scenario' | 'palette') => {
    if (activePanel === panel && !sidebarRef.current?.isCollapsed()) {
      sidebarRef.current?.collapse()
      setActivePanel(null)
    } else {
      sidebarRef.current?.expand()
      setActivePanel(panel)
    }
  }

  return (
    <ReactFlowProvider>
      <DnDProvider>
        <Toaster position="bottom-right" richColors />
        <div className="flex flex-col h-screen w-screen">
          {/* Header — ThemeToggle 없음 */}
          <div className="h-10 border-b border-border bg-background flex items-center justify-between px-4">
            {/* ... 기존 헤더 내용 (ThemeToggle 제거) ... */}
          </div>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Activity Bar (고정 48px) */}
            <ActivityBar
              activePanel={activePanel}
              onPanelToggle={handlePanelToggle}
            />

            {/* Resizable layout */}
            <ResizablePanelGroup orientation="horizontal" className="flex-1">
              {/* 좌측 사이드바 */}
              <ResizablePanel
                defaultSize={17}
                minSize={15}
                maxSize={30}
                collapsible
                collapsedSize={0}
                panelRef={sidebarRef}
                onCollapse={() => setActivePanel(null)}
              >
                <div className="h-full overflow-y-auto">
                  {activePanel === 'scenario' && <ScenarioTree />}
                  {activePanel === 'palette' && (
                    <div className="p-3">
                      <NodePalette />
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* 캔버스 */}
              <ResizablePanel defaultSize={61}>
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex-1">
                    <Canvas />
                  </div>
                  {/* 실행 패널 (기존과 동일) */}
                  {executionStatus !== 'idle' && (
                    <div className="border-t border-border bg-background">
                      {/* ... 기존 탭 패널 ... */}
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* 우측 Properties */}
              <ResizablePanel
                defaultSize={22}
                minSize={15}
                maxSize={30}
              >
                <div className="h-full overflow-y-auto p-4">
                  <PropertiesPanel />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </DnDProvider>
    </ReactFlowProvider>
  )
}
```

**defaultSize 합계 검증:** 17 + 61 + 22 = 100 (정확히 100%)

### 예시 2: ActivityBar 컴포넌트 완전한 구현

```tsx
// activity-bar.tsx
import { FolderTree, Puzzle, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

interface ActivityBarProps {
  activePanel: 'scenario' | 'palette' | null
  onPanelToggle: (panel: 'scenario' | 'palette') => void
}

interface ActivityIconProps {
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  onClick: () => void
  title: string
  disabled?: boolean
}

function ActivityIcon({ icon: Icon, isActive, onClick, title, disabled = false }: ActivityIconProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'relative w-10 h-10 flex items-center justify-center rounded transition-colors',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {/* 활성 인디케이터: 좌측 2px 바 */}
      {isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r" />
      )}
      <Icon className="w-5 h-5" />
    </button>
  )
}

export function ActivityBar({ activePanel, onPanelToggle }: ActivityBarProps) {
  return (
    <div className="w-12 border-r border-border bg-muted flex flex-col items-center py-2 shrink-0">
      {/* 상단: 패널 전환 아이콘 */}
      <div className="flex flex-col items-center gap-1">
        <ActivityIcon
          icon={FolderTree}
          isActive={activePanel === 'scenario'}
          onClick={() => onPanelToggle('scenario')}
          title="Scenario Tree"
        />
        <ActivityIcon
          icon={Puzzle}
          isActive={activePanel === 'palette'}
          onClick={() => onPanelToggle('palette')}
          title="Node Palette"
        />
      </div>

      {/* 중간: 스페이서 */}
      <div className="flex-1" />

      {/* 하단: 설정 + 테마 토글 */}
      <div className="flex flex-col items-center gap-1">
        <ActivityIcon
          icon={Settings}
          isActive={false}
          onClick={() => {}} // Phase 12에서는 비활성
          title="Settings"
          disabled
        />
        <ThemeToggle />
      </div>
    </div>
  )
}
```

### 예시 3: ThemeToggle Activity Bar 통합

현재 `ThemeToggle`(`theme-toggle.tsx`)은 `Button variant="ghost" size="icon" className="size-8"`로 구현됨. Activity Bar에서 그대로 재사용할 수 있다.

```tsx
// theme-toggle.tsx는 변경 불필요
// Activity Bar 하단에 직접 배치:
<ThemeToggle />
// size-8 = 32px 버튼 → Activity Bar 48px 내에서 적절한 크기
```

---

## 현재 코드베이스 상태 (Phase 12 진입 기준)

### 이미 구현 완료된 것 (Phase 12에서 재사용/이동)
| 항목 | 위치 | Phase 12 활용 |
|------|------|--------------|
| `ScenarioTree` | scenario-tree.tsx | 변경 없이 재사용, 사이드바 패널로 배치 |
| `NodePalette` | node-palette.tsx | 변경 없이 재사용, 사이드바 패널로 배치 |
| `PropertiesPanel` | properties-panel.tsx | 변경 없이 재사용, ResizablePanel 내 배치 |
| `Canvas` | canvas.tsx | 변경 없이 재사용 |
| `ThemeToggle` | components/ui/theme-toggle.tsx | Activity Bar 하단으로 이동 (컴포넌트 변경 없음) |
| `cn()` 유틸 | lib/utils.ts | ActivityBar 클래스 조합에 사용 |
| `react-resizable-panels` | node_modules (v4.6.4) | `npx shadcn add resizable` 후 즉시 사용 가능 |
| shadcn/ui 설정 | components.json | new-york 스타일, cssVariables 활성 |

### Phase 12에서 신규 구현
| 항목 | 위치 | 세부 내용 |
|------|------|---------|
| `resizable.tsx` | components/ui/resizable.tsx | shadcn add resizable로 생성 |
| `ActivityBar` 컴포넌트 | scenario-builder/components/activity-bar.tsx | 신규 파일 |
| `ActivityIcon` 내부 컴포넌트 | activity-bar.tsx 내 | 재사용 가능한 아이콘 버튼 |
| `ScenarioBuilder` 리팩토링 | scenario-builder.tsx | ResizablePanelGroup 도입, ThemeToggle 제거, ActivePanel state 추가 |

### Phase 12에서 수정되는 것
| 항목 | 수정 내용 |
|------|---------|
| `scenario-builder.tsx` | 레이아웃 재구성 (ResizablePanelGroup), ThemeToggle import/usage 제거, activePanel state 추가 |

---

## Test Strategy

### 기능 검증 체크리스트 (수동 테스트)
1. **UI-01 — Activity Bar 토글:**
   - ScenarioTree 아이콘 클릭 → ScenarioTree 패널 열림, 아이콘 활성 표시
   - 동일 아이콘 다시 클릭 → 사이드바 닫힘, 캔버스 전체 너비 사용
   - NodePalette 아이콘 클릭 → NodePalette로 전환 (ScenarioTree 닫힘 없이 교체)
   - 사이드바 닫힌 상태에서 NodePalette 아이콘 클릭 → 열림

2. **UI-02 — Resizable:**
   - 좌측 사이드바 경계 드래그 → 너비 조절 가능
   - 우측 Properties 경계 드래그 → 너비 조절 가능
   - 조절된 너비가 페이지 내에서 유지됨 (React state)

3. **기존 기능 회귀 테스트:**
   - ScenarioTree: 시나리오 생성/로드/삭제/이름변경 동작
   - NodePalette: 드래그앤드롭으로 캔버스에 노드 추가
   - PropertiesPanel: 노드 선택 시 Properties 표시
   - ThemeToggle: Activity Bar 하단에서 테마 전환

---

## Open Questions

### Q1: shadcn resizable.tsx 생성 후 import 경로

`npx shadcn@latest add resizable` 실행 시 `components.json`의 aliases 설정에 따라:
- `aliases.ui: "@/components"` 설정 → `@/components/ui/resizable`로 import

**권장:** 설치 후 생성된 파일의 실제 export 이름 확인 (`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`).

### Q2: ImperativePanelHandle import 경로 (v4)

```tsx
// v3 (구버전)
import type { ImperativePanelHandle } from "react-resizable-panels"

// v4에서 동일하게 사용 가능한지 확인 필요
// 대안: usePanelRef 훅 사용
import { usePanelRef } from "react-resizable-panels"
const sidebarRef = usePanelRef()
```

**권장:** `shadcn add resizable` 후 생성된 `resizable.tsx`에서 re-export되는 타입 확인.

### Q3: NodePalette 패딩 처리

현재 `NodePalette`는 패딩 없이 렌더링되며, `scenario-builder.tsx`에서 `<div className="flex-1 overflow-y-auto p-3">`로 감싸서 패딩을 줬다. ResizablePanel로 이동 시 동일한 패딩 래퍼 유지 필요.

---

## Sources

### Primary (HIGH 신뢰도 — 소스 직접 확인)
- `/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/scenario-builder.tsx` — 현재 레이아웃 구조 전체
- `/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/scenario-tree.tsx` — ScenarioTree 컴포넌트 구조
- `/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/node-palette.tsx` — NodePalette 컴포넌트 구조
- `/Users/kyh0703/Project/sipflow/frontend/src/features/scenario-builder/components/properties-panel.tsx` — PropertiesPanel 구조
- `/Users/kyh0703/Project/sipflow/frontend/src/components/ui/theme-toggle.tsx` — ThemeToggle 현재 구현
- `/Users/kyh0703/Project/sipflow/frontend/src/index.css` — Tailwind v4 + shadcn CSS 변수 설정
- `/Users/kyh0703/Project/sipflow/frontend/src/main.tsx` — ThemeProvider 설정
- `/Users/kyh0703/Project/sipflow/frontend/components.json` — shadcn/ui 설정 (new-york, aliases)
- `/Users/kyh0703/Project/sipflow/frontend/package.json` — 의존성 버전 확인
- `/Users/kyh0703/Project/sipflow/frontend/node_modules/react-resizable-panels/README.md` — API 전체 (Group, Panel, Separator props, v4 변경사항)
- `node -e "Object.keys(require('./node_modules/lucide-react'))"` — FileTree 미존재, FolderTree/ListTree 존재 직접 확인
- `ls node_modules/react-resizable-panels/` → `package.json "version": "4.6.4"` — 버전 확인

### Secondary (MEDIUM 신뢰도)
- shadcn/ui Resizable 문서 (https://ui.shadcn.com/docs/components/resizable) — 컴포넌트 API 개요
- `.planning/phases/12-ui-redesign/CONTEXT.md` — 사용자 결정사항 (결정 섹션)
- `.planning/ROADMAP.md` — Phase 12 성공 기준

---

## Metadata

**신뢰도 세분화:**
- 현재 레이아웃 구조 파악: HIGH — 소스 코드 직접 확인
- react-resizable-panels v4 API: HIGH — README 직접 확인
- `FileTree` 아이콘 미존재: HIGH — node_modules 직접 확인
- `FolderTree`/`ListTree` 대안: HIGH — node_modules 직접 확인
- minSize/maxSize 퍼센트 환산: MEDIUM — 화면 크기 가변이므로 근사값
- `collapsible` + Activity Bar 토글 패턴: HIGH — API 문서 직접 확인
- shadcn resizable.tsx 설치 후 exact API: MEDIUM — 설치 전이므로 예상 기반

**연구 날짜:** 2026-02-19
**유효 기한:** 60일 (react-resizable-panels v4.6.4, lucide-react v0.563.0 고정)
