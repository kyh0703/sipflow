# Architecture Patterns

**Domain:** SIP Call Flow Designer Desktop Application
**Stack:** Go/Wails v2 + React/xyflow + diago + SQLite
**Researched:** 2026-02-01
**Confidence:** MEDIUM

## Recommended Architecture

SIPFlow follows a layered desktop application architecture with clear separation between UI (React/xyflow), application logic (Wails bindings), business logic (Go services), and infrastructure (diago SIP engine + SQLite storage).

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer (React)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ xyflow Canvas│  │  Flow Editor │  │  UI Controls │      │
│  │  Component   │  │   State Mgmt │  │   & Dialogs  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                            ▼                                 │
│                   Wails Runtime API                          │
│              (Generated JS Bindings + Events)                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Wails Bindings Layer (Go)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ FlowService  │  │SimulationSvc │  │ ProjectSvc   │      │
│  │   (CRUD)     │  │  (Execution) │  │  (Settings)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer (Go)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Flow Manager │  │  Execution   │  │  Config      │      │
│  │              │  │   Engine     │  │  Manager     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer (Go)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Flow Model   │  │  Node Types  │  │  UA Config   │      │
│  │ (Graph)      │  │  (Cmd/Event) │  │  (SIP URI)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer (Go)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   SQLite     │  │ diago SIP    │  │  Embedded    │      │
│  │  Repository  │  │   Engine     │  │  SIP Server  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### Frontend Layer (React + xyflow)

**Responsibility:** Visual flow editing, user interaction, real-time execution visualization

| Component | Purpose | Key Dependencies |
|-----------|---------|------------------|
| **xyflow Canvas** | Node-based flow editor UI | @xyflow/react, React |
| **Flow State Manager** | Manages nodes/edges state | useNodesState, useEdgesState hooks |
| **Custom Node Components** | SIP Instance, Command, Event node UIs | xyflow NodeProps |
| **Simulation Visualizer** | Real-time execution animation | Wails events, xyflow node updates |
| **Wails Bindings Client** | Generated TypeScript bindings for Go methods | wailsjs/go/* (auto-generated) |

**State Management Pattern:**
- Use xyflow's built-in `useNodesState` and `useEdgesState` hooks for flow graph state
- Consider Zustand for cross-component state (simulation status, selected flow)
- Wails event listeners for backend-pushed updates (execution progress)

**Key Patterns:**
- Custom nodes with embedded handles (source/target connection points)
- Event-driven updates via Wails runtime events for execution progress
- Optimistic UI updates for CRUD operations with backend sync

### Wails Bindings Layer (Go Structs)

**Responsibility:** Expose application functionality to frontend via Wails bindings

| Service Struct | Exposed Methods | Internal Dependencies |
|----------------|-----------------|----------------------|
| **FlowService** | CreateFlow, UpdateFlow, DeleteFlow, GetFlow, ListFlows | FlowManager, Repository |
| **SimulationService** | StartSimulation, StopSimulation, PauseSimulation | ExecutionEngine, diago |
| **ProjectService** | GetConfig, SetConfig, ValidateSIPServer | ConfigManager |
| **UAService** | CreateUA, UpdateUA, DeleteUA, ListUAs | UAManager, Repository |

**Wails-Specific Patterns:**

```go
// Example FlowService struct
type FlowService struct {
    ctx      context.Context  // Injected by Wails on startup
    flowMgr  *flow.Manager
    repo     storage.Repository
}

// Wails lifecycle hooks
func (f *FlowService) Startup(ctx context.Context) {
    f.ctx = ctx
    // Initialize resources, event listeners
}

func (f *FlowService) Shutdown(ctx context.Context) {
    // Cleanup resources
}

// Exposed methods (public, auto-bound)
func (f *FlowService) CreateFlow(name string, nodes []Node, edges []Edge) (*Flow, error) {
    // Business logic delegates to domain layer
    return f.flowMgr.Create(name, nodes, edges)
}

// Event emission pattern
func (f *FlowService) emitProgress(nodeID string, status string) {
    runtime.EventsEmit(f.ctx, "simulation:progress", map[string]interface{}{
        "nodeID": nodeID,
        "status": status,
    })
}
```

**Context Management:**
- Store `context.Context` from `Startup()` in struct field
- Use for Wails runtime API calls (EventsEmit, dialogs, etc.)
- Propagate to goroutines for cancellation support

### Application Layer (Go Services)

**Responsibility:** Orchestrate business workflows, coordinate domain + infrastructure

| Component | Responsibility | Key Operations |
|-----------|---------------|----------------|
| **FlowManager** | Flow CRUD orchestration | Validate graph (DAG check), persist flows |
| **ExecutionEngine** | Flow execution orchestration | Topological sort → execution plan → command dispatch |
| **UAManager** | SIP User Agent lifecycle | Create/destroy diago UAs, manage UA registry |
| **ConfigManager** | Application configuration | Load/save settings, validate SIP server connectivity |

**Key Workflow: Flow Execution**

```go
type ExecutionEngine struct {
    uaRegistry  map[string]*diago.DialogUA
    sipEngine   *sip.Engine
    eventBus    *EventBus
}

func (e *ExecutionEngine) Execute(flow *Flow) error {
    // 1. Build execution plan (topological sort)
    plan, err := e.buildExecutionPlan(flow)
    if err != nil {
        return err
    }

    // 2. Initialize SIP UAs from SIP Instance nodes
    for _, instanceNode := range plan.SIPInstances {
        ua, err := e.createUA(instanceNode.Config)
        if err != nil {
            return err
        }
        e.uaRegistry[instanceNode.ID] = ua
    }

    // 3. Execute commands in topological order
    for _, step := range plan.Steps {
        switch step.Type {
        case NodeTypeCommand:
            err := e.executeCommand(step)
        case NodeTypeEvent:
            err := e.waitForEvent(step)
        }
        if err != nil {
            return err
        }

        // Emit progress event to frontend
        e.eventBus.Emit("simulation:progress", step.NodeID, "completed")
    }

    return nil
}
```

### Domain Layer (Go Core)

**Responsibility:** Pure business logic, domain models, no external dependencies

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **Flow** | Flow graph representation | ID, Name, Nodes, Edges, CreatedAt |
| **Node** | Flow node (SIP/Command/Event) | ID, Type, Config, Position |
| **Edge** | Connection between nodes | ID, Source, Target |
| **UAConfig** | SIP User Agent configuration | URI, Username, Password, Transport, Port |
| **ExecutionPlan** | Compiled execution sequence | SIPInstances, Steps (topologically sorted) |

**Key Domain Logic:**

```go
// Domain validation: ensure flow is a valid DAG
func (f *Flow) ValidateDAG() error {
    visited := make(map[string]bool)
    recStack := make(map[string]bool)

    for _, node := range f.Nodes {
        if !visited[node.ID] {
            if f.hasCycle(node.ID, visited, recStack) {
                return ErrCyclicGraph
            }
        }
    }
    return nil
}

// Domain logic: build execution plan via topological sort
func (f *Flow) BuildExecutionPlan() (*ExecutionPlan, error) {
    // Kahn's algorithm for topological sort
    inDegree := make(map[string]int)
    adjList := make(map[string][]string)

    // Build adjacency list and in-degree map
    for _, edge := range f.Edges {
        adjList[edge.Source] = append(adjList[edge.Source], edge.Target)
        inDegree[edge.Target]++
    }

    // BFS with queue of zero in-degree nodes
    queue := []string{}
    for _, node := range f.Nodes {
        if inDegree[node.ID] == 0 {
            queue = append(queue, node.ID)
        }
    }

    plan := &ExecutionPlan{}
    for len(queue) > 0 {
        nodeID := queue[0]
        queue = queue[1:]

        node := f.GetNode(nodeID)
        plan.Steps = append(plan.Steps, ExecutionStep{
            NodeID: nodeID,
            Type:   node.Type,
            Config: node.Config,
        })

        for _, neighbor := range adjList[nodeID] {
            inDegree[neighbor]--
            if inDegree[neighbor] == 0 {
                queue = append(queue, neighbor)
            }
        }
    }

    return plan, nil
}
```

### Infrastructure Layer (Go)

**Responsibility:** External systems, persistence, SIP stack integration

| Component | Purpose | External Dependency |
|-----------|---------|---------------------|
| **SQLiteRepository** | Flow/UA persistence | mattn/go-sqlite3 |
| **DiagoSIPEngine** | SIP signaling execution | emiago/diago |
| **EmbeddedSIPServer** | Internal SIP proxy | emiago/sipgo (diago's foundation) |

**SQLite Schema:**

```sql
-- Flows table
CREATE TABLE flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    graph_json TEXT NOT NULL,  -- Nodes + Edges as JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Agents table
CREATE TABLE user_agents (
    id TEXT PRIMARY KEY,
    uri TEXT NOT NULL,
    username TEXT,
    password TEXT,
    transport TEXT DEFAULT 'UDP',
    port INTEGER DEFAULT 5060,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Execution history (optional)
CREATE TABLE executions (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    status TEXT NOT NULL,  -- running, completed, failed
    started_at DATETIME,
    completed_at DATETIME,
    error TEXT,
    FOREIGN KEY (flow_id) REFERENCES flows(id)
);
```

**Diago Integration:**

```go
type DiagoSIPEngine struct {
    client *diago.Client
}

func (d *DiagoSIPEngine) CreateUA(cfg UAConfig) (*diago.DialogUA, error) {
    ua, err := diago.NewUA(diago.WithUserAgent(cfg.Username),
                            diago.WithTransport(cfg.Transport))
    if err != nil {
        return nil, err
    }

    // Register with SIP server
    err = ua.Register(cfg.URI, diago.RegisterOptions{
        Expires: 3600,
    })

    return ua, err
}

func (d *DiagoSIPEngine) MakeCall(ua *diago.DialogUA, target string) (*diago.DialogSession, error) {
    session, err := ua.Invite(target, diago.InviteOptions{
        // SDP, headers, etc.
    })
    return session, err
}

func (d *DiagoSIPEngine) Hold(session *diago.DialogSession) error {
    // Send re-INVITE with inactive media
    return session.Hold()
}

// Similar methods for Retrieve, Transfer, Bye, etc.
```

## Data Flow

### Flow Creation/Edit Flow

```
User creates node on canvas
    ↓
React: useNodesState updates local state
    ↓
User clicks "Save"
    ↓
Frontend: FlowService.CreateFlow(name, nodes, edges)
    ↓
Wails Binding: FlowService.CreateFlow()
    ↓
Application: FlowManager.Create()
    ↓
Domain: Flow.ValidateDAG()
    ↓
Infrastructure: Repository.SaveFlow()
    ↓
SQLite: INSERT INTO flows
    ↓
Response bubbles back to frontend
    ↓
React: Update flow list, show success toast
```

### Simulation Execution Flow

```
User clicks "Start Simulation"
    ↓
Frontend: SimulationService.StartSimulation(flowID)
    ↓
Wails Binding: SimulationService.StartSimulation()
    ↓
Application: ExecutionEngine.Execute(flow)
    ↓
    ┌─ Infrastructure: Load flow from SQLite
    ├─ Domain: Flow.BuildExecutionPlan() [topological sort]
    ├─ Infrastructure: Create diago UAs for SIP Instance nodes
    └─ For each execution step:
        ├─ Infrastructure: DiagoSIPEngine.ExecuteCommand()
        ├─ Wails: runtime.EventsEmit("simulation:progress", nodeID, status)
        └─ Frontend: Event listener → update xyflow node style (highlight)
            ↓
User sees animated execution on canvas in real-time
```

### Event Handling (Frontend ← Backend)

```
Backend (Execution Engine)
    ↓
runtime.EventsEmit(ctx, "simulation:progress", payload)
    ↓
Wails Runtime bridges Go → JavaScript
    ↓
Frontend: runtime.EventsOn("simulation:progress", (data) => {...})
    ↓
React: Update node state (e.g., className for CSS animation)
    ↓
xyflow re-renders with highlighted/animated node
```

## Wails-Specific Patterns

### Application Lifecycle

```go
// main.go
func main() {
    app := NewApp()
    flowSvc := services.NewFlowService()
    simSvc := services.NewSimulationService()

    err := wails.Run(&options.App{
        Title:  "SIPFlow",
        Width:  1280,
        Height: 768,
        OnStartup: func(ctx context.Context) {
            app.Startup(ctx)
            flowSvc.Startup(ctx)
            simSvc.Startup(ctx)
        },
        OnShutdown: func(ctx context.Context) {
            simSvc.Shutdown(ctx)
            flowSvc.Shutdown(ctx)
            app.Shutdown(ctx)
        },
        Bind: []interface{}{
            flowSvc,
            simSvc,
        },
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

### Event-Driven Communication

**Go (Backend) → JavaScript (Frontend):**

```go
// Emit events from Go
runtime.EventsEmit(ctx, "event-name", data)

// Example: simulation progress
runtime.EventsEmit(ctx, "simulation:progress", map[string]interface{}{
    "nodeID": "node-123",
    "status": "executing",
    "timestamp": time.Now().Unix(),
})
```

```typescript
// Listen in React
import { EventsOn } from '../../wailsjs/runtime/runtime';

useEffect(() => {
  const unsubscribe = EventsOn('simulation:progress', (data) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === data.nodeID
          ? { ...node, data: { ...node.data, status: data.status } }
          : node
      )
    );
  });

  return () => unsubscribe();
}, []);
```

**JavaScript (Frontend) → Go (Backend):**

```typescript
// Call Go methods from TypeScript
import { CreateFlow } from '../../wailsjs/go/services/FlowService';

const handleSave = async () => {
  try {
    const flow = await CreateFlow(name, nodes, edges);
    console.log('Flow created:', flow);
  } catch (error) {
    console.error('Failed to create flow:', error);
  }
};
```

### Context Propagation for Cancellation

```go
type SimulationService struct {
    ctx       context.Context
    cancelFn  context.CancelFunc
}

func (s *SimulationService) StartSimulation(flowID string) error {
    // Create cancellable context for this simulation
    ctx, cancel := context.WithCancel(s.ctx)
    s.cancelFn = cancel

    go func() {
        err := s.engine.Execute(ctx, flowID)
        if err != nil {
            runtime.EventsEmit(s.ctx, "simulation:error", err.Error())
        }
    }()

    return nil
}

func (s *SimulationService) StopSimulation() error {
    if s.cancelFn != nil {
        s.cancelFn()  // Cancels all goroutines listening on ctx.Done()
    }
    return nil
}
```

## Build Order and Dependencies

Suggested component implementation order based on dependencies:

### Phase 1: Foundation (No dependencies)
1. **Domain models** (Flow, Node, Edge, UAConfig)
2. **SQLite repository** (schema + CRUD)
3. **Wails app skeleton** (main.go, basic bindings)

### Phase 2: Core Features (Depends on Phase 1)
4. **Frontend xyflow canvas** (basic node rendering, no backend yet)
5. **FlowService bindings** (CRUD operations)
6. **Flow persistence** (connect frontend ↔ SQLite via FlowService)

### Phase 3: SIP Integration (Depends on Phase 2)
7. **Diago SIP engine wrapper** (createUA, basic commands)
8. **Execution engine** (topological sort, command dispatch)
9. **SimulationService bindings** (start/stop execution)

### Phase 4: Real-time Execution (Depends on Phase 3)
10. **Wails event system** (backend → frontend progress events)
11. **Simulation visualizer** (animate executing nodes on canvas)

### Phase 5: Advanced Features (Depends on Phase 4)
12. **Embedded SIP server** (optional, for standalone testing)
13. **External SIP server config** (UI + validation)

## Flow Execution Engine Design

### Execution Plan Structure

The execution engine transforms a visual flow graph into a sequential execution plan:

```go
type ExecutionPlan struct {
    FlowID        string
    SIPInstances  []SIPInstanceStep  // UAs to create before execution
    Steps         []ExecutionStep    // Topologically sorted steps
}

type SIPInstanceStep struct {
    NodeID  string
    UAConfig UAConfig
}

type ExecutionStep struct {
    NodeID  string
    Type    NodeType  // Command or Event
    Config  map[string]interface{}
    Dependencies []string  // Node IDs that must complete first
}
```

### Execution State Machine

```
IDLE → INITIALIZING → RUNNING → COMPLETED
                  ↓       ↓
                 FAILED  PAUSED
```

### Execution Algorithm

```
1. Load flow from repository
2. Validate DAG (no cycles)
3. Build execution plan (topological sort):
   a. Identify all SIP Instance nodes
   b. Identify all Command/Event nodes
   c. Sort by dependencies (Kahn's algorithm)
4. Initialize SIP UAs (diago):
   - For each SIP Instance node, create UA
   - Store in registry (map[nodeID]*diago.DialogUA)
5. Execute steps sequentially:
   - For Command nodes:
     * Resolve UA from registry
     * Execute diago command (MakeCall, Hold, etc.)
     * Emit progress event
   - For Event nodes:
     * Listen for SIP event on UA
     * Block until event received or timeout
     * Emit progress event
6. Cleanup:
   - Destroy all UAs
   - Emit completion event
```

### Concurrency Considerations

- **Single-threaded execution:** Execute steps sequentially for v1 simplicity
- **Event waiting:** Use context with timeout for Event nodes to prevent hanging
- **Cancellation:** Propagate context.Context through execution chain for user-triggered stop
- **Future:** Parallel execution for independent branches (requires dependency graph analysis)

## Patterns to Follow

### Pattern 1: Repository Pattern for Data Access

**What:** Abstract SQLite behind a repository interface

**When:** All data access (flows, UAs, configs)

**Example:**
```go
type FlowRepository interface {
    Create(flow *Flow) error
    Update(flow *Flow) error
    Delete(id string) error
    GetByID(id string) (*Flow, error)
    List() ([]*Flow, error)
}

type SQLiteFlowRepository struct {
    db *sql.DB
}

func (r *SQLiteFlowRepository) Create(flow *Flow) error {
    graphJSON, _ := json.Marshal(map[string]interface{}{
        "nodes": flow.Nodes,
        "edges": flow.Edges,
    })

    _, err := r.db.Exec(
        "INSERT INTO flows (id, name, graph_json) VALUES (?, ?, ?)",
        flow.ID, flow.Name, graphJSON,
    )
    return err
}
```

**Why:** Testability (mock repository), future DB migration flexibility

### Pattern 2: Event Bus for Decoupled Communication

**What:** Central event bus for backend components to publish/subscribe

**When:** SIP events, execution progress, UA lifecycle events

**Example:**
```go
type EventBus struct {
    subscribers map[string][]chan Event
    mu          sync.RWMutex
}

func (e *EventBus) Subscribe(topic string) <-chan Event {
    ch := make(chan Event)
    e.mu.Lock()
    e.subscribers[topic] = append(e.subscribers[topic], ch)
    e.mu.Unlock()
    return ch
}

func (e *EventBus) Publish(topic string, event Event) {
    e.mu.RLock()
    defer e.mu.RUnlock()

    for _, ch := range e.subscribers[topic] {
        select {
        case ch <- event:
        default:  // Non-blocking
        }
    }
}
```

**Why:** Decouple execution engine from Wails event emission, easier testing

### Pattern 3: Clean Architecture Layer Separation

**What:** Enforce dependency direction (outer → inner, never inner → outer)

**When:** All components

**Structure:**
```
internal/
├── domain/          # Pure business logic, no external deps
│   ├── flow.go
│   ├── node.go
│   └── ua.go
├── application/     # Use cases, orchestration
│   ├── flow_manager.go
│   └── execution_engine.go
├── infrastructure/  # External systems
│   ├── sqlite/
│   │   └── repository.go
│   └── sip/
│       └── diago_engine.go
└── interfaces/      # Wails bindings (adapters)
    ├── flow_service.go
    └── simulation_service.go
```

**Why:** Testability, maintainability, clear boundaries

### Pattern 4: Context-Based Cancellation

**What:** Use context.Context for goroutine lifecycle management

**When:** Long-running operations (simulation, SIP calls)

**Example:**
```go
func (e *ExecutionEngine) Execute(ctx context.Context, flowID string) error {
    for _, step := range plan.Steps {
        select {
        case <-ctx.Done():
            return ctx.Err()  // Cancelled
        default:
            err := e.executeStep(ctx, step)
            if err != nil {
                return err
            }
        }
    }
    return nil
}
```

**Why:** Graceful shutdown, user-triggered cancellation, timeout support

### Pattern 5: xyflow Custom Nodes with TypeScript

**What:** Define custom node components for SIP/Command/Event types

**When:** All xyflow node rendering

**Example:**
```typescript
// SIPInstanceNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';

interface SIPInstanceData {
  uri: string;
  username: string;
  status?: 'idle' | 'executing' | 'completed';
}

export function SIPInstanceNode({ data }: NodeProps<SIPInstanceData>) {
  return (
    <div className={`sip-node ${data.status || 'idle'}`}>
      <div className="node-header">SIP Instance</div>
      <div className="node-body">
        <div>URI: {data.uri}</div>
        <div>User: {data.username}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Register in ReactFlow
const nodeTypes = {
  sipInstance: SIPInstanceNode,
  command: CommandNode,
  event: EventNode,
};

<ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} />
```

**Why:** Type safety, reusable components, clear visual distinction

## Anti-Patterns to Avoid

### Anti-Pattern 1: Circular Dependencies Between Layers

**What goes wrong:** Infrastructure layer imports application layer, creating circular dependency

**Why bad:** Breaks clean architecture, prevents compilation, makes testing impossible

**Instead:** Always maintain one-directional dependencies (outer → inner). Use interfaces for inversion of control.

```go
// BAD: infrastructure importing application
package sqlite

import "sipflow/internal/application"

type Repository struct {
    engine *application.ExecutionEngine  // WRONG
}

// GOOD: application defines interface, infrastructure implements
package application

type FlowRepository interface {
    GetByID(id string) (*domain.Flow, error)
}

package sqlite

type Repository struct {
    db *sql.DB
}

func (r *Repository) GetByID(id string) (*domain.Flow, error) {
    // implements application.FlowRepository
}
```

### Anti-Pattern 2: Business Logic in Wails Bindings

**What goes wrong:** FlowService contains validation, execution logic directly

**Why bad:** Untestable (requires Wails context), violates SRP, tight coupling

**Instead:** Bindings should be thin adapters that delegate to application layer

```go
// BAD: business logic in binding
func (f *FlowService) CreateFlow(name string, nodes []Node) error {
    // Validation logic here
    if len(nodes) == 0 {
        return errors.New("no nodes")
    }

    // DAG validation here
    // ... complex graph algorithm ...

    // Persistence here
    f.db.Exec("INSERT INTO flows...")
}

// GOOD: binding delegates to application layer
func (f *FlowService) CreateFlow(name string, nodes []Node) error {
    flow, err := f.flowManager.Create(name, nodes)  // Delegate
    if err != nil {
        return err
    }
    return nil
}
```

### Anti-Pattern 3: Blocking Wails Bindings

**What goes wrong:** Exposed method runs long operation synchronously

**Why bad:** Freezes UI (Wails bindings block JavaScript), poor UX

**Instead:** Start goroutine for long operations, use events for progress updates

```go
// BAD: blocking call
func (s *SimulationService) StartSimulation(flowID string) error {
    return s.engine.Execute(flowID)  // Blocks for entire execution
}

// GOOD: async with progress events
func (s *SimulationService) StartSimulation(flowID string) error {
    go func() {
        err := s.engine.Execute(s.ctx, flowID)
        if err != nil {
            runtime.EventsEmit(s.ctx, "simulation:error", err)
        } else {
            runtime.EventsEmit(s.ctx, "simulation:completed", flowID)
        }
    }()

    runtime.EventsEmit(s.ctx, "simulation:started", flowID)
    return nil
}
```

### Anti-Pattern 4: Storing xyflow State Only in Component

**What goes wrong:** Flow state lives only in `useNodesState`, no persistence trigger

**Why bad:** Lose work on refresh, no save/load functionality

**Instead:** Treat xyflow state as ephemeral, persist to backend on user action

```typescript
// BAD: no persistence
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

// User edits... but no save mechanism

// GOOD: explicit save with backend sync
const handleSave = async () => {
  const flow = await FlowService.CreateFlow(flowName, nodes, edges);
  setCurrentFlowID(flow.id);
};

const handleLoad = async (flowID: string) => {
  const flow = await FlowService.GetFlow(flowID);
  setNodes(flow.nodes);
  setEdges(flow.edges);
};
```

### Anti-Pattern 5: Ignoring Context Cancellation

**What goes wrong:** Goroutines ignore `ctx.Done()`, continue running after stop

**Why bad:** Resource leaks, stuck operations, unpredictable behavior

**Instead:** Always check context in loops and before blocking operations

```go
// BAD: no cancellation check
func (e *ExecutionEngine) Execute(ctx context.Context, flowID string) error {
    for _, step := range plan.Steps {
        // Ignores ctx, can't be stopped
        e.executeStep(step)
    }
    return nil
}

// GOOD: respects cancellation
func (e *ExecutionEngine) Execute(ctx context.Context, flowID string) error {
    for _, step := range plan.Steps {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
            if err := e.executeStepWithContext(ctx, step); err != nil {
                return err
            }
        }
    }
    return nil
}
```

## Scalability Considerations

| Concern | At 10 flows | At 100 flows | At 1000 flows |
|---------|-------------|--------------|---------------|
| **Storage** | SQLite in-memory OK | SQLite file-based | SQLite with indexes, pagination |
| **Execution** | Single-threaded sequential | Same (SIP is inherently sequential) | Consider parallel branch execution |
| **UI Performance** | Render all nodes | Virtualization not needed | xyflow viewport culling (built-in) |
| **Event Throughput** | Direct EventsEmit OK | Same (desktop app, local) | Batch events every 100ms |

## Key Architectural Decisions

### Decision: Topological Sort for Execution Plan

**Rationale:** Flow graph is a DAG (directed acyclic graph). Topological sort guarantees execution order respects dependencies.

**Algorithm:** Kahn's algorithm (BFS-based, O(V+E) complexity)

**Alternative considered:** DFS-based topological sort (similar complexity, but Kahn's is more intuitive for dependency resolution)

### Decision: Event-Driven Frontend Updates

**Rationale:** Simulation runs in background goroutine. Cannot block Wails binding. Need real-time UI updates.

**Pattern:** Wails EventsEmit from Go → EventsOn listener in React → update xyflow node state

**Alternative considered:** Polling from frontend (wasteful, higher latency)

### Decision: SQLite for Persistence

**Rationale:** Desktop app, single user, embedded database eliminates server dependency

**Schema:** JSON blob for graph (nodes/edges) allows flexible schema evolution

**Alternative considered:** Separate tables for nodes/edges (normalized, but overkill for v1)

### Decision: Clean Architecture with 4 Layers

**Rationale:** Enforce separation of concerns, testability, maintainability

**Layers:** Domain (pure), Application (orchestration), Infrastructure (external), Interfaces (Wails bindings)

**Alternative considered:** Simple 2-layer (frontend/backend) - too coupled, hard to test

## Sources

**Wails v2 Architecture:**
- [Application Development | Wails](https://wails.io/docs/guides/application-development/)
- [Best practice: How to structure a complex app? · wailsapp/wails · Discussion #909](https://github.com/wailsapp/wails/discussions/909)
- [How does it work? | Wails](https://wails.io/docs/howdoesitwork/)

**React Flow (xyflow) Architecture:**
- [Custom Nodes - React Flow](https://reactflow.dev/learn/customization/custom-nodes)
- [Using a State Management Library - React Flow](https://reactflow.dev/learn/advanced-use/state-management)
- [Node-Based UIs in React - React Flow](https://reactflow.dev)

**Diago SIP Library:**
- [GitHub - emiago/diago: Short of Dialog + GO. Library for building VOIP solutions in GO](https://github.com/emiago/diago)
- [diago package - github.com/emiago/diago - Go Packages](https://pkg.go.dev/github.com/emiago/diago)
- [Diago](https://emiago.github.io/diago/)

**Workflow Engine Architecture:**
- [Workflow Engine Design Principles with Temporal | Temporal](https://temporal.io/blog/workflow-engine-principles)
- [Workflow Engine vs. State Machine](https://workflowengine.io/blog/workflow-engine-vs-state-machine/)
- [Topological Sorting Explained: A Step-by-Step Guide for Dependency Resolution | by Amit Kumar | Medium](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065)

**Clean Architecture in Go:**
- [Clean Architecture in Go (Golang): A Comprehensive Guide | by Omid A. | Medium](https://medium.com/@omidahn/clean-architecture-in-go-golang-a-comprehensive-guide-f8e422b7bfae)
- [How to implement Clean Architecture in Go (Golang) | Three Dots Labs blog](https://threedots.tech/post/introducing-clean-architecture/)

**Event-Driven Architecture:**
- [Event-Driven Architecture (EDA): A Complete Introduction](https://www.confluent.io/learn/event-driven-architecture/)
- [Event-Driven Architecture Style - Azure Architecture Center | Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)

**Go Context Pattern:**
- [context package - context - Go Packages](https://pkg.go.dev/context)
- [Mastering Go Contexts: A Deep Dive Into Cancellation, Timeouts, and Request-Scoped Values | by Harshith Gowda | Medium](https://medium.com/@harshithgowdakt/mastering-go-contexts-a-deep-dive-into-cancellation-timeouts-and-request-scoped-values-392122ad0a47)

**SQLite Architecture:**
- [Architecture of SQLite](https://sqlite.org/arch.html)
- [Deep Dive into SQLite's Internal Architecture - DEV Community](https://dev.to/lovestaco/deep-dive-into-sqlites-internal-architecture-2fjl)
