# Phase 2: Visual Flow Designer - Research

**Researched:** 2026-02-01
**Domain:** Node-based UI with xyflow/react for SIP flow design
**Confidence:** HIGH

## Summary

Phase 2 implements a drag-and-drop visual flow designer using @xyflow/react for designing SIP call flows. Research focused on xyflow performance best practices, node-based UI design patterns, sidebar drag interactions, property panel UX, and edge connection validation. The existing `.examples/frontend` codebase provides a proven reference implementation (minus yjs collaboration features).

**Key findings:**
- @xyflow/react nodeTypes MUST be defined outside components to prevent performance collapse (critical blocker from Phase 1)
- Drag-and-drop from sidebar to canvas uses native HTML5 DnD API with `dataTransfer.setData('application/xyflow', nodeType)`
- Edge validation via `isValidConnection` prop prevents invalid node connections (can show visual warnings without blocking)
- shadcn/ui Sheet component is ideal for slide-out property panels with save/cancel workflow
- lucide-react provides comprehensive icon set for SIP commands (Phone, PhoneCall, PhoneOff, Pause, PhoneForwarded, X, etc.)
- Performance remains stable with 100+ nodes when using memoized components and Zustand selectors

**Primary recommendation:** Follow the proven architecture pattern from `.examples/frontend` - define nodeTypes outside components, use native DnD for sidebar interactions, implement Sheet-based property panel, and use `isValidConnection` for edge validation with visual warnings rather than blocking.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.8+ | Node-based canvas UI | Industry standard for flow diagrams, proven performance, extensive API |
| lucide-react | 0.525+ | Icon library | 1000+ SVG icons, tree-shakeable, matches shadcn/ui aesthetic |
| shadcn/ui | latest | UI components | Already installed in Phase 1, Sheet/Accordion/Select ideal for properties panel |
| Tailwind CSS | 4+ | Styling | Already configured in Phase 1 with v4 @theme directive |
| Zustand | 5+ | State management | Already installed in Phase 1, selector pattern prevents re-renders |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | 3+ | Resizable layout | Optional: if sidebar/panel need user-resizable widths |
| immer | 10+ | Immutable state updates | Optional: simplifies nested node data updates in Zustand |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xyflow/react | Konva + custom | Konva is lower-level canvas library, would need to build node/edge logic from scratch |
| Native HTML5 DnD | dnd-kit | dnd-kit is more feature-rich but heavier, HTML5 DnD sufficient for sidebar → canvas |
| Sheet (slide-out) | Dialog (modal) | Modal blocks canvas interaction, slide-out allows reference while editing |
| lucide-react | heroicons/FontAwesome | lucide has better coverage for SIP-related icons, smaller bundle size |

**Installation:**
```bash
cd frontend
npm install @xyflow/react lucide-react
```

Note: shadcn/ui, Tailwind CSS v4, and Zustand are already installed from Phase 1.

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
├── components/
│   ├── flow/
│   │   ├── FlowCanvas.tsx           # Main ReactFlow wrapper component
│   │   ├── FlowToolbar.tsx          # Bottom toolbar (zoom, fit view)
│   │   ├── nodes/
│   │   │   ├── index.ts             # Export nodeTypes (DEFINED OUTSIDE!)
│   │   │   ├── SIPInstanceNode.tsx  # SIP UA instance node
│   │   │   ├── CommandNode.tsx      # Command nodes (MakeCall, Hold, etc.)
│   │   │   └── EventNode.tsx        # Event wait nodes
│   │   ├── edges/
│   │   │   ├── index.ts             # Export edgeTypes
│   │   │   └── FlowEdge.tsx         # Custom edge with arrow
│   │   ├── LeftSidebar.tsx          # Node palette with drag items
│   │   ├── RightSidebar.tsx         # Property panel (Sheet-based)
│   │   └── PropertyPanels/
│   │       ├── SIPInstancePanel.tsx # SIP Instance properties
│   │       ├── CommandPanel.tsx     # Command node properties
│   │       └── EventPanel.tsx       # Event node properties
│   ├── ui/                          # shadcn/ui components (already exists)
│   └── layout/                      # Header/Sidebar (already exists)
├── stores/
│   └── flowStore.ts                 # Already exists from Phase 1
└── types/
    └── nodes.ts                     # Node data type definitions
```

### Pattern 1: nodeTypes Definition (CRITICAL)
**What:** Define nodeTypes object at module level, outside all components
**When to use:** Always - this is mandatory for React Flow performance
**Why critical:** Defining nodeTypes inside a component causes React Flow to unmount and remount ALL nodes on every parent re-render, causing catastrophic performance degradation

**Example:**
```typescript
// frontend/src/components/flow/nodes/index.ts
import { NodeTypes } from '@xyflow/react'
import { memo } from 'react'
import SIPInstanceNode from './SIPInstanceNode'
import CommandNode from './CommandNode'
import EventNode from './EventNode'

// CRITICAL: Define outside component at module level
// Memoize individual node components
const MemoizedSIPInstance = memo(SIPInstanceNode)
const MemoizedCommand = memo(CommandNode)
const MemoizedEvent = memo(EventNode)

export const nodeTypes: NodeTypes = {
  sipInstance: MemoizedSIPInstance,
  command: MemoizedCommand,
  event: MemoizedEvent,
} as const

// frontend/src/components/flow/FlowCanvas.tsx
import { ReactFlow } from '@xyflow/react'
import { nodeTypes } from './nodes'  // Import stable reference
import '@xyflow/react/dist/style.css'

export const FlowCanvas = () => {
  const nodes = useFlowStore(state => state.nodes)
  const edges = useFlowStore(state => state.edges)

  // nodeTypes is stable, never changes
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      // ... other props
    />
  )
}
```

### Pattern 2: Sidebar Drag-and-Drop to Canvas
**What:** Use native HTML5 drag-and-drop API to add nodes from sidebar palette
**When to use:** For adding new nodes to canvas from a fixed palette
**How it works:** Sidebar sets `dataTransfer.setData('application/xyflow', nodeType)`, canvas handles `onDrop` with `screenToFlowPosition`

**Example:**
```typescript
// frontend/src/components/flow/LeftSidebar.tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Phone, PhoneCall, Timer } from 'lucide-react'

const nodeCategories = [
  {
    title: 'SIP Instance',
    items: [
      { type: 'sipInstance', label: 'SIP UA', icon: Phone }
    ]
  },
  {
    title: 'Commands',
    items: [
      { type: 'command:makeCall', label: 'Make Call', icon: PhoneCall },
      { type: 'command:hold', label: 'Hold', icon: Pause },
      { type: 'command:bye', label: 'Bye', icon: PhoneOff },
      // ... other commands
    ]
  },
  {
    title: 'Events',
    items: [
      { type: 'event:wait', label: 'Wait Event', icon: Timer }
    ]
  }
]

export const LeftSidebar = () => {
  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/xyflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 border-r bg-background">
      <Accordion type="single" collapsible defaultValue="Commands">
        {nodeCategories.map(category => (
          <AccordionItem key={category.title} value={category.title}>
            <AccordionTrigger>{category.title}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 p-2">
                {category.items.map(item => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.type)}
                      className="flex flex-col items-center gap-1 p-2 rounded cursor-grab hover:bg-muted active:cursor-grabbing"
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// frontend/src/components/flow/FlowCanvas.tsx
import { useReactFlow } from '@xyflow/react'

export const FlowCanvas = () => {
  const { screenToFlowPosition } = useReactFlow()
  const { actions } = useFlowStore()

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()

    const nodeType = event.dataTransfer.getData('application/xyflow')
    if (!nodeType) return

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType.split(':')[0], // 'command:makeCall' -> 'command'
      position,
      data: {
        label: nodeType,
        command: nodeType.split(':')[1], // 'command:makeCall' -> 'makeCall'
      }
    }

    actions.addNode(newNode)
  }, [screenToFlowPosition, actions])

  return (
    <ReactFlow
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      // ... other props
    />
  )
}
```

### Pattern 3: Sheet-based Property Panel
**What:** Use shadcn/ui Sheet component for slide-out property editor from right side
**When to use:** For editing node properties with save/cancel workflow
**Why Sheet:** Non-modal (can see canvas), slide animation, built-in overlay, keyboard accessible

**Example:**
```typescript
// frontend/src/components/flow/RightSidebar.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import SIPInstancePanel from './PropertyPanels/SIPInstancePanel'
import CommandPanel from './PropertyPanels/CommandPanel'

export const RightSidebar = () => {
  const selectedNodeId = useFlowStore(state => state.selectedNodeId)
  const selectedNode = useFlowStore(state =>
    state.nodes.find(n => n.id === selectedNodeId)
  )
  const { actions } = useFlowStore()

  const [localData, setLocalData] = useState(selectedNode?.data || {})

  const handleSave = () => {
    if (selectedNodeId) {
      actions.updateNodeData(selectedNodeId, localData)
      actions.setSelectedNode(null)
    }
  }

  const handleCancel = () => {
    actions.setSelectedNode(null)
  }

  return (
    <Sheet open={!!selectedNodeId} onOpenChange={(open) => !open && handleCancel()}>
      <SheetContent className="w-96">
        <SheetHeader>
          <SheetTitle>
            {selectedNode?.type === 'sipInstance' && 'SIP Instance Properties'}
            {selectedNode?.type === 'command' && 'Command Properties'}
            {selectedNode?.type === 'event' && 'Event Properties'}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4">
          {selectedNode?.type === 'sipInstance' && (
            <SIPInstancePanel data={localData} onChange={setLocalData} />
          )}
          {selectedNode?.type === 'command' && (
            <CommandPanel data={localData} onChange={setLocalData} />
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// frontend/src/components/flow/PropertyPanels/SIPInstancePanel.tsx
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SIPInstancePanelProps {
  data: { server?: string; transport?: string }
  onChange: (data: any) => void
}

export const SIPInstancePanel = ({ data, onChange }: SIPInstancePanelProps) => {
  // TODO: Phase 4 will have actual server list from settings
  const mockServers = ['Server 1 (192.168.1.100)', 'Server 2 (10.0.0.50)']

  return (
    <div className="space-y-4">
      <div>
        <Label>SIP Server</Label>
        <Select
          value={data.server}
          onValueChange={(value) => onChange({ ...data, server: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select server" />
          </SelectTrigger>
          <SelectContent>
            {mockServers.map(server => (
              <SelectItem key={server} value={server}>{server}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Transport</Label>
        <Select
          value={data.transport}
          onValueChange={(value) => onChange({ ...data, transport: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select transport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UDP">UDP</SelectItem>
            <SelectItem value="TCP">TCP</SelectItem>
            <SelectItem value="TLS">TLS</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

### Pattern 4: Edge Connection Validation with Visual Warnings
**What:** Use `isValidConnection` prop to validate edges, show visual warnings (red edge) instead of blocking
**When to use:** To enforce flow rules (Instance → Command → Event sequence) while allowing flexibility
**Why visual warnings:** Users can create invalid flows for testing/drafts, validation shows in UI

**Example:**
```typescript
// frontend/src/components/flow/FlowCanvas.tsx
import { IsValidConnection, Connection } from '@xyflow/react'

const isValidConnection: IsValidConnection = (connection: Connection) => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    return false
  }

  // Allow all connections (validation is visual, not blocking)
  return true
}

// Validation logic for visual warnings (called separately)
const validateFlowRules = (connection: Connection, nodes: Node[]) => {
  const sourceNode = nodes.find(n => n.id === connection.source)
  const targetNode = nodes.find(n => n.id === connection.target)

  if (!sourceNode || !targetNode) return false

  // Enforce sequence: Instance → Command → Event → Command...
  const validSequences = {
    sipInstance: ['command'],
    command: ['event', 'command'], // Command can go to event or another command
    event: ['command']
  }

  return validSequences[sourceNode.type]?.includes(targetNode.type) ?? false
}

// Custom edge component with visual warning
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

export const FlowEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isValid = data?.isValid ?? true

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: isValid ? 'currentColor' : 'rgb(239 68 68)', // red-500 if invalid
        strokeWidth: 2,
      }}
    />
  )
}
```

### Pattern 5: Custom Node Components with Handles
**What:** Create custom node components with input/output handles and icon-based design
**When to use:** For all three node types (SIP Instance, Command, Event)
**Design:** Icon + label, handles positioned for sequential flow (output on right, input on left)

**Example:**
```typescript
// frontend/src/components/flow/nodes/CommandNode.tsx
import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import {
  PhoneCall, PhoneMissed, PhoneOff, Pause, Play,
  PhoneForwarded, X, BellOff
} from 'lucide-react'

const commandIcons = {
  makeCall: PhoneCall,
  hold: Pause,
  retrieve: Play,
  blindTransfer: PhoneForwarded,
  muteTransfer: PhoneForwarded,
  bye: PhoneOff,
  cancel: X,
  busy: BellOff,
}

interface CommandNodeData {
  label: string
  command: keyof typeof commandIcons
}

const CommandNode = ({ data, selected }: NodeProps<CommandNodeData>) => {
  const Icon = commandIcons[data.command] || PhoneCall

  return (
    <div className={`
      px-4 py-3 rounded-lg border-2 bg-background
      ${selected ? 'border-primary shadow-lg' : 'border-muted'}
    `}>
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{data.label}</span>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  )
}

export default memo(CommandNode)
```

### Anti-Patterns to Avoid

- **Defining nodeTypes inside component:** Causes complete node tree re-render on every state change, performance collapse
- **Not memoizing node components:** React Flow re-renders unnecessarily, use `memo()` on all custom nodes
- **Using modal dialogs for properties:** Blocks canvas visibility, use Sheet (slide-out) instead
- **Blocking invalid connections:** UX frustration, use visual warnings (red edges) instead
- **Accessing entire Zustand store:** Components re-render on any change, use selectors for specific slices
- **Not using `screenToFlowPosition` in drop handler:** Nodes appear at wrong position when canvas is panned/zoomed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop library | dnd-kit or custom | Native HTML5 DnD API | React Flow docs recommend HTML5 DnD for sidebar → canvas, simpler than libraries |
| Slide-out panel animation | Custom CSS transitions | shadcn/ui Sheet | Built-in accessibility, overlay, keyboard nav, consistent with app design |
| Icon library for SIP commands | Custom SVG icons | lucide-react | 1000+ icons, tree-shakeable, includes Phone/PhoneCall/Pause/etc. |
| Canvas zoom/pan controls | Custom buttons + logic | ReactFlow Controls component | Built-in zoom/pan/fit view, keyboard shortcuts, accessible |
| Edge path calculation | Manual bezier math | `getBezierPath` from @xyflow/react | Handles all edge cases, curved paths, multiple connection points |
| Node connection validation | Custom edge creation logic | `isValidConnection` prop | Built into React Flow, called for both UI and programmatic connections |

**Key insight:** @xyflow/react is a complete solution for node-based UIs - use its built-in components (Controls, MiniMap, Background) and props (`isValidConnection`, `onDrop`, etc.) rather than reimplementing. Focus effort on domain-specific logic (SIP node types, property panels) not generic canvas features.

## Common Pitfalls

### Pitfall 1: nodeTypes Definition Inside Component
**What goes wrong:** UI becomes sluggish after adding 5-10 nodes, every interaction lags
**Why it happens:** When nodeTypes is defined inside component, React Flow receives a new reference on every render, causing it to unmount and remount ALL nodes
**How to avoid:**
- Define nodeTypes at module level (outside all components)
- Import as stable reference: `import { nodeTypes } from './nodes'`
- Memoize individual node components with `React.memo()`
- Never use `useMemo(() => ({ ... }))` for nodeTypes - still creates new reference on deps change

**Warning signs:**
- Performance degrades as node count increases
- React DevTools profiler shows all nodes re-rendering on unrelated state changes
- Typing in input fields causes visible lag

**Sources:**
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance) - "nodeTypes should only be changed dynamically in very rare cases"
- [React Flow Common Errors](https://reactflow.dev/learn/troubleshooting/common-errors) - "Make sure to define the nodeTypes object outside of the component or use useMemo"
- Phase 1 research finding: "React Flow nodeTypes must be defined outside components and memoized to prevent performance collapse"

### Pitfall 2: Direct Store Access Without Selectors
**What goes wrong:** Property panel re-renders 60 times per second during canvas pan/zoom
**Why it happens:** Accessing `useFlowStore()` without selector subscribes component to all state changes, including viewport updates
**How to avoid:**
- Always use selectors: `useFlowStore(state => state.selectedNodeId)`
- Group actions in `actions` object (already done in Phase 1)
- Use `shallow` comparison for object selections if needed
- Separate frequently-changing state (viewport) from UI state (selection)

**Warning signs:**
- Components re-render during pan/zoom even though their data hasn't changed
- React DevTools shows excessive render counts
- Unnecessary network requests triggered by re-renders

**Sources:**
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance) - "directly accessing the nodes or edges from the store causes re-renders on any array mutation"
- Phase 1 research: "Use Zustand selectors pattern to prevent re-renders"

### Pitfall 3: Missing `screenToFlowPosition` in Drop Handler
**What goes wrong:** Nodes dropped from sidebar appear at wrong position when canvas is panned or zoomed
**Why it happens:** `event.clientX/Y` are screen coordinates, but React Flow needs flow coordinates that account for pan/zoom
**How to avoid:**
- Always use `useReactFlow()` hook to get `screenToFlowPosition`
- Call `screenToFlowPosition({ x: event.clientX, y: event.clientY })` in drop handler
- Never use clientX/Y directly for node position

**Warning signs:**
- Nodes appear far from drop location when canvas is zoomed out
- Nodes jump to unexpected positions after drop
- Drop position is correct only when canvas is at 100% zoom and (0,0) pan

**Sources:**
- [React Flow Drag and Drop Example](https://reactflow.dev/examples/interaction/drag-and-drop) - "we need to remove the wrapper bounds to get the correct position"
- .examples/frontend reference implementation uses `screenToFlowPosition`

### Pitfall 4: Sheet Component State Management
**What goes wrong:** Property changes lost when clicking outside Sheet (auto-close), or Sheet doesn't close after save
**Why it happens:** Sheet's `open` state and form state must be coordinated, unclear ownership of "cancel" logic
**How to avoid:**
- Control Sheet `open` state via Zustand store's `selectedNodeId`
- Maintain local form state separate from store until "Save" clicked
- `onOpenChange={(open) => !open && handleCancel()}` handles outside-click cancel
- Clear `selectedNodeId` on both Save and Cancel

**Warning signs:**
- Property panel doesn't close after clicking Save
- Changes are lost when clicking outside panel
- Panel opens/closes unexpectedly during node operations

**Sources:**
- [shadcn/ui Sheet Documentation](https://ui.shadcn.com/docs/components/sheet) - controlled state pattern
- .examples/frontend has similar pattern but uses global state differently (yjs-based)

### Pitfall 5: Edge Connection Blocking Instead of Warning
**What goes wrong:** Users frustrated when connections are blocked, unclear why connection failed
**Why it happens:** `isValidConnection` returning `false` prevents edge creation entirely, no feedback
**How to avoid:**
- Allow all connections in `isValidConnection` (return true)
- Implement separate validation function that marks edges as invalid
- Show visual warning (red color, dashed line) for invalid edges
- Provide validation panel that lists all flow errors

**Warning signs:**
- Users repeatedly try to create connections that silently fail
- Support requests asking "why can't I connect these nodes?"
- No visual feedback when invalid connection attempted

**Sources:**
- [React Flow Validation Example](https://reactflow.dev/examples/interaction/validation) - shows blocking approach
- UX best practice: progressive disclosure - allow invalid states, show warnings, guide toward valid states

### Pitfall 6: lucide-react Icon Import Performance
**What goes wrong:** Frontend bundle size bloats, initial load time increases
**Why it happens:** Importing all icons (`import * as Icons from 'lucide-react'`) includes 1000+ icons in bundle
**How to avoid:**
- Import only needed icons: `import { Phone, PhoneCall } from 'lucide-react'`
- Create icon mapping object with explicit imports
- Never use `import * as Icons` or `Icons[iconName]` dynamic lookup

**Warning signs:**
- Bundle size analysis shows lucide-react as large chunk
- Tree-shaking doesn't reduce icon bundle
- Initial page load noticeably slower

**Sources:**
- [lucide-react npm page](https://www.npmjs.com/package/lucide-react) - recommends individual imports for tree-shaking
- General Vite/webpack best practice: named imports enable tree-shaking

## Code Examples

Verified patterns from official sources and reference implementation:

### Complete FlowCanvas with All Features
```typescript
// frontend/src/components/flow/FlowCanvas.tsx
import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type IsValidConnection,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFlowStore } from '@/stores/flowStore'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { FlowToolbar } from './FlowToolbar'

export const FlowCanvas = () => {
  const { screenToFlowPosition } = useReactFlow()

  const nodes = useFlowStore(state => state.nodes)
  const edges = useFlowStore(state => state.edges)
  const { actions } = useFlowStore()

  // Drag-and-drop from sidebar
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()

    const nodeType = event.dataTransfer.getData('application/xyflow')
    if (!nodeType) return

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType.split(':')[0],
      position,
      data: {
        label: nodeType,
        command: nodeType.split(':')[1],
      }
    }

    actions.addNode(newNode)
  }, [screenToFlowPosition, actions])

  // Node selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    actions.setSelectedNode(node.id)
  }, [actions])

  // Canvas click deselects
  const handlePaneClick = useCallback(() => {
    actions.setSelectedNode(null)
  }, [actions])

  // Node/edge changes
  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    // Apply changes to store
    // TODO: Implement change handling in Zustand actions
  }, [])

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    // Apply changes to store
  }, [])

  // Edge creation
  const handleConnect: OnConnect = useCallback((connection) => {
    const newEdge = {
      id: `edge-${connection.source}-${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      type: 'flowEdge',
    }
    actions.addEdge(newEdge)
  }, [actions])

  // Edge validation (prevent self-connections)
  const isValidConnection: IsValidConnection = useCallback((connection) => {
    return connection.source !== connection.target
  }, [])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        isValidConnection={isValidConnection}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background />
        <Controls />
        <MiniMap zoomable pannable />
        <Panel position="bottom-center">
          <FlowToolbar />
        </Panel>
      </ReactFlow>
    </div>
  )
}
```

### lucide-react Icon Mapping for SIP Commands
```typescript
// frontend/src/components/flow/nodes/commandIcons.ts
import {
  PhoneCall,      // MakeCall
  PhoneOff,       // Bye
  X,              // Cancel
  Pause,          // Hold
  Play,           // Retrieve
  PhoneForwarded, // Blind Transfer, Mute Transfer
  BellOff,        // 486 Busy
  Timer,          // Event wait
  Phone,          // SIP Instance
} from 'lucide-react'

export const commandIcons = {
  // Commands
  makeCall: PhoneCall,
  bye: PhoneOff,
  cancel: X,
  hold: Pause,
  retrieve: Play,
  blindTransfer: PhoneForwarded,
  muteTransfer: PhoneForwarded, // Could use different icon if needed
  busy: BellOff,

  // Event
  wait: Timer,

  // SIP Instance
  sipInstance: Phone,
} as const

export type CommandType = keyof typeof commandIcons
```

### Accordion-based Sidebar with Drag Items
```typescript
// frontend/src/components/flow/LeftSidebar.tsx
import { useState } from 'react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { commandIcons, type CommandType } from './nodes/commandIcons'

interface NodeItem {
  type: string
  label: string
  command: CommandType
}

const nodeCategories = [
  {
    title: 'SIP Instance',
    items: [
      { type: 'sipInstance', label: 'SIP UA', command: 'sipInstance' as CommandType }
    ]
  },
  {
    title: 'Commands',
    items: [
      { type: 'command', label: 'Make Call', command: 'makeCall' as CommandType },
      { type: 'command', label: 'Hold', command: 'hold' as CommandType },
      { type: 'command', label: 'Retrieve', command: 'retrieve' as CommandType },
      { type: 'command', label: 'Blind Transfer', command: 'blindTransfer' as CommandType },
      { type: 'command', label: 'Mute Transfer', command: 'muteTransfer' as CommandType },
      { type: 'command', label: 'Bye', command: 'bye' as CommandType },
      { type: 'command', label: 'Cancel', command: 'cancel' as CommandType },
      { type: 'command', label: '486 Busy', command: 'busy' as CommandType },
    ]
  },
  {
    title: 'Events',
    items: [
      { type: 'event', label: 'Wait Event', command: 'wait' as CommandType }
    ]
  }
]

export const LeftSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const isOpen = useFlowStore(state => state.sidebarOpen)

  if (!isOpen) return null

  const handleDragStart = (event: React.DragEvent, item: NodeItem) => {
    // Format: 'type:command' for commands, or just 'type' for others
    const dataValue = item.type === 'command'
      ? `${item.type}:${item.command}`
      : item.type

    event.dataTransfer.setData('application/xyflow', dataValue)
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredCategories = nodeCategories.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.items.length > 0)

  return (
    <div className="w-64 border-r bg-background h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Accordion */}
      <Accordion type="single" collapsible defaultValue="Commands" className="flex-1 overflow-y-auto">
        {filteredCategories.map(category => {
          const Icon = commandIcons[category.items[0].command]

          return (
            <AccordionItem key={category.title} value={category.title}>
              <AccordionTrigger className="px-4">{category.title}</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2 p-4">
                  {category.items.map(item => {
                    const ItemIcon = commandIcons[item.command]

                    return (
                      <div
                        key={`${item.type}-${item.command}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-grab hover:bg-muted hover:border-muted-foreground/50 active:cursor-grabbing transition-colors"
                      >
                        <ItemIcon className="h-6 w-6" />
                        <span className="text-xs text-center">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reactflow (npm package) | @xyflow/react | 2024 (v12) | Package renamed, better TypeScript types, improved API |
| Custom drag-and-drop libraries | Native HTML5 DnD API | Always preferred for React Flow | Simpler, better integration, recommended by React Flow docs |
| Modal dialogs for properties | Slide-out panels (Sheet) | Modern UX trend | Non-blocking, can reference canvas while editing |
| Blocking invalid connections | Visual warnings | Modern flow editors | Better UX, allows draft/test flows, progressive guidance |
| Manual icon imports | lucide-react | 2023+ | Tree-shakeable, consistent design system, 1000+ icons |
| Tailwind CSS v3 | Tailwind CSS v4 | 2024 | `@theme` instead of `@layer`, simpler syntax (already adopted in Phase 1) |

**Deprecated/outdated:**
- **reactflow npm package:** Renamed to @xyflow/react in v12, old package no longer maintained
- **react-flow-renderer:** Legacy package name, completely replaced by @xyflow/react
- **Custom canvas libraries (Konva, Fabric.js):** For node-based UIs, @xyflow/react is now standard
- **Complex DnD libraries for simple canvas drops:** HTML5 DnD is sufficient and recommended

## Open Questions

Things that couldn't be fully resolved:

1. **Node size consistency**
   - What we know: .examples/frontend uses fixed sizes (40x40 for command nodes, 200x100 for memo nodes)
   - What's unclear: Optimal sizes for SIP Instance vs Command vs Event nodes for visual hierarchy
   - Recommendation: Start with consistent 40x40 for commands/events, 60x60 for SIP Instance (larger = more important), adjust based on user feedback

2. **Empty canvas state UX**
   - What we know: Common pattern is placeholder text + visual guide
   - What's unclear: Best prompt for SIP flow editor (drag instruction? example flow?)
   - Recommendation: Simple text "Drag nodes from sidebar to build your SIP flow" centered in canvas when nodes.length === 0

3. **Canvas manipulation features**
   - What we know: .examples/frontend has undo/redo, copy/paste, alignment helpers
   - What's unclear: Which features are MVP vs nice-to-have for Phase 2
   - Recommendation: MVP = zoom/pan/fit-view (built-in Controls), defer undo/redo and copy/paste to Phase 3 based on .examples reference

4. **Server selection UX in Phase 2**
   - What we know: CONTEXT.md specifies SelectBox for server selection, actual server management in Phase 4
   - What's unclear: Should Phase 2 use mock data or wait for Phase 4 integration?
   - Recommendation: Use mock server list in Phase 2 (2-3 hardcoded options), replace with real data in Phase 4 integration task

## Sources

### Primary (HIGH confidence)
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance) - nodeTypes memoization, selector patterns
- [React Flow Drag and Drop Example](https://reactflow.dev/examples/interaction/drag-and-drop) - sidebar to canvas pattern
- [React Flow Validation Example](https://reactflow.dev/examples/interaction/validation) - isValidConnection API
- [React Flow Common Errors](https://reactflow.dev/learn/troubleshooting/common-errors) - nodeTypes pitfalls
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/sheet) - slide-out panel component
- [shadcn/ui Accordion](https://ui.shadcn.com/docs/components/accordion) - collapsible sidebar sections
- [lucide-react Icons](https://lucide.dev/icons/) - icon catalog and import guide
- `.examples/frontend` codebase - proven reference implementation (Phase 1 established this)

### Secondary (MEDIUM confidence)
- [React Flow Accessibility](https://reactflow.dev/learn/advanced-use/accessibility) - keyboard navigation, focus management
- [React Flow Controls Component](https://reactflow.dev/api-reference/components/controls) - built-in toolbar
- [dnd-kit comparison](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - confirms HTML5 DnD is simplest for basic use cases
- [Framer Motion for sidebars](https://egghead.io/blog/how-to-create-a-sliding-sidebar-menu-with-framer-motion) - animation patterns (not needed if using shadcn Sheet)
- Phase 1 research findings - Zustand selector patterns, performance best practices

### Tertiary (LOW confidence - marked for validation)
- WebSearch results on node-based UI design patterns - general patterns, not React Flow specific
- Community discussions on slide-out vs modal UX - UX preference, not technical requirement
- lucide-react icon suggestions for SIP commands - naming is subjective, verify with actual use

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @xyflow/react, lucide-react, shadcn/ui all verified via official docs and package.json
- Architecture patterns: HIGH - nodeTypes pattern is critical and well-documented, DnD pattern from official examples
- Don't hand-roll: HIGH - All recommendations from official React Flow docs and established patterns
- Pitfalls: HIGH - nodeTypes performance issue verified in official docs and Phase 1 research
- Code examples: MEDIUM - Patterns verified from .examples/frontend and official docs, but not tested in sipflow codebase yet

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - @xyflow/react stable, v12 released 2024)
