# Phase 5 Plan 2: MakeCall/Bye/Cancel + ServeBackground Summary

**One-liner:** MakeCall/Bye/Cancel SIP commands with async INVITE, state event emission, and ServeBackground transport readiness

## Completed Tasks

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add ServeBackground to UAManager CreateUA | caf1faa | internal/infra/sip/ua_manager.go |
| 2 | Wire SessionManager and implement MakeCall/Bye/Cancel | 999b315 | internal/handler/sip_service.go, app.go |

## What Was Built

### ServeBackground Integration
- UAManager.CreateUA now calls `dg.ServeBackground(ctx, noop)` after diago creation
- Lifecycle context stored in managedUA struct for proper cleanup
- Context cancellation in destroyManagedUA stops ServeBackground goroutine
- All existing goroutine leak tests continue to pass

### MakeCall Command
- `MakeCall(nodeID, targetURI) Response[string]` returns callID immediately
- Async goroutine runs diago.Invite with full lifecycle management
- One-call-per-UA guard via sessionManager.HasActiveCall
- URI validation via sipgosip.ParseUri
- OnResponse callback handles 180 Ringing and other 1xx provisional responses
- Error handling distinguishes context.Canceled (cancelled) from sipgo.ErrDialogResponse (SIP failure with status code) from generic errors

### Bye Command
- `Bye(callID) Response[bool]` sends BYE on established calls only
- State validation: must be CallStateEstablished
- Dialog validation: session must have active dialog
- 5-second timeout context for hangup

### Cancel Command
- `Cancel(callID) Response[bool]` cancels dialing/ringing calls
- State validation: must be CallStateDialing or CallStateRinging
- Context cancellation triggers SIP CANCEL automatically via diago

### Event Emission
Events emitted on "sip:callState" channel with payload:
- `dialing`: call initiated, INVITE being sent
- `ringing`: 180 response received
- `progress`: other 1xx provisional responses (with statusCode/reason)
- `established`: call answered (2xx)
- `failed`: SIP error response (with statusCode/reason) or generic error
- `cancelled`: call cancelled by user (context.Canceled)
- `terminated`: dialog ended (after established call completes)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Simple callID format (nodeID-timestamp) | Sufficient for single-user desktop app, no UUID needed |
| ParseUri takes pointer receiver | Actual sipgo API: `ParseUri(string, *Uri)` not `ParseUri(string) (Uri, error)` |
| Response.Reason is field not method | Verified from sipgo source: `Reason string` field on sip.Response |
| No-op ServeDialogFunc for outbound-only | Phase 5 is outbound calls only; inbound handler will be added in later phases |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ParseUri API signature**
- **Found during:** Task 2
- **Issue:** Plan specified `sip.ParseUri("sip:" + targetURI)` returning `(Uri, error)` but actual API is `ParseUri(string, *Uri) error`
- **Fix:** Changed to `sipgosip.ParseUri("sip:"+targetURI, &recipient)`
- **Files modified:** internal/handler/sip_service.go

**2. [Rule 1 - Bug] Fixed Response.Reason() to Response.Reason**
- **Found during:** Task 2
- **Issue:** Plan specified `res.Reason()` as method call but Reason is a string field
- **Fix:** Changed `res.Reason()` to `res.Reason` and `errResp.Res.Reason()` to `errResp.Res.Reason`
- **Files modified:** internal/handler/sip_service.go

## Verification

- `go build ./...` -- passes
- `go test ./internal/infra/sip/ -v` -- all 26 tests pass
- `go vet ./...` -- clean

## Duration

~2.5 minutes
