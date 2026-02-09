# Phase 02: 시나리오 빌더 — 캔버스 및 노드 시스템 - Research

**Researched:** 2026-02-09
**Domain:** @xyflow/react v12 Node Editor, Zustand State Management, SQLite in Go, DAG Validation
**Confidence:** HIGH

## Summary

This research covers how to build a node-based scenario editor using @xyflow/react v12, integrated with Zustand for state management, SQLite for persistence, and DAG validation algorithms. The core challenge is implementing a three-panel layout with drag-and-drop node creation, custom node rendering with multiple handles for branching logic, and real-time cycle detection.

@xyflow/react v12 (formerly reactflow) provides a mature foundation for node-based UIs with built-in pan/zoom, drag-and-drop support, and TypeScript-first design. The library internally uses Zustand, making it the natural choice for state management. Custom nodes are React components with injected props, and handles can have unique IDs to support success/failure branching.

For persistence, modernc.org/sqlite provides a CGo-free SQLite driver that works seamlessly in Go desktop applications. The tradeoff is ~2x slower INSERT performance compared to mattn/go-sqlite3, but eliminates C compiler dependencies and simplifies cross-compilation—critical for Wails v2 desktop apps.

DAG validation uses depth-first search with a visited set to detect cycles in O(V+E) time. React Flow provides helper functions like `getOutgoers()` to traverse the graph, and the `isValidConnection` callback intercepts edge creation for real-time validation.

**Key Recommendation:** Use @xyflow/react's built-in drag-and-drop example pattern with a DnD context provider. Store nodes/edges in Zustand for global access from custom nodes. Serialize flows as JSON with custom metadata for SIP-specific properties (instance assignments, command parameters). Use modernc.org/sqlite for local storage to avoid CGo complications in Wails builds.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**노드 카테고리:** 3종류 — SIP Instance, Command, Event

**SIP Instance 노드 (플로우 시작점):**
- SIP 인스턴스 노드가 각 플로우의 시작점 역할
- 내선(DN) 방식: DN + Register 옵션 필요
- Endpoint 방식: SIP 서버 목록에서 선택, Register 불필요
- Ready 커맨드는 인스턴스 노드 내부 동작으로 통합됨

**Command 노드 (MVP Phase 2 기본):**
- Ready — SIP 인스턴스 준비 (인스턴스 노드에 포함)
- MakeCall — INVITE 전달 (발신)
- Answer — 200 OK 전달 (응답)
- Release — Cancel/BYE 전달 (종료)

**Command 노드 (이후 Phase에서 추가):** — 범위 밖
- Ringing, Hold, Retrieve, Single Transfer, Mute Transfer, Response

**Event 노드 (전체):**
- INCOMING, DISCONNECTED, RINGING, TIMEOUT, HELD, RETRIEVED, TRANSFERRED, NOTIFY

**프로토콜 추상화 전략:** SIP 프로토콜 메시지명 대신 추상화된 액션명 사용

**시각 디자인:**
- Command 노드: 파란 계열 직사각형
- Event 노드: 노란 계열 둥근 모서리
- SIP Instance 노드: 별도 시각적 스타일 (시작점 표현)
- 노드 내부: 액션명 + 핵심 속성 1-2개 표시
- 핸들(포트): 상→하 플로우, 상단 입력 1개, 하단 성공(녹색)+실패(빨간색) 출력 2개

**3칸 구조:**
- 좌측(~200px 팔레트+트리)
- 중앙(캔버스)
- 우측(~280px 속성)

**좌측 사이드바:**
- 상단 시나리오 파일 트리 (animate-ui.com Files 트리)
- 하단 노드 팔레트

**노드 추가:** 드래그 앤 드롭

**캔버스 배경:** 도트 그리드

**속성 패널:** 노드별 전용 폼, 미선택 시 빈 상태

**SIP 인스턴스 모델:**
- SIP 인스턴스가 캔버스의 노드로 존재 (별도 패널 아님), 플로우 시작점
- 내선(DN) 방식: DN번호 + Register ON
- Endpoint 방식: Register OFF, 서버 목록 선택
- SIP 서버 설정: 별도 설정 페이지 (Phase 2 기본 구현)
- 노드에 인스턴스 할당: 속성 패널 드롭다운
- 인스턴스별 색상 구분: 노드 테두리 색상

**시나리오 직렬화:**
- 저장소: SQLite (프로젝트→시나리오 계층)
- Phase 2 범위: 단일 프로젝트, 시나리오 CRUD
- 시나리오 목록: 좌측 트리 (animate-ui.com Files 트리)
- 검증: 실시간(순환 감지) + 저장 시(전체)
- 검증 규칙: 순환 감지, 고립 노드, 필수 속성, 인스턴스 할당
- 오류 표시: 노드 하이라이트 + 토스트

### Claude's Discretion

연구자가 옵션을 조사하고 권장 사항을 제공할 수 있는 자유 영역:
- shadcn/ui tree view 컴포넌트 선택 (공식 없음, 커뮤니티 대안 조사)
- Edge 애니메이션 스타일 (STATE.md에 stroke-dasharray 성능 문제 언급됨)
- 노드 속성 폼 레이아웃 패턴
- JSON 직렬화 포맷 세부사항
- SQLite 스키마 설계

### Deferred Ideas (OUT OF SCOPE)

Phase 2에서 절대 계획하지 말 것:
- 프로젝트 CRUD UI
- Hold/Retrieve/Transfer 등 고급 Command
- Ringing/Response 노드
- 파일 내보내기/가져오기

## Standard Stack

Core technologies for building the @xyflow/react scenario editor:

### Core

| Library | Version | Purpose | Why It's Standard |
|---------|---------|---------|-------------------|
| @xyflow/react | 12.x | Node-based editor framework | Official successor to reactflow, TypeScript-first, built-in Zustand, SSR-compatible |
| Zustand | 5.x | State management for nodes/edges | Used internally by React Flow, minimal boilerplate, hooks-based API |
| modernc.org/sqlite | latest (3.51.2) | SQLite driver (CGo-free) | Pure Go implementation, no C compiler needed, simplifies Wails cross-compilation |
| TypeScript | 5.x | Type safety | Required for @xyflow/react custom node types, prevents runtime errors |

**Installation:**
```bash
# Frontend dependencies (in frontend/)
cd frontend
npm install @xyflow/react zustand

# Go dependencies (in project root)
cd ..
go get modernc.org/sqlite
go mod tidy
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui tree view | community | File tree component | No official shadcn tree component; use MrLightful or neigebaie community implementations |
| @xyflow/react Background | (built-in) | Dot grid canvas background | Included in @xyflow/react, use BackgroundVariant.Dots |
| @xyflow/react Panel | (built-in) | Fixed overlay for properties panel | Included in @xyflow/react, for right sidebar |

**shadcn/ui Tree View Options:**
```bash
# Option 1: MrLightful's Tree View (simpler, fewer features)
npx shadcn add "https://mrlightful.com/registry/tree-view"

# Option 2: neigebaie's Tree View (feature-rich, checkboxes, search)
npx shadcn@latest add "https://github.com/neigebaie/shadcn-ui-tree-view/releases/download/v1.1.0/schema.json"
```

### Alternatives Considered

| Instead of | Alternative | Tradeoff |
|------------|-------------|----------|
| @xyflow/react | React DnD + custom canvas | @xyflow: battle-tested, handles pan/zoom/edge routing; Custom: requires implementing all features from scratch |
| modernc.org/sqlite | mattn/go-sqlite3 | modernc: CGo-free, easier cross-compile, ~2x slower INSERTs; mattn: 2x faster, requires CGo/C compiler |
| Zustand | Redux Toolkit | Zustand: minimal boilerplate, React Flow uses it internally; Redux: more verbose, larger bundle |
| JSON serialization | Protocol Buffers | JSON: human-readable, easy debugging, smaller payloads for simple graphs; Protobuf: binary, faster for large graphs |

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── features/
│   └── scenario-builder/
│       ├── components/
│       │   ├── Canvas.tsx              # ReactFlow wrapper
│       │   ├── NodePalette.tsx         # Drag source sidebar
│       │   ├── ScenarioTree.tsx        # File tree (shadcn tree view)
│       │   ├── PropertiesPanel.tsx     # Right sidebar
│       │   └── nodes/
│       │       ├── SipInstanceNode.tsx # Start point node
│       │       ├── CommandNode.tsx     # Blue command nodes
│       │       └── EventNode.tsx       # Yellow event nodes
│       ├── edges/
│       │   └── BranchEdge.tsx          # Success/failure styled edges
│       ├── hooks/
│       │   ├── useDnD.tsx              # Drag-and-drop context
│       │   └── useValidation.tsx       # Cycle detection
│       ├── store/
│       │   └── scenarioStore.ts        # Zustand store
│       └── types/
│           └── scenario.ts             # Node/Edge TypeScript types
└── lib/
    └── validation.ts                   # DAG algorithms

internal/
├── scenario/
│   ├── repository.go                   # SQLite CRUD operations
│   ├── serialization.go                # JSON ↔ DB
│   └── validation.go                   # Server-side validation (optional)
└── binding/
    └── scenario_binding.go             # Wails binding for scenario ops
```

### Pattern 1: DnD Context for Palette → Canvas

**Description:** React Flow doesn't include drag-and-drop from external sources. Use a context provider to manage drag state and drop actions.

**When to Use:** When implementing a node palette sidebar that drags nodes onto the canvas.

**Example:**
```typescript
// Source: https://reactflow.dev/examples/interaction/drag-and-drop

// hooks/useDnD.tsx
import { createContext, useContext, useState } from 'react';

const DnDContext = createContext({
  isDragging: false,
  dropAction: null as ((position: { x: number; y: number }) => void) | null,
  setIsDragging: (isDragging: boolean) => {},
  setDropAction: (action: ((position: { x: number; y: number }) => void) | null) => {},
});

export function DnDProvider({ children }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropAction, setDropAction] = useState(null);

  return (
    <DnDContext.Provider value={{ isDragging, dropAction, setIsDragging, setDropAction }}>
      {children}
    </DnDContext.Provider>
  );
}

export const useDnD = () => useContext(DnDContext);

// components/NodePalette.tsx
import { useDnD } from '../hooks/useDnD';

function NodePalette() {
  const { setIsDragging, setDropAction } = useDnD();

  const onDragStart = (nodeType: string) => {
    setIsDragging(true);
    setDropAction(() => (position: { x: number; y: number }) => {
      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: { label: nodeType },
      };
      // Add node to store
    });
  };

  return (
    <div>
      <div
        draggable
        onDragStart={() => onDragStart('command-makecall')}
        className="p-2 bg-blue-100 cursor-move"
      >
        MakeCall
      </div>
      {/* More palette items */}
    </div>
  );
}

// components/Canvas.tsx
import { useReactFlow } from '@xyflow/react';
import { useDnD } from '../hooks/useDnD';

function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { dropAction, setIsDragging } = useDnD();

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (dropAction) {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      dropAction(position);
    }
    setIsDragging(false);
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow {/* ... */} />
    </div>
  );
}
```

### Pattern 2: Custom Nodes with Multiple Handles

**Description:** Custom nodes are React components that receive `NodeProps<T>`. Use Handle components with unique IDs for success/failure branching.

**When to Use:** Every node type in the scenario editor (SIP Instance, Command, Event).

**Example:**
```typescript
// Source: https://reactflow.dev/learn/customization/custom-nodes
// Source: https://reactflow.dev/learn/customization/handles

import { Handle, Position, NodeProps } from '@xyflow/react';
import type { Node } from '@xyflow/react';

// Define custom node data type
type CommandNodeData = {
  label: string;
  command: 'MakeCall' | 'Answer' | 'Release';
  sipInstance?: string;
  targetNumber?: string;
};

// Define node type
type CommandNodeType = Node<CommandNodeData, 'command'>;

// Custom node component
function CommandNode({ id, data }: NodeProps<CommandNodeType>) {
  return (
    <div className="px-4 py-2 bg-blue-100 border-2 border-blue-500 rounded-md">
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        id={`${id}-input`}
      />

      <div className="font-bold">{data.command}</div>
      {data.targetNumber && (
        <div className="text-sm text-gray-600">{data.targetNumber}</div>
      )}

      {/* Output handles (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        style={{ left: '30%', background: 'green' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="failure"
        style={{ left: '70%', background: 'red' }}
      />
    </div>
  );
}

// Register node types
const nodeTypes = {
  command: CommandNode,
  event: EventNode,
  sipInstance: SipInstanceNode,
};

// Usage in ReactFlow
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
/>
```

### Pattern 3: Zustand Store for Flow State

**Description:** Centralize nodes, edges, and state handlers in a Zustand store to avoid prop-drilling through node data.

**When to Use:** When custom nodes need to update state or access other nodes' data.

**Example:**
```typescript
// Source: https://reactflow.dev/learn/advanced-use/state-management

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';

interface ScenarioStore {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Custom actions
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },
}));

// Usage in ReactFlow
import { useScenarioStore } from '../store/scenarioStore';

function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useScenarioStore();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
    />
  );
}

// Usage in custom node
function CommandNode({ id, data }: NodeProps<CommandNodeType>) {
  const updateNodeData = useScenarioStore((state) => state.updateNodeData);

  const handleTargetChange = (target: string) => {
    updateNodeData(id, { targetNumber: target });
  };

  return (
    <div>
      <input
        className="nodrag" // Prevent dragging when interacting with input
        value={data.targetNumber}
        onChange={(e) => handleTargetChange(e.target.value)}
      />
    </div>
  );
}
```

### Pattern 4: Cycle Detection with isValidConnection

**Description:** Use DFS with a visited set to detect cycles before allowing edge connections.

**When to Use:** Real-time validation during edge creation.

**Example:**
```typescript
// Source: https://reactflow.dev/examples/interaction/prevent-cycles

import { useCallback } from 'react';
import { useReactFlow, getOutgoers } from '@xyflow/react';

function Canvas() {
  const { getNodes, getEdges } = useReactFlow();

  const isValidConnection = useCallback((connection) => {
    const nodes = getNodes();
    const edges = getEdges();
    const target = nodes.find((node) => node.id === connection.target);

    // Prevent self-loops
    if (target.id === connection.source) {
      return false;
    }

    // Check for cycles using DFS
    const hasCycle = (node, visited = new Set()) => {
      if (visited.has(node.id)) {
        return false;
      }

      visited.add(node.id);

      for (const outgoer of getOutgoers(node, nodes, edges)) {
        if (outgoer.id === connection.source) {
          return true; // Cycle detected
        }
        if (hasCycle(outgoer, visited)) {
          return true;
        }
      }

      return false;
    };

    return !hasCycle(target);
  }, [getNodes, getEdges]);

  return (
    <ReactFlow
      isValidConnection={isValidConnection}
      {/* ... */}
    />
  );
}
```

### Pattern 5: Save and Restore with toObject()

**Description:** Serialize flow state to JSON using `toObject()` method from React Flow instance.

**When to Use:** Saving scenarios to SQLite or exporting to files.

**Example:**
```typescript
// Source: https://reactflow.dev/examples/interaction/save-and-restore

import { useReactFlow } from '@xyflow/react';
import { SaveScenario } from '../../wailsjs/go/binding/ScenarioBinding';

function Canvas() {
  const rfInstance = useReactFlow();

  const onSave = async () => {
    if (rfInstance) {
      const flow = rfInstance.toObject();

      // Add custom metadata for SIP scenario
      const scenario = {
        ...flow,
        metadata: {
          version: '1.0',
          createdAt: new Date().toISOString(),
          sipInstances: extractSipInstances(flow.nodes),
        },
      };

      // Save to SQLite via Wails binding
      await SaveScenario(JSON.stringify(scenario));
    }
  };

  return (
    <div>
      <button onClick={onSave}>Save Scenario</button>
      {/* ReactFlow component */}
    </div>
  );
}

// JSON structure example:
// {
//   "nodes": [
//     { "id": "1", "type": "command", "position": { "x": 100, "y": 100 }, "data": { "command": "MakeCall" } }
//   ],
//   "edges": [
//     { "id": "e1", "source": "1", "sourceHandle": "success", "target": "2" }
//   ],
//   "viewport": { "x": 0, "y": 0, "zoom": 1 },
//   "metadata": {
//     "version": "1.0",
//     "createdAt": "2026-02-09T...",
//     "sipInstances": [...]
//   }
// }
```

### Pattern 6: SQLite Scenario Repository in Go

**Description:** Use modernc.org/sqlite with standard database/sql package for scenario persistence.

**When to Use:** Storing and retrieving scenarios from local SQLite database.

**Example:**
```go
// Source: https://pkg.go.dev/modernc.org/sqlite

// internal/scenario/repository.go
package scenario

import (
	"database/sql"
	"encoding/json"
	"fmt"

	_ "modernc.org/sqlite"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(dbPath string) (*Repository, error) {
	// Use URI with foreign keys enabled
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// Create tables
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS scenarios (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return nil, err
	}

	return &Repository{db: db}, nil
}

func (r *Repository) Save(id, name string, flowData interface{}) error {
	jsonData, err := json.Marshal(flowData)
	if err != nil {
		return err
	}

	_, err = r.db.Exec(`
		INSERT INTO scenarios (id, name, data)
		VALUES (?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			data = excluded.data,
			updated_at = CURRENT_TIMESTAMP
	`, id, name, string(jsonData))

	return err
}

func (r *Repository) Load(id string) (map[string]interface{}, error) {
	var jsonData string
	err := r.db.QueryRow("SELECT data FROM scenarios WHERE id = ?", id).Scan(&jsonData)
	if err != nil {
		return nil, err
	}

	var flowData map[string]interface{}
	err = json.Unmarshal([]byte(jsonData), &flowData)
	return flowData, err
}

func (r *Repository) List() ([]map[string]interface{}, error) {
	rows, err := r.db.Query("SELECT id, name, created_at, updated_at FROM scenarios ORDER BY updated_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	scenarios := []map[string]interface{}{}
	for rows.Next() {
		var id, name, createdAt, updatedAt string
		if err := rows.Scan(&id, &name, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		scenarios = append(scenarios, map[string]interface{}{
			"id":        id,
			"name":      name,
			"createdAt": createdAt,
			"updatedAt": updatedAt,
		})
	}

	return scenarios, nil
}

func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM scenarios WHERE id = ?", id)
	return err
}
```

### Pattern 7: Dot Grid Background

**Description:** Use React Flow's built-in Background component with Dots variant.

**When to Use:** Adding visual grid to canvas for orientation.

**Example:**
```typescript
// Source: https://reactflow.dev/api-reference/components/background

import { Background, BackgroundVariant } from '@xyflow/react';

function Canvas() {
  return (
    <ReactFlow {/* ... */}>
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#d1d5db" // gray-300
      />
    </ReactFlow>
  );
}
```

### Anti-Patterns to Avoid

- **Don't use stroke-dasharray for edge animations**: STATE.md documents performance issues. Use CSS animations or SVG animateMotion instead.
- **Don't forget `nodrag` className on interactive elements**: Input fields, buttons inside custom nodes need `nodrag` to prevent unintended node dragging.
- **Don't mutate node/edge data directly**: Always create new objects when updating. React Flow relies on reference equality for change detection.
- **Don't skip unique IDs for handles**: Multiple handles on the same node require unique `id` props to differentiate connections.
- **Don't use mattn/go-sqlite3 in Wails without CGo setup**: Use modernc.org/sqlite to avoid cross-compilation headaches.
- **Don't store large binary data in SQLite TEXT columns**: JSON serialization is fine for flow graphs (~KB), but avoid embedding images or large files.

## Don't Hand-Roll

Simple-looking problems with existing solutions in the @xyflow/react ecosystem:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node-based editor canvas | Custom SVG + drag logic | `@xyflow/react` | Flow editors require pan/zoom, minimap, edge routing, selection, undo/redo. XYFlow handles all of this. |
| Drag-and-drop from palette | Custom drag events | React Flow DnD pattern + context | HTML Drag and Drop API has browser quirks. React Flow's pattern with `screenToFlowPosition` is battle-tested. |
| Cycle detection in graph | Custom graph traversal | React Flow `getOutgoers()` + DFS | Graph utilities provided by React Flow handle edge cases (disconnected components, self-loops). |
| State management for flows | Local component state | Zustand (React Flow uses it internally) | Flow state is global (nodes access other nodes). Prop-drilling through node data becomes unmaintainable. |
| File tree component | Custom recursive component | shadcn/ui tree view (community) | Tree views require expand/collapse state, keyboard nav, icons. Community components are production-ready. |
| JSON serialization in Go | Custom encoding | `encoding/json` stdlib | Standard library handles nested structures, escaping, validation. Don't reinvent unless profiling shows bottleneck. |
| SQLite schema migrations | Manual ALTER TABLE scripts | Embed migration SQL in binary with `//go:embed` | Schema versioning and rollback logic is error-prone. Embed migrations and apply sequentially. |

**Key Insight:** @xyflow/react provides helpers like `getOutgoers()`, `getIncomers()`, `getConnectedEdges()` for graph algorithms. Use these instead of reimplementing graph traversal—they handle React Flow's internal data structures correctly.

## Common Pitfalls

### Pitfall 1: Forgetting screenToFlowPosition in Drop Handler

**What Happens:** Dropped nodes appear at wrong positions or outside visible canvas area.

**Why It Happens:** `event.clientX/clientY` returns screen coordinates, not canvas coordinates. React Flow canvas can be panned/zoomed, so screen coordinates don't match node positions.

**How to Avoid:**
```typescript
const { screenToFlowPosition } = useReactFlow();

const onDrop = (event: React.DragEvent) => {
  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY
  });
  // Now position is in canvas coordinates
};
```

**Warning Signs:**
- Nodes appear far from cursor drop location
- Nodes disappear after dropping (placed outside viewport)
- Pan/zoom breaks node placement

### Pitfall 2: Missing `nodrag` on Interactive Elements

**What Happens:** Clicking input fields, buttons, or dropdowns inside custom nodes drags the node instead of interacting with the element.

**Why It Happens:** React Flow's node wrapper captures pointer events for dragging. Interactive elements need `nodrag` className to opt-out.

**How to Avoid:**
```typescript
function CommandNode({ data }) {
  return (
    <div>
      <input
        className="nodrag" // CRITICAL: prevents drag on input
        value={data.targetNumber}
        onChange={...}
      />
      <button className="nodrag" onClick={...}>
        Configure
      </button>
    </div>
  );
}
```

**Warning Signs:**
- Cannot type in input fields
- Buttons drag node instead of clicking
- Dropdowns immediately close when opening

### Pitfall 3: Mutating Node/Edge Data Instead of Creating New Objects

**What Happens:** Changes to node properties don't trigger re-renders or save operations.

**Why It Happens:** React Flow uses reference equality to detect changes. Mutating objects doesn't change their reference.

**How to Avoid:**
```typescript
// WRONG: Mutates existing node
const updateNode = (nodeId, newData) => {
  const node = nodes.find(n => n.id === nodeId);
  node.data = newData; // MUTATION - React Flow won't detect this
};

// CORRECT: Create new array with new node object
const updateNode = (nodeId, newData) => {
  set({
    nodes: nodes.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...newData } } // NEW object
        : node
    )
  });
};
```

**Warning Signs:**
- Property changes don't appear in UI
- Save operations persist stale data
- Undo/redo functionality breaks

### Pitfall 4: Not Using Unique Handle IDs for Multiple Handles

**What Happens:** Edges connect to wrong handles or connections fail silently.

**Why It Happens:** React Flow matches edges to handles by `id` prop. Without unique IDs, React Flow uses position-based matching which is unreliable.

**How to Avoid:**
```typescript
// WRONG: No IDs
<Handle type="source" position={Position.Bottom} />
<Handle type="source" position={Position.Bottom} />

// CORRECT: Unique IDs
<Handle type="source" position={Position.Bottom} id="success" />
<Handle type="source" position={Position.Bottom} id="failure" />

// Edge references handle by ID
const edge = {
  source: 'node1',
  sourceHandle: 'success', // Matches handle id prop
  target: 'node2',
};
```

**Warning Signs:**
- Edges connect to wrong handle visually
- `sourceHandle`/`targetHandle` values don't persist
- Validation logic can't distinguish between branch types

### Pitfall 5: SQLite CGo Dependency in Cross-Compilation

**What Happens:** `go build` fails on different platforms with "gcc not found" or linker errors.

**Why It Happens:** `mattn/go-sqlite3` requires CGo and C compiler. Cross-compiling (e.g., building Windows binary on macOS) needs platform-specific toolchains.

**How to Avoid:**
```bash
# Use modernc.org/sqlite (CGo-free)
go get modernc.org/sqlite
go mod tidy

# NOT: mattn/go-sqlite3 (requires CGo)
# go get github.com/mattn/go-sqlite3
```

**Warning Signs:**
- Build errors mentioning "gcc", "cgo", or "C compiler"
- Wails build succeeds locally but fails on CI
- Cross-platform builds require separate Docker images

**Tradeoff:** modernc.org/sqlite is ~2x slower on INSERTs, but fast enough for MVP (scenario save/load is infrequent).

### Pitfall 6: Storing Binary Data in JSON Fields

**What Happens:** Database bloat, slow queries, JSON parsing errors.

**Why It Happens:** Embedding base64-encoded images or large files in JSON inflates storage and exceeds SQLite's practical limits for TEXT columns.

**How to Avoid:**
```go
// WRONG: Embedding large data in JSON
type Scenario struct {
	FlowData string `json:"flowData"` // Contains base64 image
}

// CORRECT: Store file references, not contents
type Scenario struct {
	FlowData string `json:"flowData"` // Only flow structure
	Assets   []string `json:"assets"`  // File paths to separate asset table/disk
}
```

**Warning Signs:**
- Scenario files >1MB
- List queries become slow (SQLite scans entire TEXT column)
- JSON.parse() takes >100ms

### Pitfall 7: Not Validating Isolated Nodes

**What Happens:** Users save scenarios with unreachable nodes, causing runtime errors during execution.

**Why It Happens:** Cycle detection validates connectivity but doesn't check if all nodes are reachable from start nodes.

**How to Avoid:**
```typescript
// Validation: Check for isolated nodes
function validateIsolatedNodes(nodes, edges) {
  const startNodes = nodes.filter(n => n.type === 'sipInstance');
  const reachable = new Set();

  function dfs(nodeId) {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);

    edges
      .filter(e => e.source === nodeId)
      .forEach(e => dfs(e.target));
  }

  startNodes.forEach(n => dfs(n.id));

  const isolated = nodes.filter(n => !reachable.has(n.id));
  return isolated.length === 0 ? null : isolated;
}
```

**Warning Signs:**
- Scenario execution skips nodes
- Logs show "node not found" errors
- Visual graph looks connected but execution paths are broken

## Code Examples

Official patterns validated from @xyflow/react documentation and community best practices:

### Complete Three-Panel Layout

```typescript
// Source: Synthesized from React Flow patterns and shadcn/ui layouts

import { ReactFlowProvider } from '@xyflow/react';
import { DnDProvider } from './hooks/useDnD';
import ScenarioTree from './components/ScenarioTree';
import NodePalette from './components/NodePalette';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';

function ScenarioBuilder() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <div className="flex h-screen">
          {/* Left Sidebar: Tree + Palette */}
          <div className="w-[200px] border-r flex flex-col">
            <div className="flex-1 overflow-auto p-2">
              <h3 className="font-bold mb-2">Scenarios</h3>
              <ScenarioTree />
            </div>
            <div className="border-t p-2">
              <h3 className="font-bold mb-2">Nodes</h3>
              <NodePalette />
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1">
            <Canvas />
          </div>

          {/* Right Sidebar: Properties */}
          <div className="w-[280px] border-l overflow-auto">
            <PropertiesPanel />
          </div>
        </div>
      </DnDProvider>
    </ReactFlowProvider>
  );
}
```

### Node Type Definitions (TypeScript)

```typescript
// Source: https://reactflow.dev/api-reference/types/node
// types/scenario.ts

import type { Node } from '@xyflow/react';

// SIP Instance Node (Start Point)
export type SipInstanceNodeData = {
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string; // Instance color for visual grouping
};

export type SipInstanceNode = Node<SipInstanceNodeData, 'sipInstance'>;

// Command Node
export type CommandNodeData = {
  label: string;
  command: 'MakeCall' | 'Answer' | 'Release';
  sipInstance?: string; // Assigned instance ID
  targetNumber?: string; // For MakeCall
  timeout?: number; // In milliseconds
};

export type CommandNode = Node<CommandNodeData, 'command'>;

// Event Node
export type EventNodeData = {
  label: string;
  event: 'INCOMING' | 'DISCONNECTED' | 'RINGING' | 'TIMEOUT' | 'HELD' | 'RETRIEVED' | 'TRANSFERRED' | 'NOTIFY';
  sipInstance?: string;
  timeout?: number; // For TIMEOUT event
};

export type EventNode = Node<EventNodeData, 'event'>;

// Union type for all scenario nodes
export type ScenarioNode = SipInstanceNode | CommandNode | EventNode;
```

### Custom Edge with Success/Failure Styling

```typescript
// Source: https://reactflow.dev/learn/customization/custom-edges
// edges/BranchEdge.tsx

import { BaseEdge, getSmoothStepPath, EdgeProps } from '@xyflow/react';

type BranchEdgeData = {
  branchType?: 'success' | 'failure';
};

export function BranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<BranchEdgeData>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = data?.branchType === 'success'
    ? '#22c55e' // green-500
    : data?.branchType === 'failure'
    ? '#ef4444' // red-500
    : '#94a3b8'; // gray-400 (default)

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: strokeColor, strokeWidth: 2 }}
    />
  );
}

// Usage: Determine branch type from sourceHandle
const edges = [
  {
    id: 'e1',
    source: 'node1',
    sourceHandle: 'success',
    target: 'node2',
    type: 'branch',
    data: { branchType: 'success' },
  },
  {
    id: 'e2',
    source: 'node1',
    sourceHandle: 'failure',
    target: 'node3',
    type: 'branch',
    data: { branchType: 'failure' },
  },
];
```

### Complete Validation Suite

```typescript
// lib/validation.ts

import { Node, Edge, getOutgoers, getIncomers } from '@xyflow/react';
import { ScenarioNode } from '../types/scenario';

export interface ValidationError {
  type: 'cycle' | 'isolated' | 'missing-instance' | 'missing-required-field';
  nodeId?: string;
  message: string;
}

export function validateScenario(nodes: ScenarioNode[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Cycle detection
  const cycleErrors = detectCycles(nodes, edges);
  errors.push(...cycleErrors);

  // 2. Isolated nodes detection
  const isolatedErrors = detectIsolatedNodes(nodes, edges);
  errors.push(...isolatedErrors);

  // 3. Instance assignment validation
  const instanceErrors = validateInstanceAssignments(nodes);
  errors.push(...instanceErrors);

  // 4. Required fields validation
  const fieldErrors = validateRequiredFields(nodes);
  errors.push(...fieldErrors);

  return errors;
}

function detectCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      return true; // Cycle found
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      for (const outgoer of getOutgoers(node, nodes, edges)) {
        if (dfs(outgoer.id)) {
          errors.push({
            type: 'cycle',
            nodeId: outgoer.id,
            message: `Cycle detected involving node ${outgoer.id}`,
          });
          return true;
        }
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  return errors;
}

function detectIsolatedNodes(nodes: ScenarioNode[], edges: Edge[]): ValidationError[] {
  const startNodes = nodes.filter(n => n.type === 'sipInstance');
  const reachable = new Set<string>();

  function dfs(nodeId: string) {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      for (const outgoer of getOutgoers(node, nodes, edges)) {
        dfs(outgoer.id);
      }
    }
  }

  startNodes.forEach(n => dfs(n.id));

  const isolated = nodes.filter(n => !reachable.has(n.id));
  return isolated.map(node => ({
    type: 'isolated',
    nodeId: node.id,
    message: `Node ${node.id} is not reachable from any start node`,
  }));
}

function validateInstanceAssignments(nodes: ScenarioNode[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    if (node.type !== 'sipInstance' && !node.data.sipInstance) {
      errors.push({
        type: 'missing-instance',
        nodeId: node.id,
        message: `Node ${node.id} must be assigned to a SIP instance`,
      });
    }
  });

  return errors;
}

function validateRequiredFields(nodes: ScenarioNode[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    if (node.type === 'command' && node.data.command === 'MakeCall') {
      if (!node.data.targetNumber) {
        errors.push({
          type: 'missing-required-field',
          nodeId: node.id,
          message: `MakeCall node ${node.id} requires targetNumber`,
        });
      }
    }
  });

  return errors;
}
```

### Wails Scenario Binding

```go
// internal/binding/scenario_binding.go

package binding

import (
	"context"
	"encoding/json"
	"sipflow/internal/scenario"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ScenarioBinding struct {
	ctx  context.Context
	repo *scenario.Repository
}

func NewScenarioBinding(dbPath string) (*ScenarioBinding, error) {
	repo, err := scenario.NewRepository(dbPath)
	if err != nil {
		return nil, err
	}
	return &ScenarioBinding{repo: repo}, nil
}

func (s *ScenarioBinding) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// SaveScenario saves a scenario to SQLite
func (s *ScenarioBinding) SaveScenario(id, name, flowDataJSON string) error {
	var flowData map[string]interface{}
	if err := json.Unmarshal([]byte(flowDataJSON), &flowData); err != nil {
		runtime.LogError(s.ctx, "Failed to parse flow data: "+err.Error())
		return err
	}

	if err := s.repo.Save(id, name, flowData); err != nil {
		runtime.LogError(s.ctx, "Failed to save scenario: "+err.Error())
		return err
	}

	runtime.LogInfo(s.ctx, "Scenario saved: "+name)
	return nil
}

// LoadScenario loads a scenario from SQLite
func (s *ScenarioBinding) LoadScenario(id string) (string, error) {
	flowData, err := s.repo.Load(id)
	if err != nil {
		runtime.LogError(s.ctx, "Failed to load scenario: "+err.Error())
		return "", err
	}

	jsonData, err := json.Marshal(flowData)
	if err != nil {
		return "", err
	}

	return string(jsonData), nil
}

// ListScenarios returns all scenarios
func (s *ScenarioBinding) ListScenarios() (string, error) {
	scenarios, err := s.repo.List()
	if err != nil {
		runtime.LogError(s.ctx, "Failed to list scenarios: "+err.Error())
		return "", err
	}

	jsonData, err := json.Marshal(scenarios)
	if err != nil {
		return "", err
	}

	return string(jsonData), nil
}

// DeleteScenario deletes a scenario
func (s *ScenarioBinding) DeleteScenario(id string) error {
	if err := s.repo.Delete(id); err != nil {
		runtime.LogError(s.ctx, "Failed to delete scenario: "+err.Error())
		return err
	}

	runtime.LogInfo(s.ctx, "Scenario deleted: "+id)
	return nil
}
```

## State of the Art

Evolution of node-based editors and related technologies:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reactflow (npm package) | @xyflow/react | 2024 (v12) | Package renamed, improved TypeScript support, SSR/SSG compatibility, node.measured for dimensions |
| useNodesState/useEdgesState | Zustand store pattern | 2023-2024 | Recommended for complex apps where nodes need global state access |
| stroke-dasharray for edge animations | CSS animations / SVG animateMotion | Ongoing | Performance issues noted in STATE.md, animateMotion preferred for smooth motion |
| mattn/go-sqlite3 (CGo) | modernc.org/sqlite (pure Go) | 2021+ | CGo-free simplifies cross-compilation, ~2x slower but acceptable for desktop apps |
| tailwind.config.js | Tailwind v4 CSS config | 2024-12 | Already in use (Phase 1), no change needed |

**Deprecated/Obsolete:**
- **reactflow package name**: Use `@xyflow/react` instead (v12+)
- **node.width/node.height direct access**: Use `node.measured.width/height` in v12
- **Custom cycle detection without getOutgoers**: React Flow v12 provides graph utilities
- **LocalStorage-only persistence**: Desktop apps should use SQLite for structured queries

## Open Questions

Issues that could not be fully resolved during research:

1. **shadcn/ui tree view component choice**
   - Known: Two community implementations exist (MrLightful, neigebaie)
   - Unclear: Which is more stable for file tree use case? No official recommendation found.
   - Recommendation: Start with MrLightful's simpler implementation (fewer dependencies). Migrate to neigebaie if search/checkbox features become requirements.

2. **modernc.org/sqlite performance on large scenarios**
   - Known: ~2x slower INSERTs than mattn/go-sqlite3, acceptable for infrequent saves
   - Unclear: How does performance scale with 100+ node scenarios? No benchmarks found for this specific use case.
   - Recommendation: Use modernc.org/sqlite for MVP. If profiling shows >500ms save times, consider mattn/go-sqlite3 + CGo setup or batch write optimizations.

3. **React Flow node rendering performance with 50+ custom nodes**
   - Known: React Flow handles virtualization internally
   - Unclear: Do complex custom nodes (forms, dropdowns) impact performance? Documentation doesn't specify limits.
   - Recommendation: Implement simple node rendering in Phase 2. If performance degrades, use React.memo() on custom node components and Profile tab in React DevTools.

4. **Edge label positioning for multi-handle nodes**
   - Known: Edges can have labels via `label` prop
   - Unclear: How to position labels clearly when multiple edges originate from same node?
   - Recommendation: Defer edge labels to Phase 3 (Execution Visualization). Phase 2 uses color coding (green/red) for success/failure branches instead of text labels.

5. **SQLite database file location in Wails desktop app**
   - Known: Wails provides runtime.LogInfo for logging, but no specific API for app data directory
   - Unclear: Should database be in user home directory, app directory, or working directory?
   - Recommendation: Use `os.UserConfigDir()` + "/sipflow/scenarios.db" for cross-platform compatibility. Document location in UI for user transparency.

## Sources

### Primary (HIGH Confidence)

**@xyflow/react Documentation:**
- [Custom Nodes - React Flow](https://reactflow.dev/learn/customization/custom-nodes) - Custom node implementation pattern
- [Handles - React Flow](https://reactflow.dev/learn/customization/handles) - Multiple handle configuration
- [Drag and Drop - React Flow](https://reactflow.dev/examples/interaction/drag-and-drop) - DnD context pattern
- [State Management - React Flow](https://reactflow.dev/learn/advanced-use/state-management) - Zustand integration
- [Prevent Cycles - React Flow](https://reactflow.dev/examples/interaction/prevent-cycles) - Cycle detection algorithm
- [Save and Restore - React Flow](https://reactflow.dev/examples/interaction/save-and-restore) - toObject() serialization
- [Custom Edges - React Flow](https://reactflow.dev/learn/customization/custom-edges) - Edge styling pattern
- [Background Component - React Flow](https://reactflow.dev/api-reference/components/background) - Dot grid background
- [Node Type - React Flow](https://reactflow.dev/api-reference/types/node) - TypeScript type definitions
- [Usage with TypeScript - React Flow](https://reactflow.dev/learn/advanced-use/typescript) - TypeScript patterns

**modernc.org/sqlite:**
- [sqlite package - Go Packages](https://pkg.go.dev/modernc.org/sqlite) - Official API documentation

**Phase 1 Research:**
- `.planning/phases/01-project-scaffolding/01-RESEARCH.md` - Wails v2, Go patterns, Tailwind v4 setup

### Secondary (MEDIUM Confidence)

**Community Implementations:**
- [Shadcn Tree View - MrLightful](https://mrlightful.com/ui/tree-view) - Community tree view component
- [shadcn-ui-tree-view - neigebaie](https://github.com/neigebaie/shadcn-ui-tree-view) - Feature-rich tree view with search
- [React Flow state management - Synergy Codes](https://www.synergycodes.com/webbook/webbook-react-flow-state-management) - Zustand integration patterns

**Go SQLite Resources:**
- [SQLite in Go, with and without cgo - DataStation](https://datastation.multiprocess.io/blog/2022-05-12-sqlite-in-go-with-and-without-cgo.html) - Performance comparison
- [How to Use SQLite with Go - OneUptime (2026)](https://oneuptime.com/blog/post/2026-02-02-sqlite-go/view) - Recent best practices
- [Benchmarking mattn/go-sqlite3 vs modernc.org/sqlite - GitHub](https://github.com/multiprocessio/sqlite-cgo-no-cgo) - Performance benchmarks

**DAG Validation:**
- [Detect Cycle in a Directed Graph - GeeksforGeeks](https://www.geeksforgeeks.org/dsa/detect-cycle-in-a-graph/) - DFS cycle detection algorithm
- [Detecting Cycles in a Directed Graph - Baeldung](https://www.baeldung.com/cs/detecting-cycles-in-directed-graph) - Algorithm explanations

### Tertiary (LOW Confidence - Context Filling)

**General React Flow Content:**
- [React Flow Examples - Medium](https://medium.com/react-digital-garden/react-flow-examples-2cbb0bab4404) - Community examples
- [Building a Workflow Editor with React Flow - Pinpoint Engineering](https://medium.com/pinpoint-engineering/part-2-building-a-workflow-editor-with-react-flow-a-guide-to-auto-layout-and-complex-node-1aadae67a3a5) - Workflow patterns

**Wails + SQLite:**
- [Building Desktop Apps with Wails - DEV Community](https://dev.to/kaizerpwn/building-desktop-apps-with-wails-a-go-developers-perspective-526p) - General Wails patterns
- [todo_wails_go - GitHub](https://github.com/Gontafi/todo_wails_go) - Example Wails + SQLite app

## Metadata

**Confidence Breakdown:**
- Standard Stack: HIGH - All libraries verified from official docs (@xyflow/react, Zustand, modernc.org/sqlite)
- Architecture Patterns: HIGH - Patterns from official React Flow examples and Go best practices
- Pitfalls: HIGH - Common issues documented in React Flow troubleshooting and community forums
- Code Examples: HIGH - Derived from official React Flow v12 documentation and pkg.go.dev

**Research Date:** 2026-02-09
**Validity Period:** 30 days (@xyflow/react is stable; re-verify if major version releases)
