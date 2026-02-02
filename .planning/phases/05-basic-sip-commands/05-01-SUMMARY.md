---
phase: 05
plan: 01
subsystem: sip-infrastructure
tags: [session-manager, ua-manager, tdd, concurrent, sip]
dependency-graph:
  requires: [04-02]
  provides: [session-manager, get-diago]
  affects: [05-02, 05-03]
tech-stack:
  added: []
  patterns: [session-tracking, call-state-machine]
key-files:
  created:
    - internal/infra/sip/session_manager.go
    - internal/infra/sip/session_manager_test.go
  modified:
    - internal/infra/sip/ua_manager.go
    - internal/infra/sip/ua_manager_test.go
decisions:
  - "SessionManager uses simple map with RWMutex (no sync.Map) for explicit locking control"
  - "ActiveSession.Dialog typed as *diago.DialogClientSession for MakeCall/Bye/Cancel usage"
  - "GetByNodeID returns first match (sufficient for one-call-per-UA guard)"
metrics:
  duration: "~2 min"
  completed: "2026-02-02"
---

# Phase 5 Plan 1: TDD SessionManager + UAManager.GetDiago() Summary

Thread-safe SessionManager for tracking active SIP call sessions by callID/nodeID, plus UAManager.GetDiago() for accessing diago instances per node.

## What Was Done

### Task 1: TDD SessionManager (RED-GREEN)

**RED:** 7 failing tests written covering:
- Add/Get by callID
- Remove by callID
- GetByNodeID lookup
- HasActiveCall guard (one-call-per-UA)
- RemoveByNodeID bulk cleanup
- Concurrent access with 50 goroutines
- DialogClientSession type verification

**GREEN:** SessionManager implemented with:
- `sync.RWMutex` for thread safety
- `map[string]*ActiveSession` keyed by callID
- CallState enum: dialing, ringing, established, terminated, failed
- ActiveSession struct holding `*diago.DialogClientSession`, `context.CancelFunc`, nodeID, state

### Task 2: UAManager.GetDiago (RED-GREEN)

**RED:** 3 failing tests written:
- GetDiago returns non-nil for existing UA
- GetDiago returns error for nonexistent nodeID
- GetDiago returns distinct instances per node (functional test)

**GREEN:** Simple read-lock method returning `managed.dg` from the agents map.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Simple map + RWMutex over sync.Map | Explicit locking gives more control for compound operations like RemoveByNodeID |
| GetByNodeID returns first match | Sufficient for one-call-per-UA guard; if multiple sessions per node needed later, can add GetAllByNodeID |
| CallState as string enum | Simple, serializable, debuggable in logs |

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

All 26 tests pass in `internal/infra/sip/` package:
- 7 new SessionManager tests
- 3 new GetDiago tests
- 16 existing tests (unchanged, still passing)

## Next Phase Readiness

Plan 05-02 (MakeCall/Bye/Cancel commands) can now:
- Use `SessionManager.Add()` to track outgoing calls
- Use `SessionManager.HasActiveCall()` for one-call-per-UA guard
- Use `UAManager.GetDiago()` to get diago instance for calling
- Use `SessionManager.Get()` to find active dialog for Bye/Cancel
