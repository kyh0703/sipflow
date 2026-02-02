---
phase: 04-sip-infrastructure
plan: 03
subsystem: sip-engine-wiring
tags: [uamanager, sip-trace, wails-bindings, zustand, lifecycle]
depends_on:
  requires: [04-01, 04-02]
  provides: [full-sip-infrastructure, ua-lifecycle-api, sip-trace-panel]
  affects: [05-basic-call, 06-call-control]
tech-stack:
  added: []
  patterns: [event-driven-trace-forwarding, backend-to-frontend-event-bridge]
key-files:
  created:
    - frontend/src/components/SIPTracePanel.tsx
    - frontend/wailsjs/go/handler/SIPService.js
    - frontend/wailsjs/go/handler/SIPService.d.ts
  modified:
    - internal/handler/sip_service.go
    - app.go
    - frontend/src/stores/serverStore.ts
    - frontend/src/components/flow/panels/SIPInstancePanel.tsx
    - frontend/src/App.tsx
    - frontend/wailsjs/go/models.ts
decisions:
  - UAManager injected into SIPService via constructor (not global)
  - SIPTraceHandler callback emits structured map to frontend via EventEmitter
  - sip.SIPDebug toggled directly for protocol-level trace control
  - Server ID changed from string to number across frontend (matches ent int PK)
  - SIPTracePanel as collapsible bottom bar (hidden by default, terminal-style)
metrics:
  duration: ~7 min
  completed: 2026-02-02
---

# Phase 4 Plan 3: Wire UAManager into SIPService, Replace Mock serverStore, Add SIP Trace Panel - Summary

**End-to-end SIP infrastructure wiring: UAManager lifecycle API, backend-driven server CRUD, real-time SIP trace panel**

## What Was Done

### Task 1: Wire UAManager into SIPService and App Lifecycle

- Added `uaManager *sip.UAManager` field to SIPService struct
- Updated `NewSIPService` to accept UAManager parameter
- Implemented UA lifecycle methods:
  - `StartUA(nodeID, serverID)` - fetches server config from ent, builds UAConfig, creates UA
  - `StopUA(nodeID)` - destroys specific UA
  - `StopAllUAs()` - destroys all active UAs
  - `GetUAStatus(nodeID)` - returns single UA status as map
  - `ListUAStatuses()` - returns all active UA statuses
- Added `SetSIPTrace(enabled)` to toggle `sipgo/sip.SIPDebug`
- Updated `app.go`:
  - Created SIPTraceHandler with callback that emits structured trace entries to frontend
  - Created slog.Logger wrapping the trace handler
  - Created UAManager with trace-enabled logger
  - Shutdown calls `StopAllUAs()` before closing project

### Task 2: Replace Mock serverStore, Add SIP Trace Panel

- Rewrote `serverStore.ts`:
  - Removed all mock data (Dev Server, Staging Server, Production Server)
  - Changed `SIPServer.id` from `string` to `number`
  - Async CRUD actions via Wails SIPService bindings
  - `reset()` action for project close cleanup
- Updated `SIPInstancePanel`:
  - Auto-fetches servers on mount if list is empty
  - Uses `String(server.id)` for Select values (component requires strings)
- Created `SIPTracePanel`:
  - Collapsible bottom panel (bg-gray-900, font-mono, text-xs)
  - Listens for `sip:trace` Wails events
  - Max 500 entries with auto-scroll
  - Toggle trace on/off button, clear button
  - Color-coded levels (ERROR=red, WARN=yellow, INFO=green, DEBUG=gray)
- Updated `App.tsx`:
  - Added SIPTracePanel to layout
  - Project lifecycle events drive server list fetch/reset
  - Added serverActions to dependency array

### Task 3: Human Verification Checkpoint

- User verified and approved the implementation

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| UAManager injected via constructor | Follows dependency injection pattern, testable |
| Structured map emission for trace | Frontend receives consistent JSON-like objects |
| sipgo SIPDebug toggle | Direct control of protocol-level SIP message logging |
| Server ID string-to-number migration | Matches ent auto-increment integer primary key |
| Collapsible trace panel at bottom | Non-intrusive, terminal-style familiar to developers |

## Deviations from Plan

None - plan executed exactly as written.

## Phase 4 Completion

Phase 4 (SIP Infrastructure) is now **complete** with all 3 plans delivered:

1. **04-01**: SIP server config CRUD with ent schema + SIPService handler
2. **04-02**: UAManager for diago UA lifecycle + SIPTraceHandler for log capture
3. **04-03**: End-to-end wiring connecting backend to frontend

**Phase 4 Success Criteria Met:**
- SIP server configs persist in SQLite via ent schema
- UAManager creates/destroys diago instances per flow node
- SIP trace logging captures protocol messages
- Frontend serverStore backed by real backend (no mock data)
- Clean shutdown destroys all UAs before closing project

## Next Phase Readiness

Phase 5 (Basic Call) can proceed. The SIP infrastructure provides:
- UA lifecycle management (StartUA/StopUA per node)
- Server config persistence and retrieval
- SIP trace visibility for debugging
- Event bridge for real-time backend-to-frontend communication
