# XYFlow (React Flow) Research for SipFlow Scenario Builder

**Date:** 2026-02-09
**Library:** @xyflow/react (React Flow 12)
**Latest Version:** 12.10.0
**License:** MIT (free for open-source, paid "React Flow Pro" subscription for some premium features)
**Repository:** https://github.com/xyflow/xyflow

---

## 1. Installation & Setup (React + TypeScript)

### Package Installation

```bash
npm install @xyflow/react
# or
pnpm add @xyflow/react
# or
yarn add @xyflow/react
```

> **Note:** The package was renamed from `reactflow` to `@xyflow/react` in v12.
> The internal framework-agnostic core lives in `@xyflow/system`.

### Critical CSS Import

```typescript
import '@xyflow/react/dist/style.css';
```

This import is **mandatory** -- without it, the flow will not render correctly.

### Container Requirement

The `<ReactFlow />` component **must** have a parent element with explicit `width` and `height`:

```tsx
<div style={{ width: '100vw', height: '100vh' }}>
  <ReactFlow nodes={nodes} edges={edges} />
</div>
```

### Vite + TypeScript Template

```bash
# Official starter template
npx degit xyflow/vite-react-flow-template my-flow-app
```

### Minimum Viable Setup

```tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: '2', position: { x: 200, y: 100 }, data: { label: 'Node 2' } },
];

const edges = [
  { id: 'e1-2', source: '1', target: '2' },
];

export default function Flow() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

---

## 2. Core Concepts

### Nodes

A node is an object with required properties:

```typescript
{
  id: string;          // Unique identifier
  position: { x: number; y: number }; // Position on canvas
  data: Record<string, unknown>;      // Arbitrary payload (passed to component)
  type?: string;       // References key in nodeTypes map (default: 'default')
}
```

React Flow provides three built-in node types:
- `'default'` -- has one source + one target handle
- `'input'` -- has only a source handle (flow origin)
- `'output'` -- has only a target handle (flow terminus)

### Edges

An edge connects two nodes:

```typescript
{
  id: string;
  source: string;      // Source node ID
  target: string;      // Target node ID
  sourceHandle?: string | null;  // Specific handle on source node
  targetHandle?: string | null;  // Specific handle on target node
  type?: string;       // Edge rendering type
  animated?: boolean;  // Enable animated dashed line
  label?: ReactNode;   // Label text/component on the edge
  data?: Record<string, unknown>; // Custom payload
  style?: CSSProperties;
  markerStart?: EdgeMarkerType;
  markerEnd?: EdgeMarkerType;
  deletable?: boolean;
  selectable?: boolean;
  reconnectable?: boolean | HandleType;
  zIndex?: number;
  interactionWidth?: number;
}
```

Five built-in edge types:
- `'default'` (bezier curves)
- `'straight'` (direct lines)
- `'step'` (right-angle paths)
- `'smoothstep'` (rounded right-angle paths)
- `'simplebezier'` (simplified bezier)

### Handles

Handles are connection points on nodes, implemented via the `<Handle />` component:

```tsx
import { Handle, Position } from '@xyflow/react';

// Inside a custom node:
<Handle type="source" position={Position.Bottom} />
<Handle type="target" position={Position.Top} />
```

Key points:
- **type:** `'source'` (outgoing) or `'target'` (incoming)
- **position:** `Position.Top | Bottom | Left | Right`
- **Multiple handles** require unique `id` props
- CSS classes `connecting` and `valid` are applied during connection interactions
- To hide handles visually, use `visibility: hidden` (NOT `display: none`)
- Dynamic handle count requires `useUpdateNodeInternals` hook

### Built-in Plugins

- **`<Background />`** -- dot grid, lines, or cross pattern
- **`<MiniMap />`** -- miniature overview of the entire canvas
- **`<Controls />`** -- zoom in/out/fit buttons
- **`<Panel />`** -- position arbitrary UI over the canvas

### Utility Functions

- `applyNodeChanges(changes, nodes)` -- apply node mutations
- `applyEdgeChanges(changes, edges)` -- apply edge mutations
- `addEdge(connection, edges)` -- add a new edge to the array

---

## 3. Custom Node Components (TypeScript)

### Defining a Custom Node Type

```typescript
import { type Node, type NodeProps, Handle, Position } from '@xyflow/react';

// 1. Define the node's data type (MUST use `type`, not `interface`)
type CommandNodeData = {
  label: string;
  command: string;
  description?: string;
};

type CommandNode = Node<CommandNodeData, 'command'>;

// 2. Create the React component
function CommandNodeComponent({ data, selected }: NodeProps<CommandNode>) {
  return (
    <div className={`command-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-header">{data.label}</div>
      <div className="node-body">
        <code>{data.command}</code>
        {data.description && <p>{data.description}</p>}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default CommandNodeComponent;
```

### NodeProps Available Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique node identifier |
| `data` | `T` | Custom data payload |
| `type` | `string` | Node type key |
| `selected` | `boolean` | Whether node is selected |
| `dragging` | `boolean` | Whether node is being dragged |
| `isConnectable` | `boolean` | Whether node accepts connections |
| `positionAbsoluteX` | `number` | Absolute X position |
| `positionAbsoluteY` | `number` | Absolute Y position |
| `width` | `number` | Measured width |
| `height` | `number` | Measured height |
| `zIndex` | `number` | Stacking order |
| `parentId` | `string` | Parent node (sub-flows) |
| `draggable` | `boolean` | Whether node can be dragged |
| `deletable` | `boolean` | Whether node can be deleted |
| `selectable` | `boolean` | Whether node can be selected |
| `sourcePosition` | `Position` | Default source handle position |
| `targetPosition` | `Position` | Default target handle position |

### Registering Custom Node Types

```typescript
import { type BuiltInNode } from '@xyflow/react';

// Union of all custom node types
type AppNode = BuiltInNode | CommandNode | EventNode | ConditionNode;

// Node types map -- define OUTSIDE the component to prevent re-renders
const nodeTypes = {
  command: CommandNodeComponent,
  event: EventNodeComponent,
  condition: ConditionNodeComponent,
};

// Usage
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  // ...
/>
```

### Multiple Handles Example (Condition/Branch Node)

```tsx
type ConditionNode = Node<{ label: string; condition: string }, 'condition'>;

function ConditionNodeComponent({ data }: NodeProps<ConditionNode>) {
  return (
    <div className="condition-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="label">{data.label}</div>
        <code>{data.condition}</code>
      </div>
      {/* Multiple output handles for branching */}
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '75%' }} />
    </div>
  );
}
```

### Type-Safe Hook Usage

```typescript
const { getNodes, getEdges } = useReactFlow<AppNode, AppEdge>();

// Type narrowing with guard functions
function isCommandNode(node: AppNode): node is CommandNode {
  return node.type === 'command';
}

const commandNodes = nodes.filter(isCommandNode);
// TypeScript now knows commandNodes[0].data has { label, command, description? }
```

### Important Rules

- Use `type` keyword (not `interface`) for node data definitions
- Define `nodeTypes` outside the component or wrap in `useMemo`
- Add `className="nodrag"` to interactive elements (inputs, selects) inside nodes
- Add `className="nowheel"` to scrollable elements inside nodes
- Use `React.memo()` on custom node components for performance

---

## 4. Drag-and-Drop from Sidebar/Palette

React Flow does NOT include built-in drag-and-drop from external elements. It must be
implemented using the native HTML Drag and Drop API, Pointer Events, or a library.

### Recommended Pattern (Pointer Events -- cross-device compatible)

```tsx
// --- DnDContext.tsx ---
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type XYPosition } from '@xyflow/react';

type OnDropAction = (args: { position: XYPosition }) => void;

type DnDContextType = {
  isDragging: boolean;
  dropAction: OnDropAction | null;
  setDropAction: (action: OnDropAction | null) => void;
  setIsDragging: (dragging: boolean) => void;
};

const DnDContext = createContext<DnDContextType | null>(null);

export function DnDProvider({ children }: { children: ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropAction, setDropAction] = useState<OnDropAction | null>(null);
  return (
    <DnDContext.Provider value={{ isDragging, dropAction, setDropAction, setIsDragging }}>
      {children}
    </DnDContext.Provider>
  );
}

export function useDnD() {
  const ctx = useContext(DnDContext);
  if (!ctx) throw new Error('useDnD must be used within DnDProvider');
  return ctx;
}
```

```tsx
// --- Sidebar.tsx ---
import { useDnD } from './DnDContext';

const nodeTemplates = [
  { type: 'command', label: 'SIP Command', icon: '>' },
  { type: 'event',   label: 'SIP Event',   icon: '#' },
  { type: 'condition', label: 'Condition', icon: '?' },
];

export function Sidebar() {
  const { setDropAction, setIsDragging } = useDnD();

  const onDragStart = (nodeType: string) => {
    setIsDragging(true);
    setDropAction(({ position }) => {
      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: { label: `New ${nodeType}` },
      };
      // Add node via store action (see Zustand section)
      addNode(newNode);
    });
  };

  return (
    <aside className="sidebar">
      {nodeTemplates.map((t) => (
        <div
          key={t.type}
          className="dnd-node"
          onPointerDown={() => onDragStart(t.type)}
        >
          {t.icon} {t.label}
        </div>
      ))}
    </aside>
  );
}
```

```tsx
// --- FlowCanvas.tsx (drop handler) ---
import { useReactFlow } from '@xyflow/react';
import { useDnD } from './DnDContext';

export function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const { isDragging, dropAction, setIsDragging } = useDnD();

  const onDragEnd = useCallback(
    (event: PointerEvent) => {
      if (!dropAction) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target?.closest('.react-flow')) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        dropAction({ position });
      }
      setIsDragging(false);
    },
    [dropAction, screenToFlowPosition, setIsDragging],
  );

  // ... attach onDragEnd to pointer events
}
```

### Key API: `screenToFlowPosition`

Converts screen pixel coordinates to the flow's internal coordinate system,
accounting for zoom/pan. This is the correct way to position dropped nodes.

### Ghost/Preview Node

During drag, render a semi-transparent preview node that follows the cursor
using `pointermove` events and absolute positioning.

---

## 5. Edge Types & Custom Animated Edges

### Built-in Edge Types

| Type | Rendering | Use Case |
|------|-----------|----------|
| `'default'` | Bezier curve | General connections |
| `'straight'` | Direct line | Simple relationships |
| `'step'` | Right-angle segments | Flowcharts |
| `'smoothstep'` | Rounded step | Polished flowcharts |
| `'simplebezier'` | Simplified bezier | Lighter curves |

### Simple Animation (built-in)

```typescript
const edges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,  // Dashed line animation
  },
];
```

> **Warning:** The built-in `animated: true` uses `stroke-dasharray` CSS which has
> significant performance issues at scale (100+ edges). See performance section.

### Custom Animated Edge (SVG animateMotion -- RECOMMENDED)

```tsx
import {
  type EdgeProps,
  BaseEdge,
  getBezierPath,
  type Edge,
} from '@xyflow/react';

type MessageFlowEdge = Edge<{ label?: string; speed?: number }, 'messageFlow'>;

function MessageFlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps<MessageFlowEdge>) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const duration = data?.speed ?? 2; // seconds

  return (
    <>
      {/* Base edge path */}
      <BaseEdge id={id} path={edgePath} style={style} />

      {/* Animated particle along the edge */}
      <circle r="4" fill="#3b82f6">
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
    </>
  );
}

// Register custom edge types (define outside component)
const edgeTypes = {
  messageFlow: MessageFlowEdgeComponent,
};

// Usage
<ReactFlow edgeTypes={edgeTypes} ... />
```

### Edge Labels (Interactive)

For controls or information along edges, use `<EdgeLabelRenderer />`:

```tsx
import { EdgeLabelRenderer } from '@xyflow/react';

// Inside a custom edge component:
<EdgeLabelRenderer>
  <div
    style={{
      position: 'absolute',
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: 'all',
    }}
  >
    <button onClick={() => deleteEdge(id)}>x</button>
  </div>
</EdgeLabelRenderer>
```

### Edge Path Utilities

- `getBezierPath()` -- bezier curve path
- `getSmoothStepPath()` -- rounded step path
- `getStraightPath()` -- straight line path

All return `[path, labelX, labelY, offsetX, offsetY]`.

---

## 6. Node Execution / State Management Patterns

### Pattern A: Zustand Store (RECOMMENDED by React Flow docs)

React Flow uses Zustand internally. The docs explicitly recommend it for complex apps.

```typescript
// --- store.ts ---
import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';

// Node execution status
type NodeExecutionStatus = 'idle' | 'running' | 'success' | 'error';

type FlowState = {
  // React Flow core state
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Application state
  nodeExecutionStatus: Record<string, NodeExecutionStatus>;
  selectedNodeId: string | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  setNodeExecutionStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  setSelectedNodeId: (nodeId: string | null) => void;

  // Serialization
  toJSON: () => { nodes: Node[]; edges: Edge[] };
  fromJSON: (json: { nodes: Node[]; edges: Edge[] }) => void;
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeExecutionStatus: {},
  selectedNodeId: null,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  removeNode: (nodeId) => set({
    nodes: get().nodes.filter((n) => n.id !== nodeId),
    edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  }),

  updateNodeData: (nodeId, data) => set({
    nodes: get().nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } }
        : node,
    ),
  }),

  setNodeExecutionStatus: (nodeId, status) => set({
    nodeExecutionStatus: { ...get().nodeExecutionStatus, [nodeId]: status },
  }),

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

  toJSON: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },

  fromJSON: ({ nodes, edges }) => set({ nodes, edges }),
}));
```

### Pattern B: Execution Engine (Topological Traversal)

For a scenario builder that "runs" flows:

```typescript
// --- execution.ts ---
function getTopologicalOrder(nodes: Node[], edges: Edge[]): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach((e) => {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  });

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  return order;
}

async function executeFlow(
  nodes: Node[],
  edges: Edge[],
  handlers: Record<string, (node: Node) => Promise<void>>,
  onStatusChange: (nodeId: string, status: NodeExecutionStatus) => void,
) {
  const order = getTopologicalOrder(nodes, edges);

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    onStatusChange(nodeId, 'running');
    try {
      const handler = handlers[node.type ?? 'default'];
      if (handler) await handler(node);
      onStatusChange(nodeId, 'success');
    } catch {
      onStatusChange(nodeId, 'error');
      break; // Stop execution on error
    }
  }
}
```

### Accessing Store from Custom Nodes

```tsx
function CommandNodeComponent({ id, data }: NodeProps<CommandNode>) {
  // Access store directly -- no prop drilling needed
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const status = useFlowStore((s) => s.nodeExecutionStatus[id] ?? 'idle');

  return (
    <div className={`command-node status-${status}`}>
      <Handle type="target" position={Position.Top} />
      <input
        className="nodrag"
        value={data.command}
        onChange={(e) => updateNodeData(id, { command: e.target.value })}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

---

## 7. Serialization -- Save/Load Flow Configurations

### Using `toObject()`

```typescript
import { useReactFlow } from '@xyflow/react';

function SaveRestoreControls() {
  const rfInstance = useReactFlow();

  const onSave = () => {
    const flow = rfInstance.toObject();
    // flow = { nodes: [...], edges: [...], viewport: { x, y, zoom } }
    const json = JSON.stringify(flow);
    localStorage.setItem('sipflow-scenario', json);
    // Or POST to API:
    // await fetch('/api/scenarios', { method: 'POST', body: json });
  };

  const onRestore = () => {
    const raw = localStorage.getItem('sipflow-scenario');
    if (!raw) return;
    const flow = JSON.parse(raw);
    const { x = 0, y = 0, zoom = 1 } = flow.viewport ?? {};
    rfInstance.setNodes(flow.nodes ?? []);
    rfInstance.setEdges(flow.edges ?? []);
    rfInstance.setViewport({ x, y, zoom });
  };

  return (
    <Panel position="top-right">
      <button onClick={onSave}>Save</button>
      <button onClick={onRestore}>Restore</button>
    </Panel>
  );
}
```

### ReactFlowJsonObject Structure

```typescript
type ReactFlowJsonObject = {
  nodes: Node[];
  edges: Edge[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
};
```

### Extended Serialization (with metadata)

For a scenario builder, wrap the flow data with additional metadata:

```typescript
type ScenarioConfig = {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  flow: ReactFlowJsonObject;
  // Application-specific metadata
  variables: Record<string, unknown>;
  settings: {
    maxRetries: number;
    timeout: number;
  };
};
```

### Important Caveats

- **Custom data must be JSON-serializable** -- no functions, class instances, or circular refs in `node.data`
- **Node measured dimensions** (v12): after measuring, React Flow writes to `node.measured.width/height` -- these serialize automatically
- **Viewport is separate** from nodes/edges and must be saved/restored independently
- **Functions are NOT serialized** -- store configuration data, not runtime behavior

---

## 8. Performance with Many Nodes (50-100+)

### What Triggers Re-renders

Every node component re-renders when:
- The `nodes` array reference changes (drag, pan, zoom)
- A node's `selected` or `dragging` state changes
- Parent component re-renders (if node component is not memoized)

### Optimization Techniques

#### 1. Memoize Custom Node/Edge Components

```tsx
const CommandNode = memo(function CommandNode({ data }: NodeProps<CommandNode>) {
  return (/* ... */);
});
```

#### 2. Memoize Functions and Objects

```tsx
const nodeTypes = useMemo(() => ({ command: CommandNode }), []);
const defaultEdgeOptions = useMemo(() => ({ animated: true }), []);
const onNodeClick = useCallback((_, node) => { /* ... */ }, []);
```

#### 3. Avoid Subscribing to Full Node/Edge Arrays

```tsx
// BAD -- re-renders on every node position change
const nodes = useFlowStore((s) => s.nodes);
const selected = nodes.filter((n) => n.selected);

// GOOD -- store selected IDs separately
const selectedIds = useFlowStore((s) => s.selectedNodeIds);
```

#### 4. Use `useShallow` for Array/Object Selectors

```tsx
import { useShallow } from 'zustand/react/shallow';

const { nodes, edges } = useFlowStore(
  useShallow((s) => ({ nodes: s.nodes, edges: s.edges }))
);
```

#### 5. Collapse/Expand for Large Graphs

Toggle `hidden: true` on nodes to show subsets:

```typescript
updateNodeVisibility: (parentId: string, visible: boolean) => {
  set({
    nodes: get().nodes.map((n) =>
      n.parentId === parentId ? { ...n, hidden: !visible } : n
    ),
  });
}
```

#### 6. Simplify Edge Animations at Scale

- **Do NOT use** `animated: true` (stroke-dasharray) with 100+ edges
- **Use** SVG `<animateMotion>` for animated particles (much better performance)
- Consider disabling animations entirely when node count exceeds a threshold

#### 7. Simplify Visual Styles

Reduce CSS shadows, gradients, and border effects when rendering many nodes.

### Performance Benchmarks (from community reports)

- **50 nodes / 50 edges:** No optimization needed, smooth interaction
- **100 nodes / 150 edges:** Memoization recommended, avoid animated: true on all edges
- **200+ nodes:** Use collapse/expand patterns, minimize DOM complexity per node
- **500+ nodes:** Consider virtualization or custom rendering strategies

> The React Flow documentation states that performance issues stem primarily from
> **unnecessary re-renders** rather than raw node rendering count.

---

## 9. Zustand Integration (Recommended Pattern)

### Why Zustand

1. React Flow already uses Zustand internally
2. Lightweight (1.1kB), no boilerplate
3. Works outside React components (useful for execution engine)
4. Selector-based subscriptions prevent unnecessary re-renders
5. Middleware support (persist, devtools, immer)

### Full Store for Scenario Builder

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from '@xyflow/react';

interface ScenarioStore {
  // Flow state
  nodes: Node[];
  edges: Edge[];

  // Handlers (passed to ReactFlow)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // CRUD
  addNode: (node: Node) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;

  // Scenario management
  scenarioName: string;
  setScenarioName: (name: string) => void;
  reset: () => void;

  // Serialization
  exportScenario: () => string;
  importScenario: (json: string) => void;
}

export const useScenarioStore = create<ScenarioStore>()(
  devtools(
    persist(
      (set, get) => ({
        nodes: [],
        edges: [],
        scenarioName: 'Untitled Scenario',

        onNodesChange: (changes) => {
          set({ nodes: applyNodeChanges(changes, get().nodes) }, false, 'onNodesChange');
        },

        onEdgesChange: (changes) => {
          set({ edges: applyEdgeChanges(changes, get().edges) }, false, 'onEdgesChange');
        },

        onConnect: (connection) => {
          set({ edges: addEdge(connection, get().edges) }, false, 'onConnect');
        },

        addNode: (node) => {
          set({ nodes: [...get().nodes, node] }, false, 'addNode');
        },

        updateNodeData: (id, data) => {
          set({
            nodes: get().nodes.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, ...data } } : n
            ),
          }, false, 'updateNodeData');
        },

        deleteNode: (id) => {
          set({
            nodes: get().nodes.filter((n) => n.id !== id),
            edges: get().edges.filter((e) => e.source !== id && e.target !== id),
          }, false, 'deleteNode');
        },

        setScenarioName: (name) => set({ scenarioName: name }),

        reset: () => set({ nodes: [], edges: [], scenarioName: 'Untitled Scenario' }),

        exportScenario: () => {
          const { nodes, edges, scenarioName } = get();
          return JSON.stringify({ scenarioName, nodes, edges }, null, 2);
        },

        importScenario: (json) => {
          const { scenarioName, nodes, edges } = JSON.parse(json);
          set({ scenarioName, nodes, edges });
        },
      }),
      {
        name: 'sipflow-scenario-storage',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          scenarioName: state.scenarioName,
        }),
      },
    ),
    { name: 'SipFlow Scenario Store' },
  ),
);
```

### Using the Store in ReactFlow

```tsx
function ScenarioEditor() {
  const nodes = useScenarioStore((s) => s.nodes);
  const edges = useScenarioStore((s) => s.edges);
  const onNodesChange = useScenarioStore((s) => s.onNodesChange);
  const onEdgesChange = useScenarioStore((s) => s.onEdgesChange);
  const onConnect = useScenarioStore((s) => s.onConnect);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

---

## 10. Architecture Recommendations for SipFlow Scenario Builder

### Suggested Node Types

| Node Type | Purpose | Handles |
|-----------|---------|---------|
| `sipCommand` | INVITE, REGISTER, BYE, etc. | 1 target (top), 1 source (bottom) |
| `sipEvent` | 100 Trying, 180 Ringing, 200 OK | 1 target (top), 1 source (bottom) |
| `condition` | Branch on response code / header | 1 target (top), N source (bottom, labeled) |
| `delay` | Wait / timer node | 1 target (top), 1 source (bottom) |
| `script` | Custom logic / header manipulation | 1 target (top), 1 source (bottom) |
| `start` | Scenario entry point | 1 source (bottom) |
| `end` | Scenario termination | 1 target (top) |

### Suggested Edge Types

| Edge Type | Visual | Use Case |
|-----------|--------|----------|
| `default` | Bezier | Standard flow connection |
| `messageFlow` | Animated particle | Active SIP message in transit |
| `conditional` | Dashed + label | Branch paths from condition nodes |

### Suggested File Structure

```
src/
  features/
    scenario-builder/
      components/
        ScenarioEditor.tsx      # Main ReactFlow wrapper
        Sidebar.tsx             # Draggable node palette
        NodeInspector.tsx       # Selected node properties panel
      nodes/
        SipCommandNode.tsx
        SipEventNode.tsx
        ConditionNode.tsx
        DelayNode.tsx
        StartNode.tsx
        EndNode.tsx
        index.ts                # nodeTypes map export
      edges/
        MessageFlowEdge.tsx
        ConditionalEdge.tsx
        index.ts                # edgeTypes map export
      store/
        scenarioStore.ts        # Zustand store
        execution.ts            # Flow execution engine
      hooks/
        useDragAndDrop.ts
        useScenarioExport.ts
      types/
        nodes.ts                # Node type definitions
        edges.ts                # Edge type definitions
```

### Key Dependencies

```json
{
  "@xyflow/react": "^12.10.0",
  "zustand": "^5.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```

---

## Sources

- https://reactflow.dev/learn/getting-started/installation-and-requirements
- https://reactflow.dev/learn (Quick Start & Core Concepts)
- https://reactflow.dev/learn/customization/custom-nodes
- https://reactflow.dev/learn/customization/handles
- https://reactflow.dev/learn/advanced-use/typescript
- https://reactflow.dev/learn/advanced-use/state-management
- https://reactflow.dev/learn/advanced-use/performance
- https://reactflow.dev/examples/interaction/drag-and-drop
- https://reactflow.dev/examples/interaction/save-and-restore
- https://reactflow.dev/examples/edges/animating-edges
- https://reactflow.dev/examples/edges/custom-edges
- https://reactflow.dev/api-reference/types/edge
- https://reactflow.dev/api-reference/types/node-props
- https://www.npmjs.com/package/@xyflow/react
- https://github.com/xyflow/xyflow
- https://liambx.com/blog/tuning-edge-animations-reactflow-optimal-performance
