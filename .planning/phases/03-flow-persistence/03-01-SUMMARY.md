---
phase: 03-flow-persistence
plan: 01
subsystem: database
tags: [ent, sqlite, wails, project-files, schema-migration]

# Dependency graph
requires:
  - phase: 02-visual-flow-designer
    provides: Flow, Node, Edge ent schemas and FlowService
provides:
  - Flow schema with viewport persistence (viewport_x, viewport_y, viewport_zoom)
  - Node schema with xyflow_id for frontend ID preservation
  - Edge schema with xyflow_id, type, and data for full state reconstruction
  - ProjectService with runtime SQLite database switching
  - Wails native File menu (New/Open/Save/Save As) with keyboard shortcuts
  - Per-project .sipflow file architecture (each project is an independent SQLite database)
affects: [03-flow-persistence, frontend-integration]

# Tech tracking
tech-stack:
  added: [Wails runtime dialogs, Wails native menu system]
  patterns: [Project-based database lifecycle, runtime DB switching, event-driven architecture]

key-files:
  created:
    - internal/handler/project_service.go
  modified:
    - ent/schema/flow.go
    - ent/schema/node.go
    - ent/schema/edge.go
    - app.go
    - main.go

key-decisions:
  - "Viewport persistence included as quality-of-life feature (restoring exact canvas position improves UX)"
  - "All project lifecycle events emitted from ProjectService (consistent pattern)"
  - "menu:save is the only event from main.go (requires frontend canvas state)"
  - "App starts with no database open - user must create/open a project"
  - "Close previous ent client before opening new one to prevent 'database is locked' errors"

patterns-established:
  - "ProjectService owns ent client lifecycle - single source of truth for DB state"
  - "Wails dialogs for native file selection (.sipflow filter)"
  - "Atomic project state transitions with event emission"
  - "Mutex protection for concurrent access to project state"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 03 Plan 01: Flow Persistence Infrastructure Summary

**Per-project .sipflow SQLite databases with runtime switching, complete ent schema updates for Phase 3, and native File menu with keyboard shortcuts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T04:44:37Z
- **Completed:** 2026-02-02T04:47:47Z
- **Tasks:** 2
- **Files modified:** 5 core files + ent generated files

## Accomplishments
- Consolidated all Phase 3 ent schema updates (Flow viewport, Node xyflow_id, Edge xyflow_id/type/data)
- ProjectService with runtime database switching for .sipflow project files
- Wails native File menu with New Project, Open Project, Save, Save As and keyboard shortcuts
- App now starts with no database open - project-based architecture established
- Project lifecycle event emission (project:created, project:opened, project:closed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ALL ent schemas and create ProjectService** - `b78bce3` (feat)
   - Flow schema: Added viewport_x, viewport_y, viewport_zoom for canvas state persistence
   - Node schema: Added xyflow_id to preserve frontend-generated IDs
   - Edge schema: Added xyflow_id, type, data for full xyflow state reconstruction
   - Created ProjectService with NewProject, OpenProject, CloseProject, SaveProjectAs
   - Wails dialogs for native .sipflow file selection
   - Event emission for project lifecycle
   - Regenerated ent code with all schema updates

2. **Task 2: Wire ProjectService into Wails app with native File menu** - `dae4b33` (feat)
   - Removed single-DB initialization from app.startup
   - App starts with no project open (empty state)
   - Added ProjectService to App struct and wired into NewApp
   - Native File menu with keyboard shortcuts (CmdOrCtrl+N/O/S/Shift+S)
   - Bound ProjectService to Wails for frontend access
   - menu:save event for Save (requires frontend canvas state)

## Files Created/Modified

### Created
- `internal/handler/project_service.go` - Runtime DB lifecycle management, Wails dialogs, project state

### Modified
- `ent/schema/flow.go` - Added viewport_x, viewport_y, viewport_zoom fields
- `ent/schema/node.go` - Added xyflow_id field for frontend ID preservation
- `ent/schema/edge.go` - Added xyflow_id, type, data fields for state reconstruction
- `app.go` - Removed single-DB init, wired ProjectService, empty state startup
- `main.go` - Added native File menu with keyboard shortcuts, bound ProjectService
- Generated ent files (24 files) - Updated based on schema changes

## Decisions Made

1. **Viewport persistence included** - CONTEXT.md listed this under "Claude's Discretion". Chose to persist viewport (zoom/pan) because restoring exact canvas position on reload significantly improves UX. Users expect to return to where they left off.

2. **Event emission pattern** - All project lifecycle events (project:created, project:opened, project:closed) emitted from ProjectService methods, NOT from main.go menu callbacks. This keeps emission consistent - ProjectService is single source of truth for project state transitions. Exception: menu:save emitted from main.go because Save requires frontend canvas state.

3. **Empty state startup** - App starts with NO database open. Removed single-DB initialization from app.startup. This enforces project-based architecture - users must create/open a project before working.

4. **Mutex protection** - ProjectService uses sync.Mutex to protect concurrent access to entClient and currentPath. Wails calls are single-threaded from frontend, but this prevents race conditions.

5. **Close-before-open pattern** - Always close previous ent client before opening new one to prevent "database is locked" SQLite errors. Implemented in openDatabase helper used by all project operations.

## Deviations from Plan

None - plan executed exactly as written.

All schema updates, ProjectService implementation, and Wails integration followed the plan specification. No auto-fixes needed.

## Issues Encountered

None - all Go code compiled successfully after schema updates and ProjectService integration.

## User Setup Required

None - no external service configuration required. This plan is pure backend infrastructure for project file management.

## Next Phase Readiness

**Ready for downstream plans:**
- All ent schemas updated with Phase 3 fields (viewport, xyflow_id, edge type/data)
- ProjectService provides runtime DB switching infrastructure
- Native File menu available for user interaction
- Event system in place for frontend integration

**Blockers/concerns:** None

**What's next:** Phase 03 Plans 02-04 will build on this infrastructure:
- 03-02: Backend handlers for saving/loading flow state
- 03-03: Frontend integration with ProjectService and xyflow state serialization
- 03-04: Save prompt on close and project state management

---
*Phase: 03-flow-persistence*
*Completed: 2026-02-02*
