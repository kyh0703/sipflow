# Phase 04: 실행 모니터 — 시각화 및 로그 구현 - Research

**Researched:** 2026-02-10
**Domain:** Real-time visualization, SVG animation, Timeline UI, Log management
**Confidence:** HIGH

## Summary

Phase 04는 시나리오 실행 상태를 실시간으로 시각화하는 세 가지 핵심 기능을 구현한다: (1) XYFlow 캔버스에서 SVG animateMotion을 사용한 엣지 메시지 애니메이션, (2) SIP 메시지 상세 정보를 포함한 로그 패널 개선, (3) 시간축 기반 SIP 메시지 시퀀스를 표시하는 타임라인 패널.

Phase 03에서 이미 기본적인 실행 인프라(ExecutionStore, 이벤트 구독, 노드 상태 시각화, 기본 로그 패널)가 구축되어 있으므로, Phase 04는 이를 확장하여 더 풍부한 시각적 피드백과 디버깅 도구를 제공한다.

기술 스택은 기존 @xyflow/react 12.x, React 18.x, TypeScript 5.x, Zustand, Tailwind CSS v4를 계속 사용하며, 새로운 기능을 위해 SVG 네이티브 animateMotion 요소와 타임라인 시각화를 추가한다.

**주요 권장사항:** XYFlow의 공식 AnimatedSVGEdge 패턴을 사용하고, 로그 가상화는 TanStack Virtual로 구현하며, 타임라인은 커스텀 SVG 기반 래더 다이어그램으로 구현한다.

## Standard Stack

### Core (이미 사용 중)
| 라이브러리 | 버전 | 목적 | 표준인 이유 |
|-----------|------|------|------------|
| @xyflow/react | 12.10.0 | 노드 에디터 + 엣지 애니메이션 | Phase 02-03에서 사용, 공식 animateMotion 지원 |
| React | 18.2.0 | UI 프레임워크 | 프로젝트 표준 |
| TypeScript | 5.x | 타입 안전성 | 프로젝트 표준 |
| Zustand | 5.0.11 | 상태 관리 | Phase 03에서 ExecutionStore 구현 |
| Tailwind CSS | 4.1.18 | 스타일링 | Phase 01-02에서 채택 |
| shadcn/ui | latest | UI 컴포넌트 | Phase 01-02에서 채택 |

### Supporting (새로 추가 필요)
| 라이브러리 | 버전 | 목적 | 사용 시점 |
|-----------|------|------|----------|
| @tanstack/react-virtual | 3.x | 로그 가상화 | 로그 500개 이상 시 성능 개선 |
| sonner | 2.0.7 | Toast 알림 | alert() 대체, 이미 package.json에 존재 |

### Alternatives Considered
| 대신 | 사용 가능 | 트레이드오프 |
|------|----------|------------|
| XYFlow BaseEdge | Custom SVG edge with animateMotion | BaseEdge + animateMotion이 공식 패턴, 커스텀 구현 불필요 |
| react-window | @tanstack/react-virtual | TanStack Virtual이 더 유연하고 최신, 하지만 react-window도 충분 |
| MermaidJS | Custom SVG timeline | Mermaid는 정적, 커스텀 SVG가 실시간 업데이트에 적합 |
| JointJS | Custom SVG timeline | JointJS는 무겁고 상용, 간단한 래더 다이어그램에는 과함 |

**설치:**
```bash
# 프론트엔드 디렉토리에서
cd frontend
npm install @tanstack/react-virtual
# sonner는 이미 설치됨 (package.json 확인)
```

## Architecture Patterns

### 권장 프로젝트 구조
```
frontend/src/features/scenario-builder/
├── components/
│   ├── execution-toolbar.tsx       # 이미 존재 (03-07)
│   ├── execution-log.tsx           # 이미 존재, 확장 필요
│   ├── execution-timeline.tsx      # 신규: 타임라인 패널
│   ├── edges/
│   │   ├── branch-edge.tsx         # 이미 존재
│   │   └── animated-message-edge.tsx  # 신규: animateMotion 엣지
│   └── nodes/                      # 노드 상태 시각화 이미 구현 (03-07)
├── store/
│   └── execution-store.ts          # 이미 존재, SIP 메시지 추가 필요
├── types/
│   └── execution.ts                # 이미 존재, SIP 메시지 타입 추가
└── hooks/
    └── use-engine-api.ts           # 이미 존재
```

### 패턴 1: XYFlow AnimatedSVGEdge with animateMotion
**설명:** XYFlow의 공식 패턴으로, BaseEdge와 SVG animateMotion 요소를 결합하여 엣지를 따라 움직이는 입자 애니메이션 구현
**사용 시점:** 노드 간 SIP 메시지 흐름을 시각화할 때
**예시:**
```typescript
// 소스: https://reactflow.dev/examples/edges/animating-edges
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function AnimatedMessageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // data.messages: { id, timestamp, method }[]
  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {data?.messages?.map((msg: any) => (
        <circle key={msg.id} r="6" fill="#3b82f6">
          <animateMotion
            dur="1s"
            path={edgePath}
            begin={`${msg.timestamp}ms`}
            fill="remove"  // 애니메이션 완료 후 원래 위치로
          />
        </circle>
      ))}
    </>
  );
}
```

**핵심:**
- `getSmoothStepPath()` 또는 `getBezierPath()`로 경로 생성
- `<animateMotion>`의 `dur` 속성으로 속도 제어
- `begin` 속성으로 타이밍 조절
- `repeatCount="indefinite"` 대신 실제 메시지 이벤트에 동기화

### 패턴 2: Zustand Execution Store 확장 (SIP 메시지 추가)
**설명:** 기존 ExecutionStore에 SIP 메시지 정보를 추가하여 로그/타임라인에서 사용
**사용 시점:** ActionLogEvent에 SIP 메시지 상세 정보 포함 시
**예시:**
```typescript
// execution.ts 타입 확장
export interface SIPMessageDetail {
  direction: 'sent' | 'received';
  method?: string;          // INVITE, BYE, ACK
  responseCode?: number;    // 200, 180, 404
  callId?: string;
  from?: string;
  to?: string;
  body?: string;            // SDP 등
}

export interface ActionLogEvent {
  timestamp: number;
  nodeId: string;
  instanceId: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  sipMessage?: SIPMessageDetail;  // 추가
}
```

**백엔드 연동:** Go의 `engine.emitActionLog()`에서 SIP 메시지 파싱하여 이벤트에 포함

### 패턴 3: TanStack Virtual을 사용한 로그 가상화
**설명:** 로그가 500개 이상일 때 가상 스크롤로 DOM 노드 최소화
**사용 시점:** 로그 항목이 많아질 때 성능 개선
**예시:**
```typescript
// 소스: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

function ExecutionLog() {
  const actionLogs = useExecutionStore((state) => state.actionLogs);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: actionLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,  // 각 로그 행 높이
    overscan: 10,            // 버퍼 행 수
  });

  return (
    <div ref={parentRef} className="max-h-[200px] overflow-y-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const log = actionLogs[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <LogRow log={log} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 패턴 4: Custom SVG Timeline (SIP Ladder Diagram)
**설명:** SVG로 간단한 래더 다이어그램 구현 (외부 라이브러리 없이)
**사용 시점:** SIP 메시지 시퀀스를 시간축에 표시
**예시:**
```tsx
// execution-timeline.tsx
function ExecutionTimeline() {
  const actionLogs = useExecutionStore((state) => state.actionLogs);
  const sipMessages = actionLogs.filter((log) => log.sipMessage);

  // 인스턴스별 레인 배치
  const lanes = useMemo(() => {
    const uniqueInstances = [...new Set(sipMessages.map((log) => log.instanceId))];
    return uniqueInstances;
  }, [sipMessages]);

  const laneWidth = 150;
  const messageHeight = 40;

  return (
    <div className="border-t border-border bg-background p-4">
      <svg width={lanes.length * laneWidth} height={sipMessages.length * messageHeight}>
        {/* 수직 라인 (각 인스턴스) */}
        {lanes.map((lane, i) => (
          <g key={lane}>
            <line
              x1={i * laneWidth + laneWidth / 2}
              y1={0}
              x2={i * laneWidth + laneWidth / 2}
              y2={sipMessages.length * messageHeight}
              stroke="#ccc"
              strokeWidth={2}
            />
            <text x={i * laneWidth + laneWidth / 2} y={15} textAnchor="middle">
              {lane}
            </text>
          </g>
        ))}

        {/* 메시지 화살표 */}
        {sipMessages.map((msg, i) => {
          const fromIndex = lanes.indexOf(msg.instanceId);
          const toIndex = msg.sipMessage?.direction === 'sent'
            ? fromIndex + 1
            : fromIndex - 1;

          if (toIndex < 0 || toIndex >= lanes.length) return null;

          const y = i * messageHeight + 30;
          return (
            <g key={msg.id}>
              <line
                x1={fromIndex * laneWidth + laneWidth / 2}
                y1={y}
                x2={toIndex * laneWidth + laneWidth / 2}
                y2={y}
                stroke="#3b82f6"
                strokeWidth={1}
                markerEnd="url(#arrowhead)"
              />
              <text x={(fromIndex + toIndex) * laneWidth / 2} y={y - 5} fontSize={10}>
                {msg.sipMessage?.method || msg.sipMessage?.responseCode}
              </text>
            </g>
          );
        })}

        {/* 화살표 마커 정의 */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
```

### 패턴 5: Sonner Toast로 alert() 대체
**설명:** alert() 대신 shadcn/ui의 권장 toast 라이브러리 sonner 사용
**사용 시점:** 에러/성공 메시지 표시
**예시:**
```typescript
// 소스: https://ui.shadcn.com/docs/components/radix/toast
import { toast } from 'sonner';

// App.tsx에서 한 번 설정
import { Toaster } from 'sonner';

export function App() {
  return (
    <>
      <Toaster position="top-right" />
      {/* ... */}
    </>
  );
}

// execution-toolbar.tsx에서 사용
const handleStart = async () => {
  try {
    await startScenario(currentScenarioId);
  } catch (error) {
    toast.error('Failed to start scenario', {
      description: String(error),
    });
  }
};
```

### 피해야 할 안티패턴
- **엣지 애니메이션을 stroke-dasharray로 구현:** XYFlow 성능 이슈 확인됨, animateMotion 사용
- **모든 로그를 DOM에 렌더링:** 500개 이상 시 가상화 필수
- **타임라인을 외부 라이브러리(JointJS/MermaidJS)로 구현:** 오버엔지니어링, 커스텀 SVG가 충분
- **alert() 계속 사용:** UX 저하, sonner로 교체

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|-------------|----------|------|
| 엣지 애니메이션 | 커스텀 Canvas/WebGL 애니메이션 | XYFlow BaseEdge + animateMotion | 공식 패턴, 성능 검증됨 |
| 로그 가상화 | 직접 IntersectionObserver 구현 | @tanstack/react-virtual | 동적 높이, 스크롤 동기화 등 엣지 케이스 처리됨 |
| Toast 알림 | 커스텀 모달/알림 컴포넌트 | sonner | 접근성, 스택 관리, 모바일 최적화 |
| 타임스탬프 포맷팅 | moment.js | 네이티브 Date + 커스텀 함수 | moment.js 무겁고, 간단한 HH:MM:SS.mmm는 Date로 충분 |

**핵심 통찰:** 시각화 라이브러리는 이미 있는 것(@xyflow, @tanstack/virtual)을 활용하고, 커스텀 구현은 간단한 SVG 타임라인에만 한정한다.

## Common Pitfalls

### 함정 1: animateMotion 메모리 누수
**발생하는 문제:** 엣지가 삭제되어도 animateMotion 애니메이션이 계속 실행되어 메모리 누수 발생
**발생 이유:** React가 SVG 애니메이션을 자동으로 정리하지 않음
**피하는 방법:**
- 애니메이션 완료 시 circle 요소 제거 (`fill="remove"` 또는 `onEnd` 핸들러)
- 엣지 data에서 완료된 메시지 제거
- XYFlow 12.x는 z-index 변경 시 더 이상 unmount하지 않으므로 useEffect cleanup 필수
**경고 신호:** Chrome DevTools Memory Profiler에서 Detached DOM nodes 증가

### 함정 2: 로그 자동 스크롤 성능 저하
**발생하는 문제:** 새 로그 추가 시 scrollIntoView()가 매번 레이아웃 재계산 유발
**발생 이유:** scrollIntoView({ behavior: 'smooth' })가 리플로우 트리거
**피하는 방법:**
- 가상화 사용 시 virtualizer의 scrollToIndex() 사용
- 또는 조건부로만 스크롤 (`isAtBottom` 체크)
- 디바운스 적용 (100ms)
**경고 신호:** Performance 탭에서 Layout Shift 빈번히 발생

### 함정 3: Zustand 선택자 과도한 재렌더링
**발생하는 문제:** ExecutionStore에서 전체 actionLogs 구독 시 로그 추가마다 모든 컴포넌트 재렌더링
**발생 이유:** Zustand는 참조 동등성으로 변경 감지, 배열은 매번 새로운 참조
**피하는 방법:**
- useShallow 사용: `useExecutionStore(useShallow((state) => state.actionLogs))`
- 또는 특정 필드만 선택: `useExecutionStore((state) => state.actionLogs.length)`
- 필요 시 memo() 래핑
**경고 신호:** React DevTools Profiler에서 ExecutionLog 컴포넌트 빈번한 렌더링

### 함정 4: 타임라인 SVG 크기 계산 오류
**발생하는 문제:** 메시지 많을 때 SVG가 화면을 벗어나거나 겹침
**발생 이유:** 고정 크기로 계산, 동적 메시지 수 미반영
**피하는 방법:**
- SVG를 스크롤 가능한 컨테이너에 배치
- viewBox 동적 계산: `viewBox="0 0 ${width} ${height}"`
- 또는 Canvas fallback (100개 이상 메시지 시)
**경고 신호:** 수평 스크롤이 없어서 메시지가 잘림

### 함정 5: Unix 타임스탬프 단위 혼동
**발생하는 문제:** Go에서 milliseconds, JavaScript에서 seconds 혼용 시 시간 표시 오류
**발생 이유:** Go의 time.Now().UnixMilli() vs JavaScript의 Date.now() 단위 차이
**피하는 방법:**
- Go에서 항상 milliseconds 사용: `time.Now().UnixNano() / 1e6`
- TypeScript 타입에 명시: `timestamp: number; // milliseconds since epoch`
- 변환 유틸: `const date = new Date(timestamp); // timestamp는 밀리초`
**경고 신호:** 타임스탬프가 1970년 또는 5000년대로 표시됨

## Code Examples

공식 소스에서 검증된 패턴:

### XYFlow Animated Edge 등록
```typescript
// 소스: https://reactflow.dev/examples/edges/animating-edges
import { ReactFlow } from '@xyflow/react';
import { AnimatedMessageEdge } from './edges/animated-message-edge';

const edgeTypes = {
  branch: BranchEdge,           // 기존 엣지
  animated: AnimatedMessageEdge, // 신규 애니메이션 엣지
};

function Canvas() {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      // ...
    />
  );
}
```

### Sonner Toast 사용
```typescript
// 소스: https://ui.shadcn.com/docs/components/radix/toast
import { toast } from 'sonner';

// 성공
toast.success('Scenario started');

// 에러
toast.error('Failed to start scenario', {
  description: error.message,
});

// 정보
toast.info('Scenario completed', {
  description: '12 messages sent',
});
```

### TanStack Virtual 기본 설정
```typescript
// 소스: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 24,
  overscan: 5,
});
```

### Zustand useShallow로 최적화
```typescript
// 소스: https://github.com/pmndrs/zustand
import { useShallow } from 'zustand/react/shallow';

// 나쁜 예: 매번 재렌더링
const actionLogs = useExecutionStore((state) => state.actionLogs);

// 좋은 예: 얕은 비교
const actionLogs = useExecutionStore(useShallow((state) => state.actionLogs));
```

### 타임스탬프 포맷팅 (milliseconds)
```typescript
// 소스: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp); // timestamp는 밀리초
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}
```

## State of the Art

| 이전 접근법 | 현재 접근법 | 변경 시점 | 영향 |
|------------|-----------|----------|------|
| stroke-dasharray 애니메이션 | SVG animateMotion | 2024 | XYFlow 성능 이슈로 공식 권장 변경 |
| react-virtualized | @tanstack/react-virtual | 2023-2024 | 더 가벼운 번들, 더 유연한 API |
| shadcn/ui Toast | Sonner | 2024-2025 | shadcn/ui에서 Toast 폐기, Sonner 권장 |
| moment.js | 네이티브 Temporal API (미래) | 2026+ (예상) | Temporal은 아직 Stage 3, 현재는 Date 사용 |

**폐기됨/구식:**
- `stroke-dasharray` 기반 엣지 애니메이션: XYFlow에서 성능 문제 확인, animateMotion 사용 권장
- `react-window` (완전 폐기는 아님): @tanstack/virtual이 더 현대적, 하지만 react-window도 여전히 사용 가능
- `shadcn/ui Toast 컴포넌트`: 공식 문서에서 Sonner로 대체 명시

## Open Questions

완전히 해결할 수 없었던 것:

1. **타임라인 vs 래더 다이어그램: 어느 정도 복잡도가 적정한가?**
   - 아는 것: 커스텀 SVG로 간단한 래더 다이어그램 구현 가능, JointJS/MermaidJS는 무겁거나 정적
   - 불명확한 것: 실제 SIP 디버깅 시 필요한 정보 밀도, 100개 이상 메시지 시 성능
   - 권장사항: MVP는 간단한 SVG 래더 다이어그램, 필요 시 Canvas fallback 또는 페이지네이션

2. **XYFlow 메모리 누수: 얼마나 심각한가?**
   - 아는 것: GitHub 이슈에서 zoom/resize 시 메모리 증가 보고됨 (4973, 4943)
   - 불명확한 것: animateMotion 사용 시 동일한 문제 발생 여부, 공식 수정 계획
   - 권장사항: 개발 중 Chrome DevTools Memory Profiler로 모니터링, 장기 실행 시 메모리 검증

3. **로그 가상화: 500개 제한을 유지하면서도 필요한가?**
   - 아는 것: 현재 ExecutionStore는 최대 500개 로그 유지 (03-05)
   - 불명확한 것: 500개도 가상화 필요 여부, 성능 임계점
   - 권장사항: 일단 가상화 없이 구현, 성능 이슈 발생 시 추가

4. **엣지 애니메이션 타이밍: 실제 SIP 메시지 타이밍 vs 시각적 효과**
   - 아는 것: animateMotion의 `begin` 속성으로 타이밍 조절 가능
   - 불명확한 것: 실제 SIP 메시지 간격(수십 밀리초)을 그대로 표시할지, 시각적으로 늘릴지
   - 권장사항: 기본 1초 애니메이션, 옵션으로 실제 타이밍 사용 가능하도록

## Sources

### Primary (HIGH 신뢰도)
- [React Flow Animating Edges 공식 문서](https://reactflow.dev/examples/edges/animating-edges) - animateMotion 패턴
- [React Flow Edge Markers 공식 문서](https://reactflow.dev/examples/edges/markers) - 커스텀 마커
- [TanStack Virtual 공식 문서](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual) - 가상화 패턴
- [shadcn/ui Toast 공식 문서](https://ui.shadcn.com/docs/components/radix/toast) - Sonner 권장
- [MDN Date Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) - 타임스탬프 포맷팅
- [Zustand GitHub](https://github.com/pmndrs/zustand) - useShallow 패턴

### Secondary (MEDIUM 신뢰도)
- [Tuning Edge Animations in Reactflow for Optimal Performance](https://liambx.com/blog/tuning-edge-animations-reactflow-optimal-performance) - stroke-dasharray 성능 이슈 확인
- [React Virtualization Showdown: TanStack vs React-Window](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83) - 성능 비교
- [Optimizing React Performance with Zustand](https://tillitsdone.com/blogs/react-performance-with-zustand/) - 선택자 최적화
- [Shadcn/ui React Series: Sonner](https://medium.com/@rivainasution/shadcn-ui-react-series-part-19-sonner-modern-toast-notifications-done-right-903757c5681f) - Sonner 사용법

### Tertiary (LOW 신뢰도)
- [SIP Diagrams (MermaidJS)](https://sip-diagrams.netlify.app/) - SIP 래더 다이어그램 예시, 하지만 정적 생성
- [XYFlow Memory Leak Issues #4973, #4943](https://github.com/xyflow/xyflow/issues/4973) - 미해결 이슈, 모니터링 필요

## Metadata

**신뢰도 세분화:**
- 표준 스택: HIGH - @xyflow, React, Zustand 모두 프로젝트에서 검증됨, 공식 문서 확인
- 아키텍처: HIGH - XYFlow animateMotion은 공식 예제, TanStack Virtual은 공식 문서
- 함정: MEDIUM - 일부는 GitHub 이슈 기반 (메모리 누수), 일부는 공식 문서 (useShallow)

**연구 날짜:** 2026-02-10
**유효 기한:** 30일 (안정적인 기술 스택, 하지만 XYFlow 메모리 이슈는 진행 중)
