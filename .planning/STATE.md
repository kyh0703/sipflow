# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** 그린 플로우가 실제 SIP 통신으로 실행되어야 한다. 디자인과 실행이 하나로 연결되는 것이 핵심.
**Current focus:** Phase 2 - Visual Flow Designer

## Current Position

Phase: 2 of 10 (Visual Flow Designer)
Plan: 1 of 4
Status: In progress
Last activity: 2026-02-01 — Completed 02-01-PLAN.md

Progress: [█░░░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 3.6 min
- Total execution time: ~0.28 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-project-structure | 4 | ~14 min | ~3.5 min |
| 02-visual-flow-designer | 1 | ~3 min | ~3 min |

**Recent Trend:**
- Last 5 plans: 01-03 (2min), 01-02 (6min), 01-04 (human-verify), 02-01 (3min)
- Trend: Stable

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

Last session: 2026-02-01 14:14 UTC
Stopped at: Completed 02-01-PLAN.md
Resume file: None

---
*State initialized: 2026-02-01*
*Last updated: 2026-02-01 14:14 UTC*
