# Phase 3: Flow Persistence - Research

**Researched:** 2026-02-02
**Domain:** Project-based file persistence with SQLite, Wails runtime dialogs, xyflow state serialization
**Confidence:** HIGH

## Summary

Phase 3 implements project-based file persistence where each .sipflow file is an independent SQLite database containing multiple flows. This differs from the existing Phase 1 single-app database pattern and requires runtime database switching, Wails file dialogs for native File > Open/Save operations, and xyflow state serialization.

The standard approach uses SQLite's "Application File Format" pattern - each project is a standalone .db file that users can share, copy, and version control. Wails v2 provides runtime.OpenFileDialog and runtime.SaveFileDialog for native file pickers. React Flow's toObject() method serializes the complete canvas state (nodes, edges, viewport) to JSON, which maps cleanly to ent schema fields.

Key architecture decision: The app transitions from a single persistent database to a "currently open project" model. The ent client must be closed and reopened when switching project files. Dirty state tracking in Zustand prevents data loss on unsaved changes.

**Primary recommendation:** Use runtime database switching with ent client lifecycle management, implement dirty state tracking with Zustand subscriptions, and use Wails menu system for native File operations with keyboard shortcuts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| modernc.org/sqlite | Current (2026-01-20) | Pure Go SQLite driver | Already chosen in Phase 1, supports runtime file switching with sql.Open() |
| Wails v2 runtime | v2 | Native file dialogs and menus | Desktop app framework, provides OpenFileDialog/SaveFileDialog/Menu APIs |
| @xyflow/react | Current | Canvas state management | Already in use, provides toObject() for serialization |
| ent | Current | ORM with transaction support | Already in use, supports transactional saves with WithTx pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand subscriptions | Built-in | Dirty state tracking | Subscribe to store changes to detect modifications since last save |
| Wails runtime.EventsOn | v2 | Frontend-backend coordination | Handle file operations initiated from native menus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-project DB files | Single DB with project table | User decision locked: project = file for sharing/copying |
| Wails file dialogs | Custom web-based file picker | Wails native dialogs provide platform-native UX |
| Manual dirty tracking | Auto-save on change | User decision locked: manual Ctrl+S for explicit control |

**Installation:**
```bash
# No new dependencies - using existing stack
# Wails runtime and ent already installed in Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
internal/
├── handler/
│   ├── flow_service.go        # Existing - add save/load methods
│   ├── project_service.go     # NEW - manages project file lifecycle
│   └── event_emitter.go       # Existing - may need File menu events
ent/
└── schema/
    ├── flow.go                # Existing - already has name, nodes, edges
    ├── node.go                # Existing - already has type, data, position
    └── edge.go                # Existing - already has handles, nodes
frontend/src/
├── stores/
│   ├── flowStore.ts           # Existing - add dirty state tracking
│   └── projectStore.ts        # NEW - current project file, dirty flag
└── components/
    └── FlowList.tsx           # NEW - sidebar flow list
```

### Pattern 1: Runtime Database Switching
**What:** Close current ent client, open new database file, recreate ent client
**When to use:** When user opens different project file or creates new project
**Example:**
```go
// Source: modernc.org/sqlite package pattern + ent lifecycle
type ProjectService struct {
    currentClient *ent.Client
    currentPath   string
}

func (s *ProjectService) OpenProject(ctx context.Context, filePath string) error {
    // Close existing client
    if s.currentClient != nil {
        s.currentClient.Close()
    }

    // Open new database file
    drv, err := sqlite.OpenEntDriver(filePath)
    if err != nil {
        return err
    }

    // Create new ent client
    client := ent.NewClient(ent.Driver(drv))

    // Run migrations for new database
    if err := client.Schema.Create(ctx); err != nil {
        client.Close()
        return err
    }

    s.currentClient = client
    s.currentPath = filePath
    return nil
}
```

### Pattern 2: Wails File Dialog Integration
**What:** Use runtime.SaveFileDialog and runtime.OpenFileDialog with .sipflow filter
**When to use:** File > Open, File > Save As menu operations
**Example:**
```go
// Source: https://wails.io/docs/reference/runtime/dialog/
// From GitHub wails/v2/pkg/runtime/dialog.go
func (a *App) OpenProjectDialog() (string, error) {
    return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
        Title: "Open SIPFlow Project",
        Filters: []runtime.FileFilter{
            {
                DisplayName: "SIPFlow Project (*.sipflow)",
                Pattern:     "*.sipflow",
            },
        },
    })
}

func (a *App) SaveProjectDialog() (string, error) {
    return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        Title:           "Save SIPFlow Project",
        DefaultFilename: "Untitled.sipflow",
        Filters: []runtime.FileFilter{
            {
                DisplayName: "SIPFlow Project (*.sipflow)",
                Pattern:     "*.sipflow",
            },
        },
    })
}
```

### Pattern 3: Wails Native Menu with Keyboard Shortcuts
**What:** Define application menu with File > Open/Save/Save As items
**When to use:** App startup menu initialization
**Example:**
```go
// Source: https://wails.io/docs/next/reference/menus/
// Pattern from Wails v2 menu documentation
import "github.com/wailsapp/wails/v2/pkg/menu"
import "github.com/wailsapp/wails/v2/pkg/menu/keys"

func (a *App) createMenu() *menu.Menu {
    AppMenu := menu.NewMenu()
    FileMenu := AppMenu.AddSubmenu("File")

    FileMenu.AddText("&Open Project", keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
        // Trigger open dialog + load
    })

    FileMenu.AddText("&Save", keys.CmdOrCtrl("s"), func(_ *menu.CallbackData) {
        // Save current project
    })

    FileMenu.AddText("Save &As", keys.CmdOrCtrl("shift+s"), func(_ *menu.CallbackData) {
        // Save as new file
    })

    return AppMenu
}
```

### Pattern 4: xyflow State Serialization
**What:** Use toObject() to capture nodes, edges, and viewport; serialize to JSON for SQLite storage
**When to use:** Save operation - converting canvas state to database records
**Example:**
```typescript
// Source: https://reactflow.dev/examples/interaction/save-and-restore
// ReactFlowJsonObject type from @xyflow/react
import { useReactFlow, type ReactFlowJsonObject } from '@xyflow/react'

const { toObject, setNodes, setEdges, setViewport } = useReactFlow()

// Serialize canvas state
function serializeFlow(): ReactFlowJsonObject {
    return toObject()
    // Returns: { nodes: Node[], edges: Edge[], viewport: { x, y, zoom } }
}

// Deserialize and restore
function restoreFlow(data: ReactFlowJsonObject) {
    const { nodes, edges, viewport } = data
    setNodes(nodes)
    setEdges(edges)
    setViewport(viewport)
}
```

### Pattern 5: Transactional Save with ent
**What:** Use ent WithTx pattern to save flow + all nodes + all edges atomically
**When to use:** Save operation to ensure all-or-nothing database writes
**Example:**
```go
// Source: https://entgo.io/docs/transactions/
// ent transaction pattern with defer rollback
func (s *FlowService) SaveFlow(ctx context.Context, flowID int, nodesJSON, edgesJSON string) error {
    tx, err := s.entClient.Tx(ctx)
    if err != nil {
        return err
    }
    defer func() {
        if v := recover(); v != nil {
            tx.Rollback()
            panic(v)
        }
    }()

    // Update flow timestamp
    if err := tx.Flow.UpdateOneID(flowID).
        SetUpdatedAt(time.Now()).
        Exec(ctx); err != nil {
        tx.Rollback()
        return err
    }

    // Delete existing nodes/edges
    if _, err := tx.Node.Delete().
        Where(node.HasFlowWith(flow.ID(flowID))).
        Exec(ctx); err != nil {
        tx.Rollback()
        return err
    }

    // Create new nodes/edges from JSON
    // ... bulk create operations ...

    return tx.Commit()
}
```

### Pattern 6: Dirty State Tracking with Zustand
**What:** Subscribe to flowStore changes to set dirty flag; clear on save
**When to use:** Detect unsaved changes for "unsaved indicator" and "prevent close" dialog
**Example:**
```typescript
// Source: Zustand patterns + desktop app dirty state practices
import { create } from 'zustand'

interface ProjectState {
    isDirty: boolean
    currentProjectPath: string | null
    actions: {
        markDirty: () => void
        markClean: () => void
        setProjectPath: (path: string | null) => void
    }
}

export const useProjectStore = create<ProjectState>((set) => ({
    isDirty: false,
    currentProjectPath: null,
    actions: {
        markDirty: () => set({ isDirty: true }),
        markClean: () => set({ isDirty: false }),
        setProjectPath: (path) => set({ currentProjectPath: path }),
    },
}))

// Subscribe to flowStore changes to auto-mark dirty
useFlowStore.subscribe(
    (state) => state.nodes,
    () => useProjectStore.getState().actions.markDirty()
)
```

### Anti-Patterns to Avoid
- **Opening multiple databases simultaneously:** SQLite + ent client should manage ONE project at a time - close before opening new
- **Storing absolute paths in DB:** Project file should be relocatable - use relative references if needed
- **Auto-save without user control:** User decision locked on manual save (Ctrl+S) for explicit control
- **Forgetting to migrate schema on new project:** Every .sipflow file needs Schema.Create() on first open

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker UI | Custom React file browser | Wails runtime.OpenFileDialog | Native OS dialogs with platform conventions |
| Keyboard shortcut handling | Custom keydown listeners | Wails menu accelerators | Cross-platform (Cmd on Mac, Ctrl on Win) |
| Transaction rollback | Manual SQL with defer | ent WithTx pattern | Handles panic recovery, proper error wrapping |
| Canvas state serialization | Custom JSON mapping | xyflow toObject() | Handles internal state, viewport, edge handles |
| Dirty state tracking | Manual comparison | Zustand subscriptions | Efficient, doesn't re-render unnecessarily |

**Key insight:** Desktop app file operations (open, save, keyboard shortcuts) are platform-specific and deeply integrated. Wails runtime provides tested abstractions. Similarly, xyflow's internal state representation is complex - toObject() captures everything needed for perfect restoration.

## Common Pitfalls

### Pitfall 1: Database Locked Errors on Project Switch
**What goes wrong:** Opening new database while old connection still active causes SQLITE_BUSY
**Why it happens:** Forgetting to close previous ent client before opening new project file
**How to avoid:** Always close current client before opening new database:
```go
if s.currentClient != nil {
    s.currentClient.Close()  // MUST close before opening new
}
drv, err := sqlite.OpenEntDriver(newProjectPath)
```
**Warning signs:** "database is locked" errors when switching projects, WAL files persisting

### Pitfall 2: Lost Viewport State on Restore
**What goes wrong:** Nodes/edges restore correctly but zoom/pan resets to default
**Why it happens:** Only saving nodes/edges, forgetting viewport from toObject()
**How to avoid:** toObject() returns viewport - save it and restore with setViewport()
```typescript
const flowData = toObject()  // Contains { nodes, edges, viewport }
// Save viewport.x, viewport.y, viewport.zoom to DB
// On restore:
setViewport(savedViewport)  // Don't forget this!
```
**Warning signs:** User complains canvas "jumps" or "resets zoom" on load

### Pitfall 3: Schema Migration Skipped on New Project
**What goes wrong:** Creating new .sipflow file without running migrations causes "no such table" errors
**Why it happens:** Only running Schema.Create() in app startup, not when creating new project
**How to avoid:** Run Schema.Create() after opening ANY database file:
```go
client := ent.NewClient(ent.Driver(drv))
if err := client.Schema.Create(ctx); err != nil {  // Always migrate
    return err
}
```
**Warning signs:** New projects fail immediately with SQL errors, existing projects work fine

### Pitfall 4: Dirty Flag Not Cleared After Save
**What goes wrong:** Unsaved indicator (*) persists even after successful save
**Why it happens:** Forgetting to call markClean() in save success handler
**How to avoid:** Save operation must explicitly clear dirty state:
```typescript
async function saveProject() {
    const success = await SaveFlowToBackend()
    if (success) {
        projectStore.actions.markClean()  // MUST clear dirty flag
    }
}
```
**Warning signs:** Users report * stays visible, "are you sure" dialogs appear incorrectly

### Pitfall 5: Missing Transactional Integrity on Save
**What goes wrong:** Partial saves (flow updated but nodes missing) after errors
**Why it happens:** Not using transactions - each operation commits independently
**How to avoid:** Wrap entire save operation in ent transaction:
```go
tx, err := client.Tx(ctx)
// All operations use tx, not client
// Either all succeed (Commit) or all fail (Rollback)
```
**Warning signs:** Corrupted flows after save errors, inconsistent node counts

### Pitfall 6: Forgetting Cross-Platform Path Separators
**What goes wrong:** File paths fail on Windows (uses \) vs Unix (uses /)
**Why it happens:** Hardcoding "/" in path strings
**How to avoid:** Use filepath.Join() for all path construction:
```go
dbPath := filepath.Join(configDir, "project.sipflow")  // Cross-platform
```
**Warning signs:** Works on Mac/Linux, fails on Windows

## Code Examples

Verified patterns from official sources:

### Complete Save Flow Operation
```go
// Source: ent transactions + xyflow serialization pattern
func (s *ProjectService) SaveCurrentProject(ctx context.Context, flowData ReactFlowData) error {
    if s.currentPath == "" {
        return errors.New("no project open")
    }

    tx, err := s.currentClient.Tx(ctx)
    if err != nil {
        return err
    }
    defer func() {
        if v := recover(); v != nil {
            tx.Rollback()
            panic(v)
        }
    }()

    // Clear existing nodes/edges for this flow
    flowID := flowData.FlowID
    tx.Node.Delete().Where(node.HasFlowWith(flow.ID(flowID))).Exec(ctx)
    tx.Edge.Delete().Where(edge.HasFlowWith(flow.ID(flowID))).Exec(ctx)

    // Bulk create nodes
    bulk := make([]*ent.NodeCreate, len(flowData.Nodes))
    for i, n := range flowData.Nodes {
        bulk[i] = tx.Node.Create().
            SetType(n.Type).
            SetData(n.Data).
            SetPositionX(n.Position.X).
            SetPositionY(n.Position.Y).
            SetFlowID(flowID)
    }
    createdNodes, err := tx.Node.CreateBulk(bulk...).Save(ctx)
    if err != nil {
        tx.Rollback()
        return err
    }

    // Create edges (similar bulk pattern)
    // ...

    // Update flow timestamp
    tx.Flow.UpdateOneID(flowID).SetUpdatedAt(time.Now()).Exec(ctx)

    return tx.Commit()
}
```

### Complete Load Flow Operation
```typescript
// Source: React Flow save/restore example + Zustand pattern
async function loadFlow(flowID: number) {
    const response = await GetFlow(flowID)
    if (!response.success) {
        console.error('Failed to load flow:', response.error)
        return
    }

    const flow = response.data
    const { setNodes, setEdges, setViewport } = useReactFlow.getState()

    // Convert ent entities to xyflow format
    const nodes: Node[] = flow.nodes.map(n => ({
        id: String(n.id),
        type: n.type,
        position: { x: n.position_x, y: n.position_y },
        data: n.data,
    }))

    const edges: Edge[] = flow.edges.map(e => ({
        id: String(e.id),
        source: String(e.source_node_id),
        target: String(e.target_node_id),
        sourceHandle: e.source_handle,
        targetHandle: e.target_handle,
        type: 'flowEdge',
    }))

    // Restore canvas state
    setNodes(nodes)
    setEdges(edges)

    // If viewport was saved, restore it
    if (flow.viewport) {
        setViewport(flow.viewport)
    }

    // Clear dirty flag after successful load
    useProjectStore.getState().actions.markClean()
}
```

### Dirty State Detection Setup
```typescript
// Source: Zustand subscription pattern for dirty tracking
// Set up in app initialization
useEffect(() => {
    // Subscribe to nodes changes
    const unsubNodes = useFlowStore.subscribe(
        (state) => state.nodes,
        () => {
            if (useProjectStore.getState().currentProjectPath) {
                useProjectStore.getState().actions.markDirty()
            }
        },
        { fireImmediately: false }
    )

    // Subscribe to edges changes
    const unsubEdges = useFlowStore.subscribe(
        (state) => state.edges,
        () => {
            if (useProjectStore.getState().currentProjectPath) {
                useProjectStore.getState().actions.markDirty()
            }
        },
        { fireImmediately: false }
    )

    return () => {
        unsubNodes()
        unsubEdges()
    }
}, [])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single app-wide database | Per-project database files | Always been pattern choice | Each project is independent, shareable file |
| Manual file path input | Native OS file dialogs | Wails v2 API available | Platform-native UX, better file type filtering |
| Custom JSON serialization | xyflow toObject() | React Flow v11+ | Complete state capture including viewport |
| Global dirty flag | Zustand subscriptions | Zustand v4+ | Granular change detection, efficient re-renders |

**Deprecated/outdated:**
- Wails v1 menu system: v2 uses different menu API structure
- React Flow v9 save pattern: v11+ renamed to @xyflow/react, toObject() is canonical

## Open Questions

Things that couldn't be fully resolved:

1. **Viewport persistence scope**
   - What we know: toObject() includes viewport (x, y, zoom)
   - What's unclear: Should viewport be per-flow or per-project? User context says "Claude's discretion"
   - Recommendation: Save viewport per-flow (each flow remembers its own zoom/pan) - more intuitive when switching between flows

2. **Dirty state granularity**
   - What we know: Can track nodes/edges changes with Zustand subscriptions
   - What's unclear: Should dirty state be per-flow or per-project?
   - Recommendation: Per-project (any flow modified = project dirty) - simpler UX, matches "Save Project" concept

3. **Database file corruption recovery**
   - What we know: SQLite WAL mode provides crash recovery
   - What's unclear: Should app validate .sipflow file integrity on open?
   - Recommendation: Trust SQLite integrity checks initially, add validation if users report corruption issues (YAGNI)

4. **Multiple flows in project - active flow tracking**
   - What we know: Project = N flows, sidebar switches between them
   - What's unclear: How to track "current active flow" for save operations
   - Recommendation: Add currentFlowId to projectStore, save operation updates only active flow

## Sources

### Primary (HIGH confidence)
- SQLite official documentation - https://sqlite.org/appfileformat.html (Application File Format pattern)
- SQLite WAL mode - https://sqlite.org/wal.html (Concurrency and locking)
- modernc.org/sqlite package - https://pkg.go.dev/modernc.org/sqlite (Published 2026-01-20)
- ent transactions documentation - https://entgo.io/docs/transactions/ (WithTx pattern)
- Wails runtime dialogs (from GitHub source) - wails/v2/pkg/runtime/dialog.go
- Wails menu documentation - https://wails.io/docs/next/reference/menus/
- React Flow save/restore - https://reactflow.dev/examples/interaction/save-and-restore
- React Flow ReactFlowJsonObject - https://reactflow.dev/api-reference/types/react-flow-json-object
- Zustand persist middleware - https://zustand.docs.pmnd.rs/middlewares/persist

### Secondary (MEDIUM confidence)
- Wails v2 file dialog patterns - WebSearch verified with GitHub source examples
- Desktop app keyboard shortcuts - Multiple sources confirm Ctrl+S standard pattern
- SQLite concurrent writes - https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/

### Tertiary (LOW confidence)
- Dirty state visual indicators - WebSearch found general patterns (red dot, asterisk) but no definitive standard
- Project file associations (.sipflow extension) - Standard OS behavior but Wails registration needs validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or official Wails APIs
- Architecture: HIGH - ent transactions, SQLite file switching, xyflow serialization all documented
- Pitfalls: HIGH - Database locking, schema migration, transaction integrity well-known SQLite issues

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable technologies)

**Key constraints from CONTEXT.md:**
- LOCKED: Manual save (Ctrl+S), Wails native menus, project=.sipflow file, no auto-restore on startup
- DISCRETION: Viewport save scope, dirty state display, data integrity handling
- DEFERRED: None
