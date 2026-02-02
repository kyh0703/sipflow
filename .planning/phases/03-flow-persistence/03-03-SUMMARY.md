---
phase: 03-flow-persistence
plan: 03
subsystem: frontend
tags: [react, zustand, wails-events, xyflow, persistence, dirty-tracking]

# Dependency graph
requires:
  - phase: 03-01
    provides: ProjectService with Wails native menu, ent schemas with viewport fields
  - phase: 03-02
    provides: SaveFlow, LoadFlow, ListFlows backend operations
provides:
  - Frontend project lifecycle management via Wails events
  - Flow list sidebar with create/delete/switch
  - Canvas save/load via useFlowPersistence hook
  - Dirty state tracking with title bar indicator
  - Viewport persistence on save/load
affects: [04-sip-infrastructure]

# Tech tracking
tech-stack:
  added: []
  patterns: [projectStore for project state, useFlowPersistence hook for save/load conversion, cross-store dirty tracking via getState()]

key-files:
  created:
    - frontend/src/stores/projectStore.ts
    - frontend/src/services/projectService.ts
    - frontend/src/hooks/useFlowPersistence.ts
  modified:
    - frontend/src/services/flowService.ts
    - frontend/src/components/flow/LeftSidebar.tsx
    - frontend/src/components/flow/FlowCanvas.tsx
    - frontend/src/stores/flowStore.ts
    - frontend/src/App.tsx
    - frontend/src/components/layout/Header.tsx

key-decisions:
  - "Viewport persistence included as quality-of-life feature"
  - "useFlowPersistence hook centralizes save/load conversion (must be inside ReactFlowProvider)"
  - "Cross-store dirty tracking via useProjectStore.getState().actions.markDirty()"
  - "Project lifecycle events (project:opened/created/closed) drive frontend state"

patterns-established:
  - "Wails event listeners in useEffect with EventsOff cleanup"
  - "useFlowPersistence hook for xyflow <-> backend format conversion"
  - "projectStore actions object pattern consistent with flowStore"

# Metrics
duration: ~5min
completed: 2026-02-02
---

# Phase 03 Plan 03: Frontend Integration Summary

**Project management, flow list sidebar, save/load wiring, dirty state tracking, and viewport persistence**

## Performance

- **Duration:** ~5 min (across multiple commits)
- **Completed:** 2026-02-02
- **Tasks:** 3 code tasks + 1 human verification
- **Files created:** 3
- **Files modified:** 6

## Accomplishments
- projectStore manages project path, flow list, current flow ID, and dirty state
- projectService wraps all ProjectService Wails bindings (newProject, openProject, closeProject, saveProjectAs)
- flowService updated with saveFlow, loadFlow, updateFlowName methods
- useFlowPersistence hook centralizes xyflow <-> backend format conversion for save/load/switch
- App.tsx listens for project lifecycle events (project:opened/created/closed) and menu:save
- LeftSidebar shows flow list above node palette with new/delete/switch functionality
- FlowCanvas captures viewport changes via onMoveEnd handler
- flowStore tracks viewport state and triggers markDirty on canvas changes
- Header shows project name, flow name, and dirty indicator (*)
- Human verification passed: full E2E flow persistence working on macOS

## Task Commits

1. **Task 1: Create projectStore, projectService, flowService updates, useFlowPersistence** - `63dfb1c` (feat)
2. **Task 2: Wire event listeners, save handler, and flow list sidebar** - `2cbebff` (feat)
3. **Task 3: Wire dirty state tracking, viewport persistence, and title bar** - `a0c4c5d` (feat)
4. **Fix: Wails binding type names and SaveFlowRequest construction** - `423fb55` (fix)
5. **Fix: Unexport SetEntClient to prevent Wails binding ent.Client** - `1c447a9` (fix)
6. **Final integration commit** - `79429fd` (feat)

## Decisions Made

1. **useFlowPersistence inside ReactFlowProvider** - The hook uses useReactFlow() for viewport control, so all consumers must be inside the provider hierarchy.

2. **Cross-store dirty tracking** - flowStore calls `useProjectStore.getState().actions.markDirty()` on canvas changes. Uses getState() (not hook) for non-component contexts.

3. **Project lifecycle driven by Wails events** - Backend emits project:opened/created/closed events. Frontend listens and syncs state accordingly. menu:save triggers frontend save flow.

## Deviations from Plan

- Two additional fix commits needed for Wails binding issues (type names, SetEntClient export)
- These were runtime discoveries during integration testing

## Issues Encountered

- Wails binding generator exposed ent.Client type when SetEntClient was exported — fixed by unexporting
- SaveFlowRequest field construction needed adjustment for Wails binding compatibility

## Phase 3 Completion

All 3 plans for Phase 3 (Flow Persistence) are now complete:
- 03-01: Infrastructure (schemas, ProjectService, native menu)
- 03-02: Backend CRUD (SaveFlow, LoadFlow, ListFlows, DeleteFlow)
- 03-03: Frontend integration (project management, sidebar, save/load, dirty tracking)

**Phase 3 Success Criteria verification:**
1. ✅ User can save current flow to SQLite (nodes, edges, configurations preserved)
2. ✅ User can load previously saved flow and see exact canvas state restored
3. ✅ User can list all saved flows with metadata (name, created date, last modified)
4. ✅ User can delete flows from storage
5. ✅ SQLite write operations complete without "database is locked" errors

**Ready for Phase 4: SIP Infrastructure**

---
*Phase: 03-flow-persistence*
*Completed: 2026-02-02*
