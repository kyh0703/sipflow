# Phase 5: Basic SIP Commands - Research

**Researched:** 2026-02-02
**Domain:** SIP call operations (MakeCall/Bye/Cancel) via diago library
**Confidence:** HIGH

## Summary

Phase 5 implements three core SIP commands -- MakeCall (INVITE), Bye (BYE), and Cancel (CANCEL) -- through a flow execution layer that uses the diago `*Diago.Invite()` and `*DialogClientSession.Hangup()` APIs. The UAManager from Phase 4 must be extended to expose the `*diago.Diago` instance for call operations, and a new command execution layer must be created.

The diago library (v0.26.2) provides a clean API for outbound calls: `dg.Invite(ctx, recipient, opts)` returns a `*DialogClientSession` which has `Hangup(ctx)` for BYE. CANCEL is handled implicitly by canceling the context passed to `Invite()` before the call is answered -- sipgo's `WaitAnswer` method detects context cancellation and sends a proper SIP CANCEL request, waits for 200 OK to CANCEL, then waits for 487 Request Terminated. Error handling uses `sipgo.ErrDialogResponse{Res: *sip.Response}` which contains the full SIP response including StatusCode.

**Primary recommendation:** Create a `CommandExecutor` service that holds a reference to `UAManager`, retrieves the `*diago.Diago` instance for a given nodeID, executes the appropriate SIP command (Invite/Hangup), tracks active `*DialogClientSession` instances in a `SessionManager`, and emits call state events to the frontend via `EventEmitter`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/emiago/diago | v0.26.2 | SIP dialog management (Invite, Hangup, session lifecycle) | Already in go.mod; provides high-level call API over sipgo |
| github.com/emiago/sipgo | v1.1.2 | Low-level SIP stack (ErrDialogResponse, sip.Uri, sip.Response) | Transitive dependency; needed for error handling and URI parsing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/emiago/sipgo/sip | (transitive) | `sip.ParseUri()` for target URI, `sip.Response.StatusCode` for error codes | Building INVITE target, inspecting SIP responses |
| log/slog | stdlib | Structured logging for command execution events | Logging call lifecycle events (dialing, answered, terminated, failed) |
| context | stdlib | Context cancellation for CANCEL, timeouts for Invite | Every SIP command must use context for lifecycle control |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| diago.Invite() | Raw sipgo Client.WriteInvite() | Much more code; must handle SDP, transaction, dialog state manually |
| Context cancellation for CANCEL | Explicit sipgo CANCEL request | diago already handles this; building custom CANCEL logic duplicates effort |

## Architecture Patterns

### Recommended Project Structure
```
internal/
  infra/
    sip/
      ua_manager.go        # Extended: add GetDiago(nodeID) method
      session_manager.go   # NEW: tracks active DialogClientSession instances
      sip_logger.go        # Existing (unchanged)
  handler/
    sip_service.go         # Extended: add MakeCall, Bye, Cancel methods
    event_emitter.go       # Existing (unchanged)
    response.go            # Existing (unchanged)
```

### Pattern 1: UAManager Extension -- Expose Diago Instance
**What:** Add `GetDiago(nodeID string) (*diago.Diago, error)` to UAManager so the command layer can access the diago instance for making calls.
**When to use:** Always. Commands need the diago instance to call `Invite()`.
**Example:**
```go
// Source: Extension of existing ua_manager.go pattern
func (m *UAManager) GetDiago(nodeID string) (*diago.Diago, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    managed, exists := m.agents[nodeID]
    if !exists {
        return nil, fmt.Errorf("UA not found for node %s", nodeID)
    }
    return managed.dg, nil
}
```

### Pattern 2: SessionManager -- Track Active Calls
**What:** A concurrent-safe map of callID -> `*diago.DialogClientSession` for tracking active outbound calls. Needed for Bye (terminate specific call) and Cancel (abort specific call).
**When to use:** Any command that needs to reference an ongoing call session.
**Example:**
```go
// Source: Pattern derived from UAManager design
type SessionManager struct {
    mu       sync.RWMutex
    sessions map[string]*activeSession // callID -> session
    logger   *slog.Logger
}

type activeSession struct {
    dialog   *diago.DialogClientSession
    cancel   context.CancelFunc  // cancels the Invite context -> triggers CANCEL
    nodeID   string
    state    CallState
}

type CallState string

const (
    CallStateDialing     CallState = "dialing"
    CallStateRinging     CallState = "ringing"
    CallStateEstablished CallState = "established"
    CallStateTerminated  CallState = "terminated"
    CallStateFailed      CallState = "failed"
)

func (sm *SessionManager) Add(callID string, session *activeSession) {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    sm.sessions[callID] = session
}

func (sm *SessionManager) Get(callID string) (*activeSession, bool) {
    sm.mu.RLock()
    defer sm.mu.RUnlock()
    s, ok := sm.sessions[callID]
    return s, ok
}

func (sm *SessionManager) Remove(callID string) {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    delete(sm.sessions, callID)
}
```

### Pattern 3: MakeCall Command -- diago.Invite with Response Tracking
**What:** Execute INVITE via `dg.Invite(ctx, recipient, opts)`. Use `InviteOptions.OnResponse` callback to track provisional responses (180 Ringing) and emit state events to frontend.
**When to use:** SIPC-01 MakeCall command.
**Example:**
```go
// Source: Verified from pkg.go.dev/github.com/emiago/diago Invite API
func (s *SIPService) MakeCall(nodeID, targetURI string) Response[string] {
    dg, err := s.uaManager.GetDiago(nodeID)
    if err != nil {
        return Failure[string]("UA_NOT_FOUND", err.Error())
    }

    recipient, err := sip.ParseUri(fmt.Sprintf("sip:%s", targetURI))
    if err != nil {
        return Failure[string]("INVALID_URI", fmt.Sprintf("Invalid SIP URI: %v", err))
    }

    // Create cancellable context for this call (used for CANCEL later)
    ctx, cancel := context.WithCancel(context.Background())
    callID := uuid.New().String() // or use dialog ID after creation

    // Track the session before starting (for cancel support)
    session := &activeSession{
        cancel: cancel,
        nodeID: nodeID,
        state:  CallStateDialing,
    }
    s.sessionManager.Add(callID, session)

    // Run Invite in goroutine (it blocks until answered or fails)
    go func() {
        defer s.sessionManager.Remove(callID)

        opts := diago.InviteOptions{
            OnResponse: func(res *sip.Response) error {
                switch {
                case res.StatusCode == 180:
                    session.state = CallStateRinging
                    s.emitter.Emit("sip:callState", map[string]interface{}{
                        "callID": callID,
                        "nodeID": nodeID,
                        "state":  "ringing",
                    })
                case res.StatusCode >= 100 && res.StatusCode < 200:
                    // Other provisional responses
                    s.emitter.Emit("sip:callState", map[string]interface{}{
                        "callID": callID,
                        "nodeID": nodeID,
                        "state":  "progress",
                        "code":   res.StatusCode,
                    })
                }
                return nil
            },
        }

        dialog, err := dg.Invite(ctx, recipient, opts)
        if err != nil {
            session.state = CallStateFailed

            var errResp sipgo.ErrDialogResponse
            errCode := 0
            errMsg := err.Error()
            if errors.As(err, &errResp) {
                errCode = int(errResp.Res.StatusCode)
                errMsg = errResp.Res.StartLine()
            }

            s.emitter.Emit("sip:callState", map[string]interface{}{
                "callID":     callID,
                "nodeID":     nodeID,
                "state":      "failed",
                "statusCode": errCode,
                "error":      errMsg,
            })
            return
        }
        defer dialog.Close()

        // Call established
        session.dialog = dialog
        session.state = CallStateEstablished
        s.emitter.Emit("sip:callState", map[string]interface{}{
            "callID": callID,
            "nodeID": nodeID,
            "state":  "established",
        })

        // Wait for dialog to end (remote hangup or our hangup)
        <-dialog.Context().Done()

        session.state = CallStateTerminated
        s.emitter.Emit("sip:callState", map[string]interface{}{
            "callID": callID,
            "nodeID": nodeID,
            "state":  "terminated",
        })
    }()

    return Success(callID)
}
```

### Pattern 4: Bye Command -- dialog.Hangup()
**What:** Terminate an established call by calling `dialog.Hangup(ctx)` which sends BYE.
**When to use:** SIPC-02 Bye command.
**Example:**
```go
// Source: Verified from pkg.go.dev/github.com/emiago/diago DialogClientSession.Hangup
func (s *SIPService) Bye(callID string) Response[bool] {
    session, ok := s.sessionManager.Get(callID)
    if !ok {
        return Failure[bool]("SESSION_NOT_FOUND", "No active session for call ID")
    }

    if session.state != CallStateEstablished {
        return Failure[bool]("INVALID_STATE", "Call is not established, cannot send BYE")
    }

    if session.dialog == nil {
        return Failure[bool]("NO_DIALOG", "Dialog not yet available")
    }

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := session.dialog.Hangup(ctx); err != nil {
        return Failure[bool]("HANGUP_ERROR", fmt.Sprintf("Failed to send BYE: %v", err))
    }

    return Success(true)
}
```

### Pattern 5: Cancel Command -- Context Cancellation
**What:** Cancel an outgoing call before it is answered by canceling the context passed to `dg.Invite()`. sipgo automatically sends SIP CANCEL, waits for 200 OK to CANCEL, then 487 Request Terminated.
**When to use:** SIPC-03 Cancel command.
**Example:**
```go
// Source: Verified from sipgo dialog_client.go WaitAnswer -> inviteCancel flow
func (s *SIPService) Cancel(callID string) Response[bool] {
    session, ok := s.sessionManager.Get(callID)
    if !ok {
        return Failure[bool]("SESSION_NOT_FOUND", "No active session for call ID")
    }

    if session.state != CallStateDialing && session.state != CallStateRinging {
        return Failure[bool]("INVALID_STATE",
            fmt.Sprintf("Call is in state %s, can only cancel dialing/ringing calls", session.state))
    }

    // Cancel the context -> triggers SIP CANCEL in sipgo's WaitAnswer
    session.cancel()

    return Success(true)
}
```

### Pattern 6: Diago Serve for Incoming Calls (Future-Proofing)
**What:** `dg.ServeBackground(ctx, handler)` starts listening for incoming INVITEs. Not required for Phase 5 (outbound only) but needed if accepting calls later.
**When to use:** Only when handling inbound calls.
**Example:**
```go
// Source: Verified from diago API docs
// NOT needed in Phase 5 -- documented for awareness
err := dg.ServeBackground(ctx, func(inDialog *diago.DialogServerSession) {
    inDialog.Trying()
    inDialog.Ringing()
    inDialog.Answer()
    defer inDialog.Close()
    <-inDialog.Context().Done()
})
```

### Anti-Patterns to Avoid
- **Calling Hangup on a non-established dialog:** `Hangup()` sends BYE which is only valid for established dialogs. For pre-answer calls, use context cancellation (CANCEL). Mixing these up causes SIP protocol errors.
- **Forgetting dialog.Close():** Every `*DialogClientSession` from `dg.Invite()` must have `dialog.Close()` called to release RTP resources and SIP transaction state. Use `defer dialog.Close()`.
- **Blocking Wails handler with Invite:** `dg.Invite()` blocks until the call is answered, rejected, or times out. Always run in a goroutine and return a callID immediately.
- **Not tracking sessions:** Without a session map, Bye and Cancel commands have no way to reference the active call. Always register the session before starting Invite.
- **Sending CANCEL after 200 OK:** If the call is already answered, CANCEL has no effect. Check call state before canceling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SIP INVITE transaction | Custom INVITE/ACK/SDP handling | `diago.Invite(ctx, recipient, opts)` | Handles SDP negotiation, ACK, transaction retransmission, authentication |
| SIP CANCEL request | Manual CANCEL construction and sending | Cancel the `context.Context` passed to `Invite()` | sipgo handles CANCEL/200/487 sequence automatically |
| SIP BYE request | Manual BYE construction | `dialog.Hangup(ctx)` | Handles dialog routing, CSeq, BYE transaction |
| SIP response parsing | Custom response code extraction | `sipgo.ErrDialogResponse{Res: *sip.Response}` with `errors.As()` | Type-safe error handling with full response access |
| Call state machine | Custom FSM for SIP states | `InviteOptions.OnResponse` callback + `dialog.Context().Done()` | diago manages internal dialog state; callbacks provide visibility |
| SIP URI construction | String formatting | `sip.ParseUri("sip:user@host:port")` | Validates RFC 3261 URI format |

**Key insight:** diago's `Invite()` method encapsulates the entire INVITE transaction lifecycle (SDP offer/answer, provisional responses, ACK, authentication). The `OnResponse` callback provides hooks for state tracking without reimplementing the state machine. Context cancellation provides CANCEL for free.

## Common Pitfalls

### Pitfall 1: Race Between Cancel and Answer
**What goes wrong:** User clicks Cancel, but 200 OK arrives at the same moment. The CANCEL is sent after the call is established, which is a protocol error.
**Why it happens:** Network timing. 200 OK can arrive after CANCEL is sent but before it reaches the server.
**How to avoid:** sipgo handles this correctly at the protocol level. If 200 OK arrives before CANCEL is processed, sipgo will send BYE instead. The application code should check session state but trust the library to handle the race.
**Warning signs:** Calls that appear "stuck" after cancel -- actually established calls that need BYE.

### Pitfall 2: Invite Blocks Until Answer or Failure
**What goes wrong:** Calling `dg.Invite()` on the Wails main goroutine blocks the entire UI.
**Why it happens:** `Invite()` internally calls `WaitAnswer()` which blocks until 200 OK, error, or context cancellation.
**How to avoid:** Always run `Invite()` in a goroutine. Return a callID to the frontend immediately. Emit state changes via EventEmitter.
**Warning signs:** UI freezes when MakeCall button is clicked.

### Pitfall 3: Dialog Close vs Hangup Confusion
**What goes wrong:** Calling `Close()` without `Hangup()` -- dialog resources freed but no BYE sent. Remote party thinks call is still active.
**Why it happens:** `Close()` releases local resources. `Hangup()` sends BYE then calls `Close()` internally.
**How to avoid:** For graceful termination, always call `Hangup(ctx)` first. Use `defer dialog.Close()` as a safety net.
**Warning signs:** Remote party hears silence, call never properly terminated.

### Pitfall 4: Missing diago.Serve() for Transport Listeners
**What goes wrong:** `dg.Invite()` fails because no SIP transport listener is running.
**Why it happens:** diago requires `Serve()` or `ServeBackground()` to start transport listeners before making outbound calls.
**How to avoid:** Call `dg.ServeBackground(ctx, handler)` after creating the diago instance in UAManager, before any Invite calls. Even for outbound-only use, the listener is needed to receive responses.
**Warning signs:** Invite fails with transport/connection errors.

### Pitfall 5: ErrDialogResponse Type Assertion
**What goes wrong:** Using `err == ErrDialogResponse{}` instead of `errors.As()`.
**Why it happens:** `ErrDialogResponse` is a struct, not a sentinel error. Direct comparison fails.
**How to avoid:** Always use `errors.As(err, &errResp)` to extract the response.
**Warning signs:** All invite failures appear as generic errors; SIP status codes not captured.

### Pitfall 6: SessionManager Leak on Panic/Error
**What goes wrong:** If the Invite goroutine panics or exits without removing the session, the session stays in the map forever.
**Why it happens:** Error paths skip cleanup.
**How to avoid:** Use `defer s.sessionManager.Remove(callID)` at the top of the goroutine. Always clean up.
**Warning signs:** `sessionManager.sessions` grows over time; stale callIDs in frontend.

## Code Examples

### Complete MakeCall with Error Handling
```go
// Source: Verified from diago Invite API + sipgo ErrDialogResponse
import (
    "context"
    "errors"
    "fmt"

    "github.com/emiago/diago"
    "github.com/emiago/sipgo"
    "github.com/emiago/sipgo/sip"
)

// Make outbound call using existing diago instance
func makeCall(dg *diago.Diago, target string) (*diago.DialogClientSession, error) {
    recipient, err := sip.ParseUri(fmt.Sprintf("sip:%s", target))
    if err != nil {
        return nil, fmt.Errorf("invalid SIP URI %q: %w", target, err)
    }

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    opts := diago.InviteOptions{
        OnResponse: func(res *sip.Response) error {
            slog.Info("SIP response",
                "code", res.StatusCode,
                "reason", res.Reason,
            )
            return nil
        },
    }

    dialog, err := dg.Invite(ctx, recipient, opts)
    if err != nil {
        var errResp sipgo.ErrDialogResponse
        if errors.As(err, &errResp) {
            return nil, fmt.Errorf("call rejected: %d %s",
                errResp.Res.StatusCode, errResp.Res.Reason)
        }
        return nil, fmt.Errorf("invite failed: %w", err)
    }

    return dialog, nil
}
```

### SIP URI Parsing
```go
// Source: Verified from sipgo/sip package
import "github.com/emiago/sipgo/sip"

// Full SIP URI
uri, err := sip.ParseUri("sip:alice@proxy.example.com:5060")

// With transport parameter
uri, err := sip.ParseUri("sip:alice@proxy.example.com;transport=tcp")

// Access components
user := uri.User      // "alice"
host := uri.Host      // "proxy.example.com"
port := uri.Port      // 5060
```

### Error Handling for SIP Response Codes
```go
// Source: Verified from sipgo dialog.go ErrDialogResponse definition
import (
    "errors"
    "github.com/emiago/sipgo"
)

dialog, err := dg.Invite(ctx, recipient, opts)
if err != nil {
    var errResp sipgo.ErrDialogResponse
    if errors.As(err, &errResp) {
        code := errResp.Res.StatusCode
        switch {
        case code == 486:
            // Busy Here
        case code == 408:
            // Request Timeout
        case code == 403:
            // Forbidden
        case code == 404:
            // Not Found
        case code >= 500:
            // Server Error
        }
    }
    if errors.Is(err, context.Canceled) {
        // CANCEL was sent (user-initiated)
    }
}
```

### Context Cancellation Triggers CANCEL
```go
// Source: Verified from sipgo dialog_client.go WaitAnswer -> inviteCancel
ctx, cancel := context.WithCancel(context.Background())

go func() {
    dialog, err := dg.Invite(ctx, recipient, opts)
    // If cancel() is called before 200 OK:
    //   1. sipgo detects ctx.Done()
    //   2. Sends CANCEL request
    //   3. Waits for 200 OK to CANCEL
    //   4. Waits for 487 Request Terminated
    //   5. Returns context.Canceled error
}()

// Later, to cancel the outgoing call:
cancel() // Triggers SIP CANCEL automatically
```

### Hangup (BYE) an Established Call
```go
// Source: Verified from diago DialogClientSession.Hangup -> Bye
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

err := dialog.Hangup(ctx) // Sends SIP BYE
if err != nil {
    slog.Error("hangup failed", "error", err)
}
// dialog.Close() is called internally by Hangup
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual INVITE/ACK/BYE construction | `dg.Invite()` + `dialog.Hangup()` | diago v0.1+ | Eliminates 90% of SIP transaction code |
| Explicit CANCEL request construction | Context cancellation on Invite ctx | sipgo core design | CANCEL is automatic, no manual request needed |
| Custom call state machine | `OnResponse` callback + `dialog.Context().Done()` | diago v0.20+ | State tracking via callbacks, not custom FSM |

**Deprecated/outdated:**
- `diago.Progress()` is deprecated, use `diago.Ringing()` for 180 or `diago.ProgressMedia()` for 183 (server-side only, not relevant for Phase 5 outbound calls)

## Open Questions

1. **diago.ServeBackground() requirement for outbound calls**
   - What we know: diago needs transport listeners to receive SIP responses to outbound INVITEs.
   - What's unclear: Whether `dg.Invite()` automatically starts listeners or requires `ServeBackground()` first. The existing UAManager `CreateUA` does NOT call `ServeBackground()`.
   - Recommendation: Test whether `Invite()` works without `Serve*()`. If not, add `ServeBackground()` call in `CreateUA`. This is a critical integration question.
   - Confidence: MEDIUM -- need to verify empirically.

2. **Call ID generation strategy**
   - What we know: diago generates SIP Call-ID internally. We need a separate application-level call identifier to track sessions.
   - What's unclear: Whether to use `dialog.Id()` (which returns the SIP dialog ID) or generate our own UUID.
   - Recommendation: Use `dialog.Id()` after dialog creation. For the pre-answer phase (before dialog exists), use a generated UUID as interim callID, then map to dialog ID once established.

3. **Multiple simultaneous calls per UA**
   - What we know: Phase 4 research noted that `Invite()` may not be thread-safe on a single diago instance.
   - What's unclear: Whether multiple concurrent outbound calls from the same UA work correctly.
   - Recommendation: For Phase 5, limit to one active call per UA (per node). If concurrent calls are needed later, use separate UA instances. Add guard in MakeCall to reject if a call is already active for the nodeID.

4. **SIP authentication with Invite**
   - What we know: `InviteOptions` has `Username` and `Password` fields for digest authentication.
   - What's unclear: Whether auth credentials should come from the SIP server config (ent) or from the command node data.
   - Recommendation: Use SIP server config credentials. The command node specifies WHAT to call (target URI), the SIP server config specifies HOW (transport, auth).

## Sources

### Primary (HIGH confidence)
- [pkg.go.dev/github.com/emiago/diago](https://pkg.go.dev/github.com/emiago/diago) - Full API: Invite, InviteOptions, DialogClientSession, Hangup, Close, ServeBackground
- [pkg.go.dev/github.com/emiago/sipgo](https://pkg.go.dev/github.com/emiago/sipgo) - ErrDialogResponse struct, dialog errors, sip.ParseUri
- [github.com/emiago/sipgo/blob/main/dialog_client.go](https://github.com/emiago/sipgo/blob/main/dialog_client.go) - WaitAnswer CANCEL mechanism (inviteCancel flow)
- [github.com/emiago/diago/blob/main/dialog_client_session.go](https://github.com/emiago/diago/blob/main/dialog_client_session.go) - Hangup -> Bye delegation, Close pattern
- [github.com/emiago/diago/blob/main/dialog_session.go](https://github.com/emiago/diago/blob/main/dialog_session.go) - DialogSession interface (Id, Context, Hangup, Media, Close)
- [emiago.github.io/diago/docs/api_docs](https://emiago.github.io/diago/docs/api_docs/) - Official diago API docs

### Secondary (MEDIUM confidence)
- [github.com/emiago/diago](https://github.com/emiago/diago) - README, examples directory structure
- Existing codebase: ua_manager.go, sip_service.go, event_emitter.go, response.go patterns

### Tertiary (LOW confidence)
- ServeBackground requirement for outbound calls -- needs empirical verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - same diago/sipgo already in go.mod
- Architecture patterns: HIGH - based on verified diago API, consistent with existing codebase patterns
- MakeCall/Invite flow: HIGH - verified from pkg.go.dev and source code
- Cancel via context: HIGH - verified from sipgo dialog_client.go source (inviteCancel implementation)
- Bye via Hangup: HIGH - verified from diago DialogClientSession source
- Error handling (ErrDialogResponse): HIGH - verified from sipgo dialog.go source
- ServeBackground requirement: MEDIUM - needs empirical testing
- Concurrent calls: MEDIUM - Phase 4 research flagged potential thread safety issue

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (diago v0.26.x is current; API stable)
