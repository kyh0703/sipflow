# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** 그린 플로우가 실제 SIP 통신으로 실행되어야 한다. 디자인과 실행이 하나로 연결되는 것이 핵심.
**Current focus:** Phase 3 - Flow Persistence

## Current Position

Phase: 3 of 10 (Flow Persistence)
Plan: 2 of 4
Status: In progress
Last activity: 2026-02-02 — Completed 03-02-PLAN.md

Progress: [████░░░░░░] 37%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 2.9 min
- Total execution time: ~0.48 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-project-structure | 4 | ~14 min | ~3.5 min |
| 02-visual-flow-designer | 4 | ~14 min | ~3.5 min |
| 03-flow-persistence | 2 | ~5 min | ~2.5 min |

**Recent Trend:**
- Last 5 plans: 02-03 (2min), 02-04 (5min), 03-01 (3min), 03-02 (2min)
- Trend: Stable (consistent execution speed)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Wails v2 desktop app chosen for Go backend + React frontend in single binary
- Phase 1: diago SIP stack selected for Go-native SIP UA implementation
- Phase 1: xyflow chosen for node/edge based visual flow editing
- Phase 1: SQLite selected for embedded database (no separate server needed)
- 01-01: Use modernc.org/sqlite (pure Go, no cgo) for cross-platform builds
- 01-01: Custom SQLite driver with PRAGMA foreign_keys=ON and journal_mode=WAL
- 01-01: MaxOpenConns=1 for SQLite single-writer constraint
- 01-01: Store database in user config directory
- 01-01: Use ent auto-increment integer IDs instead of UUIDs
- 01-02: Use Zustand actions object pattern to keep references stable and prevent re-renders
- 01-02: Implement event handshake protocol (frontend:ready → backend:ready) to prevent race conditions
- 01-02: Use EventsOff in useEffect cleanup instead of cancel function (Wails v2 API)
- 01-02: Upgrade Vite to v5 for Tailwind CSS v4 compatibility
- 01-02: Use Tailwind CSS v4 @theme directive instead of v3 @layer approach
- 01-03: Use generic Response[T] type for type-safe handler responses
- 01-03: FlowService directly uses ent client (no usecase layer in Phase 1 - YAGNI)
- 02-01: Use @xyflow/react native Node/Edge types instead of custom interfaces
- 02-01: Define nodeTypes/edgeTypes at module level with memo() to prevent performance collapse
- 02-01: Use applyNodeChanges/applyEdgeChanges for xyflow interactivity
- 02-01: Move sidebarOpen state from uiStore to flowStore (flow-canvas-specific)
- 02-01: Create serverStore with mock data for Phase 4 settings implementation
- 02-02: Use HTML5 DnD with application/xyflow MIME type for sidebar-to-canvas drag-drop
- 02-02: Use screenToFlowPosition to calculate correct drop position accounting for pan/zoom
- 02-02: Move connection status from App.tsx main area to Header component
- 02-02: Install shadcn/ui Accordion and Button components for consistent UI
- 02-03: Use Sheet component from shadcn/ui for right-side slide-out property panel
- 02-03: Implement local state copy for form editing (save/cancel workflow)
- 02-03: Route to type-specific sub-panels based on node.type
- 02-03: SIPInstancePanel reads servers from useServerStore (not hardcoded)
- 02-03: EventPanel manages timeout in milliseconds but displays in seconds
- 02-04: Implement validSequences map for edge validation (sipInstance->command, command->event|command, event->command)
- 02-04: Allow all connections but mark invalid ones with red color instead of blocking
- 02-04: Phase 2 complete and verified - ready for Phase 3 Flow Persistence
- 03-01: Viewport persistence included as quality-of-life feature (restoring exact canvas position improves UX)
- 03-01: All project lifecycle events emitted from ProjectService (consistent pattern)
- 03-01: menu:save is the only event from main.go (requires frontend canvas state)
- 03-01: App starts with no database open - user must create/open a project
- 03-01: Close previous ent client before opening new one to prevent "database is locked" errors
- 03-02: Delete-and-recreate pattern for SaveFlow updates (simpler than diffing xyflow client IDs)
- 03-02: ListFlows returns FlowMeta (not ent.Flow) for clean frontend consumption
- 03-02: LoadFlow eager-loads source/target nodes on edges for xyflow_id resolution
- 03-02: All FlowService methods guard nil entClient with NO_PROJECT error

### Pending Todos

None yet.

### Blockers/Concerns

**From Research:**
- Phase 1: Must define xyflow nodeTypes outside component to prevent performance collapse
- Phase 4: Limited diago production documentation - may need API exploration
- Phase 8: Blind/Attended Transfer RFCs (5589, 3515) are complex - needs protocol research
- Phase 10: sipgo proxy patterns have limited documentation beyond examples

**Resolved:**
- ✅ 01-01: SQLite single-writer pattern implemented with MaxOpenConns=1
- ✅ 01-01: Foreign key enforcement enabled via custom driver PRAGMA
- ✅ 01-02: Event handshake protocol implemented on frontend side (frontend:ready)
- ✅ 01-03: Event handshake protocol completed on backend side (backend:ready emission)
- ✅ 02-01: Module-level nodeTypes/edgeTypes defined to prevent performance collapse

## Session Continuity

Last session: 2026-02-02 05:13 UTC
Stopped at: Completed 03-02-PLAN.md (Flow Save/Load Operations)
Resume file: None
Next: 03-03-PLAN.md (Frontend Integration)

---
*State initialized: 2026-02-01*
*Last updated: 2026-02-02 05:13 UTC*
