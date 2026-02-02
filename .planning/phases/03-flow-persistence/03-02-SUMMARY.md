---
phase: 03-flow-persistence
plan: 02
subsystem: persistence
tags: [ent, sqlite, transactions, xyflow, CRUD]

# Dependency graph
requires:
  - phase: 03-01
    provides: Flow/Node/Edge schemas with xyflow_id, viewport fields, ProjectService
provides:
  - SaveFlow with transactional atomic writes (WithTx commit/rollback)
  - LoadFlow with complete xyflow-compatible state reconstruction
  - ListFlows returning lightweight FlowMeta for sidebar display
  - DeleteFlow with cascade deletion via ent FK constraints
  - UpdateFlowName with validation
affects: [03-03-frontend-integration, 03-04-save-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns: [Transactional save with ent WithTx, delete-and-recreate for xyflow state updates, xyflow_id mapping for edge FK resolution]

key-files:
  created: []
  modified:
    - internal/handler/flow_service.go

key-decisions:
  - "Delete-and-recreate pattern for SaveFlow updates (simpler than diffing xyflow client IDs)"
  - "ListFlows returns FlowMeta (not ent.Flow) for clean frontend consumption"
  - "LoadFlow eager-loads source/target nodes on edges for xyflow_id resolution"
  - "All FlowService methods guard nil entClient with NO_PROJECT error"

patterns-established:
  - "xyflow_id -> ent node ID map during node creation for edge FK resolution"
  - "Nested eager loading: WithEdges(func(q) { q.WithSourceNode().WithTargetNode() })"
  - "FlowMeta lightweight type for list endpoints"

# Metrics
duration: 2min
completed: 2026-02-02
---

# Phase 03 Plan 02: Flow Save/Load Operations Summary

**Transactional SaveFlow with xyflow_id mapping, LoadFlow with full canvas state reconstruction, FlowMeta list endpoint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-02T05:10:48Z
- **Completed:** 2026-02-02T05:12:56Z
- **Tasks:** 2
- **Files modified:** 1 (internal/handler/flow_service.go)

## Accomplishments
- SaveFlow with ent WithTx for atomic all-or-nothing persistence of nodes, edges, viewport
- LoadFlow reconstructs complete xyflow-compatible FlowState with xyflow_id preservation
- ListFlows returns lightweight FlowMeta array (id, name, timestamps) for sidebar
- UpdateFlowName with validation and NOT_FOUND handling
- All 7 FlowService methods guard against nil entClient (NO_PROJECT error)
- Edge FK resolution via xyflow_id -> ent node ID map built during node creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement SaveFlow with transactional write** - `ff9d4d3` (feat)
   - Added nil entClient guards to ListFlows and DeleteFlow
   - SaveFlow already implemented from 03-01 with full transactional integrity
   - All FlowService methods now consistently guard against nil entClient (7 guards total)

2. **Task 2: Implement LoadFlow and remaining CRUD operations** - `6f85589` (feat)
   - LoadFlow returns FlowState with nodes (xyflow_id as ID), edges (source/target xyflow_ids), viewport
   - Nested eager loading: WithEdges -> WithSourceNode/WithTargetNode for xyflow_id resolution
   - ListFlows updated from []*ent.Flow to []FlowMeta with RFC3339 timestamps
   - UpdateFlowName with empty name validation and NOT_FOUND error handling

## Files Modified

- `internal/handler/flow_service.go` - Added LoadFlow, UpdateFlowName, updated ListFlows return type, nil guards on all methods

## Decisions Made

1. **Delete-and-recreate for updates** - SaveFlow deletes all nodes/edges then recreates from request data. Simpler than diffing xyflow client-generated IDs against database IDs. No performance concern at this scale.

2. **FlowMeta for list endpoint** - ListFlows returns FlowMeta (id, name, timestamps as RFC3339 strings) instead of full ent.Flow objects. Avoids exposing internal ent types to frontend and prevents accidental loading of node/edge data for list display.

3. **Nested eager loading for edge xyflow_ids** - LoadFlow uses WithEdges(func(q) { q.WithSourceNode().WithTargetNode() }) to load source/target nodes on each edge. This allows mapping from ent node IDs back to xyflow_id strings without a separate query.

4. **Nil guards on all methods** - Every FlowService method (except SetEntClient) returns NO_PROJECT error when entClient is nil. Consistent pattern prevents nil pointer panics when no project is open.

## Deviations from Plan

None - plan executed exactly as written.

SaveFlow was already implemented from 03-01. Task 1 focused on adding nil guards to remaining methods. Task 2 added LoadFlow, UpdateFlowName, and updated ListFlows as specified.

## Issues Encountered

None - all Go code compiled successfully after changes.

## Next Phase Readiness

**Ready for downstream plans:**
- SaveFlow: Accepts complete xyflow toObject() output, returns flow ID
- LoadFlow: Returns FlowState with xyflow-compatible node/edge IDs for canvas reconstruction
- ListFlows: Returns FlowMeta array for sidebar flow list
- UpdateFlowName: Available for inline rename functionality
- DeleteFlow: Cascades to nodes and edges via ent FK constraints

**Blockers/concerns:** None

**What's next:** 03-03 will wire these backend methods to the frontend (xyflow state serialization, Wails binding calls, flow list sidebar)

---
*Phase: 03-flow-persistence*
*Completed: 2026-02-02*
