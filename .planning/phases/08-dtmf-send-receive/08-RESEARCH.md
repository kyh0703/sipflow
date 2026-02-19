# Phase 08: DTMF Send & Receive - Research

**Researched:** 2026-02-19
**Domain:** RFC 2833 RTP telephone-event DTMF signaling with diago, SendDTMF Command node, DTMFReceived Event node
**Confidence:** HIGH

## Summary

Phase 08 implements DTMF digit transmission and reception using RFC 2833 RTP telephone-event. The research confirms that diago v0.27.0 provides complete DTMF support through `AudioWriterDTMF()` and `AudioReaderDTMF()` APIs, which handle RFC 2833 encoding/decoding automatically. The telephone-event codec (payload type 101) is already included in all SIP instances via Phase 6's `stringToCodecs()` function.

DTMF sending is implemented as a Command node that calls `dialog.AudioWriterDTMF().WriteDTMF(rune)` for each digit in sequence. DTMF receiving is implemented as an Event node that uses `dialog.AudioReaderDTMF().Listen()` to wait for incoming digits, with optional `expectedDigit` filtering. The existing executor pattern supports both use cases with minimal changes.

**Key Recommendation:** Create SendDTMF Command node with `digits` string field and `intervalMs` timing parameter. Create DTMFReceived Event node with optional `expectedDigit` field for filtering. Use diago's built-in RFC 2833 support which handles encoding (7 redundant packets per digit), timing (20ms intervals), and decoding (duplicate suppression). Store received digits in ActionLog events for user visibility.

---

## User Constraints

**IMPORTANT:** Phase 8 has NO CONTEXT.md file. All implementation decisions are at Claude's discretion based on requirements and existing architecture patterns.

### Requirements from ROADMAP.md

**DTMF-01:** User can place SendDTMF Command node to send DTMF digits via RFC 2833 RTP telephone-event
**DTMF-02:** User can use DTMFReceived Event node to capture received digit value, optionally wait for specific digit (expectedDigit)

### Success Criteria

1. User can place SendDTMF Command and DTMFReceived Event nodes from node palette
2. User can enter DTMF digits (0-9, *, #) and transmission interval in SendDTMF node panel
3. During active call, SendDTMF node execution transmits configured digits via RFC 2833
4. DTMFReceived Event node with expectedDigit waits for specific digit, proceeds to next node when matched
5. Received digit values are displayed in log panel

### Out of Scope (Deferred to v1.2+)

- DTMF pattern validation (regex matching)
- SIP INFO method fallback
- In-band DTMF (low reliability with compressed codecs, RFC 2833 is standard)

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/emiago/diago | v0.27.0 | SIP/RTP DTMF engine | Already in use, provides AudioWriterDTMF/AudioReaderDTMF APIs |
| diago/media | v0.27.0 (internal) | RFC 2833 encoding/decoding | Built-in RTPDtmfWriter/Reader with redundancy handling |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| time (stdlib) | - | Interval delays between digits | SendDTMF digit transmission timing |
| strings (stdlib) | - | String parsing | Parse digits field, validate characters |

### Already Available

RFC 2833 telephone-event codec is already configured in all SIP instances:
- **Phase 6 Decision:** `stringToCodecs()` automatically appends `media.CodecTelephoneEvent8000` (PT 101)
- **No additional installation required**

---

## Architecture Patterns

### Recommended Project Structure

No new directories required. Follow existing Command/Event node patterns:

```
internal/
├── engine/
│   ├── executor.go           # Add executeSendDTMF() and executeDTMFReceived()
│   └── graph.go              # Add Digits, IntervalMs, ExpectedDigit fields
frontend/src/
├── features/scenario-builder/
│   ├── components/
│   │   ├── node-palette.tsx                    # Add SendDTMF, DTMFReceived
│   │   └── properties/
│   │       ├── command-properties.tsx          # Add SendDTMF fields
│   │       └── event-properties.tsx            # Add DTMFReceived fields
│   └── types/
│       └── scenario.ts                         # Add to COMMAND_TYPES, EVENT_TYPES
```

### Pattern 1: SendDTMF Execution Flow

**Description:** Send sequence of DTMF digits via RFC 2833 RTP packets
**When to Use:** executeSendDTMF() in executor.go

**Flow:**
1. Parse `digits` string from node.Data (e.g., "1234*#")
2. Parse `intervalMs` from node.Data (default: 100ms between digits)
3. Get dialog session from ex.sessions.GetDialog()
4. Verify dialog is answered (session exists)
5. Create DTMF writer with dialog.AudioWriterDTMF()
6. For each digit rune:
   - Call writer.WriteDTMF(digit)
   - Wait intervalMs before next digit
   - Emit ActionLog for each digit sent
7. Return nil on success

**Example:**
```go
// internal/engine/executor.go
func (ex *Executor) executeSendDTMF(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse digits and interval
    digits := getStringField(node.Data, "digits", "")
    if digits == "" {
        return fmt.Errorf("SendDTMF requires digits")
    }
    intervalMs := getFloatField(node.Data, "intervalMs", 100)
    interval := time.Duration(intervalMs) * time.Millisecond

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        ex.engine.emitActionLog(node.ID, instanceID,
            "No active dialog for SendDTMF (call must be answered first)", "error")
        return fmt.Errorf("no active dialog for SendDTMF")
    }

    // Create DTMF writer
    dtmfWriter := dialog.AudioWriterDTMF()

    // Send each digit
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("Sending DTMF digits: %s", digits), "info")

    for i, digit := range digits {
        // Check context cancellation
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }

        // Validate digit
        if !isValidDTMF(digit) {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Invalid DTMF digit: %c", digit), "error")
            return fmt.Errorf("invalid DTMF digit: %c", digit)
        }

        // Send digit
        if err := dtmfWriter.WriteDTMF(digit); err != nil {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Failed to send DTMF %c: %v", digit, err), "error")
            return fmt.Errorf("WriteDTMF failed: %w", err)
        }

        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Sent DTMF: %c", digit), "info")

        // Wait interval before next digit (except last)
        if i < len(digits)-1 {
            select {
            case <-ctx.Done():
                return ctx.Err()
            case <-time.After(interval):
            }
        }
    }

    ex.engine.emitActionLog(node.ID, instanceID, "DTMF transmission completed", "info")
    return nil
}

// Helper function
func isValidDTMF(r rune) bool {
    switch r {
    case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#':
        return true
    case 'A', 'B', 'C', 'D': // RFC 2833 supports A-D
        return true
    default:
        return false
    }
}
```

### Pattern 2: DTMFReceived Event Flow

**Description:** Wait for incoming DTMF digit, optionally filter by expectedDigit
**When to Use:** executeDTMFReceived() in executor.go

**Flow:**
1. Parse `expectedDigit` from node.Data (optional, empty means accept any)
2. Parse `timeout` from node.Data (default: 10000ms)
3. Get dialog session from ex.sessions.GetDialog()
4. Verify dialog is answered
5. Create DTMF reader with dialog.AudioReaderDTMF()
6. Set up OnDTMF callback:
   - If expectedDigit is set and received != expected: ignore, continue listening
   - If expectedDigit matches or empty: emit ActionLog, return success
7. Call reader.Listen() with timeout duration
8. Return nil when digit received, error on timeout

**Example:**
```go
// internal/engine/executor.go
func (ex *Executor) executeDTMFReceived(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse expected digit (optional)
    expectedDigit := getStringField(node.Data, "expectedDigit", "")

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        ex.engine.emitActionLog(node.ID, instanceID,
            "No active dialog for DTMFReceived (call must be answered first)", "error")
        return fmt.Errorf("no active dialog for DTMFReceived")
    }

    // Create DTMF reader
    dtmfReader := dialog.AudioReaderDTMF()

    // Log waiting state
    if expectedDigit != "" {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Waiting for DTMF digit: %s", expectedDigit), "info")
    } else {
        ex.engine.emitActionLog(node.ID, instanceID, "Waiting for any DTMF digit", "info")
    }

    // Channel to signal digit received
    receivedCh := make(chan rune, 1)
    errCh := make(chan error, 1)

    // Listen for DTMF in separate goroutine
    go func() {
        onDTMF := func(digit rune) error {
            // If expectedDigit is set, check match
            if expectedDigit != "" {
                if string(digit) != expectedDigit {
                    ex.engine.emitActionLog(node.ID, instanceID,
                        fmt.Sprintf("Received DTMF %c (waiting for %s)", digit, expectedDigit), "info")
                    return nil // Continue listening
                }
            }

            // Digit matches or no filter
            receivedCh <- digit
            return fmt.Errorf("stop listening") // Signal to stop Listen loop
        }

        dtmfReader.OnDTMF(onDTMF)

        // Listen with timeout
        buf := make([]byte, 1024)
        for {
            select {
            case <-ctx.Done():
                errCh <- ctx.Err()
                return
            default:
            }

            if _, err := dtmfReader.Read(buf); err != nil {
                if err.Error() == "stop listening" {
                    return // Success
                }
                errCh <- err
                return
            }
        }
    }()

    // Wait for result or timeout
    timeoutDuration := time.Duration(node.Timeout) * time.Millisecond
    select {
    case <-ctx.Done():
        return ctx.Err()
    case digit := <-receivedCh:
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Received DTMF: %c", digit), "info")
        return nil
    case err := <-errCh:
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("DTMF receive error: %v", err), "error")
        return err
    case <-time.After(timeoutDuration):
        ex.engine.emitActionLog(node.ID, instanceID, "DTMF receive timeout", "warning")
        return fmt.Errorf("timeout waiting for DTMF")
    }
}
```

### Pattern 3: Frontend Node Registration

**Description:** Add SendDTMF and DTMFReceived to node palette and properties
**When to Use:** Extending frontend for DTMF node types

**Changes:**
1. Add "SendDTMF" to COMMAND_TYPES in `types/scenario.ts`
2. Add "DTMFReceived" to EVENT_TYPES in `types/scenario.ts`
3. Add PaletteItems in `node-palette.tsx`
4. Add type-specific fields in `command-properties.tsx` and `event-properties.tsx`

**Example:**
```typescript
// types/scenario.ts
export const COMMAND_TYPES = [
  'MakeCall',
  'Answer',
  'Release',
  'PlayAudio',
  'SendDTMF'  // NEW
] as const;

export const EVENT_TYPES = [
  'INCOMING',
  'DISCONNECTED',
  'RINGING',
  'TIMEOUT',
  'DTMFReceived'  // NEW
] as const;

export interface CommandNodeData extends Record<string, unknown> {
  label: string;
  command: (typeof COMMAND_TYPES)[number];
  sipInstanceId?: string;
  targetUri?: string;     // MakeCall
  timeout?: number;
  filePath?: string;      // PlayAudio
  digits?: string;        // SendDTMF: "1234*#"
  intervalMs?: number;    // SendDTMF: milliseconds between digits
}

export interface EventNodeData extends Record<string, unknown> {
  label: string;
  event: (typeof EVENT_TYPES)[number];
  sipInstanceId?: string;
  timeout?: number;
  expectedDigit?: string; // DTMFReceived: "1" or empty for any
}

// node-palette.tsx
import { Hash, PhoneIncoming } from 'lucide-react';

<Section title="Commands">
  {/* existing commands */}
  <PaletteItem
    type="command-SendDTMF"
    label="SendDTMF"
    icon={Hash}
    colorClass="bg-blue-50 border-blue-400 text-blue-900"
  />
</Section>

<Section title="Events">
  {/* existing events */}
  <PaletteItem
    type="event-DTMFReceived"
    label="DTMFReceived"
    icon={PhoneIncoming}
    colorClass="bg-amber-50 border-amber-400 text-amber-900"
  />
</Section>

// command-properties.tsx
{data.command === 'SendDTMF' && (
  <div className="space-y-4 nodrag">
    <div className="space-y-2">
      <Label>Digits</Label>
      <Input
        value={data.digits || ''}
        onChange={(e) => onUpdate({ digits: e.target.value })}
        placeholder="1234*#"
        maxLength={20}
      />
      <p className="text-xs text-muted-foreground">
        Valid: 0-9, *, #, A-D
      </p>
    </div>

    <div className="space-y-2">
      <Label>Interval (ms)</Label>
      <Input
        type="number"
        value={data.intervalMs || 100}
        onChange={(e) => onUpdate({ intervalMs: parseInt(e.target.value) })}
        min={50}
        max={1000}
      />
      <p className="text-xs text-muted-foreground">
        Delay between digits (default: 100ms)
      </p>
    </div>
  </div>
)}

// event-properties.tsx
{data.event === 'DTMFReceived' && (
  <div className="space-y-4 nodrag">
    <div className="space-y-2">
      <Label>Expected Digit (optional)</Label>
      <Input
        value={data.expectedDigit || ''}
        onChange={(e) => onUpdate({ expectedDigit: e.target.value })}
        placeholder="Leave empty for any"
        maxLength={1}
      />
      <p className="text-xs text-muted-foreground">
        Wait for specific digit, or leave empty to accept any
      </p>
    </div>

    <div className="space-y-2">
      <Label>Timeout (ms)</Label>
      <Input
        type="number"
        value={data.timeout || 10000}
        onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) })}
        min={1000}
        max={60000}
      />
    </div>
  </div>
)}
```

### Anti-Patterns to Avoid

- **Don't implement custom RFC 2833 encoding**: diago handles all packet formatting, redundancy, timing
- **Don't use SIP INFO for DTMF**: RFC 2833 is more reliable, SIP INFO is non-standard fallback
- **Don't send DTMF before Answer**: Media session must be established (same as PlayAudio)
- **Don't block indefinitely on DTMF receive**: Always respect context cancellation and timeout

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Reason |
|---------|-------------|-------------|--------|
| RFC 2833 packet encoding | Custom DTMF RTP formatter | diago AudioWriterDTMF() | RFC 2833 requires 7 redundant packets per digit with precise timing (20ms intervals), marker bit handling, duration calculation |
| DTMF duplicate detection | Manual packet deduplication | diago AudioReaderDTMF() | diago.RTPDtmfReader handles EndOfEvent flag, duration validation (>50ms), prevents duplicate triggers |
| Digit timing/intervals | Manual time.Sleep loops | diago WriteDTMF() built-in timing | diago already uses ticker for 20ms packet intervals per RFC 2833 section 3.6 |
| In-band DTMF detection | Audio frequency analysis | RFC 2833 telephone-event | In-band detection fails with compressed codecs, RFC 2833 is standard for SIP |

**Key Insight:** RFC 2833 is complex - each digit requires 7 RTP packets (4 progress + 3 end-of-event) sent at 20ms intervals with identical timestamp but increasing duration field. diago handles all of this automatically. Hand-rolling would require deep RTP timing knowledge and duplicate suppression logic.

---

## Common Pitfalls

### Pitfall 1: Sending DTMF Before Dialog Answered

**What Happens:** Call dialog.AudioWriterDTMF() before Answer() completes
**Why It Fails:** Media session requires SDP negotiation, which happens during Answer
**How to Avoid:**
- Always call AudioWriterDTMF() only after Answer succeeds
- In executor, verify `ex.sessions.GetDialog(instanceID)` returns valid session
- If session doesn't exist, return error immediately

**Warning Signs:**
- Error: "media not available" or "no media session"
- AudioWriterDTMF panics with nil pointer

**Fix:**
```go
// BAD: Call AudioWriterDTMF in MakeCall
func (ex *Executor) executeMakeCall(...) {
    dialog, _ := instance.UA.Invite(...)
    dtmf := dialog.AudioWriterDTMF() // WRONG: No SDP yet
}

// GOOD: Call AudioWriterDTMF after Answer
func (ex *Executor) executeSendDTMF(...) {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no dialog (must Answer first)")
    }
    dtmf := dialog.AudioWriterDTMF() // Correct: SDP negotiated
}
```

### Pitfall 2: Invalid DTMF Characters

**What Happens:** User enters letters or symbols not in RFC 2833 spec
**Why It Fails:** diago dtmfEventMapping only supports 0-9, *, #, A-D
**How to Avoid:**
- Validate digits string before calling WriteDTMF()
- Show clear validation in frontend (Input pattern or onChange filter)
- Return descriptive error for invalid characters

**Warning Signs:**
- WriteDTMF() returns error or panics on invalid rune
- User confusion about what characters are allowed

**Fix:**
```go
// Validation helper
func isValidDTMF(r rune) bool {
    switch r {
    case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#':
        return true
    case 'A', 'B', 'C', 'D': // Optional extended digits
        return true
    default:
        return false
    }
}

// In executeSendDTMF
for _, digit := range digits {
    if !isValidDTMF(digit) {
        return fmt.Errorf("invalid DTMF digit: %c (allowed: 0-9, *, #, A-D)", digit)
    }
    dtmfWriter.WriteDTMF(digit)
}
```

**Frontend validation:**
```typescript
// Restrict input to valid characters
<Input
  value={data.digits || ''}
  onChange={(e) => {
    const filtered = e.target.value.replace(/[^0-9*#A-D]/g, '');
    onUpdate({ digits: filtered });
  }}
  placeholder="1234*#"
/>
```

### Pitfall 3: DTMF Receive Blocking Without Timeout

**What Happens:** DTMFReceived event waits indefinitely if no digit arrives
**Why It Fails:** User stops scenario but DTMF reader keeps blocking
**How to Avoid:**
- Always use diago's Listen() with timeout parameter
- Respect context.Done() in listening goroutine
- Return timeout error to allow failure branch handling

**Warning Signs:**
- StopScenario doesn't halt execution immediately
- Goroutine leak in long-running scenarios
- Executor timeout warnings in logs

**Fix:**
```go
// BAD: Listen without timeout
reader.Listen(func(dtmf rune) error {
    // Process digit
    return nil
}, 0) // 0 = infinite wait

// GOOD: Listen with timeout and context
go func() {
    reader.OnDTMF(onDTMF)
    buf := make([]byte, 1024)
    for {
        select {
        case <-ctx.Done():
            errCh <- ctx.Err()
            return
        default:
        }
        reader.Read(buf)
    }
}()

select {
case <-ctx.Done():
    return ctx.Err()
case <-time.After(node.Timeout):
    return fmt.Errorf("timeout")
}
```

### Pitfall 4: Interval Too Short Between Digits

**What Happens:** Set intervalMs below 50ms
**Why It Fails:** RFC 2833 specifies minimum ~50ms duration per digit (3*160 samples at 8kHz)
**How to Avoid:**
- Default intervalMs to 100ms (safe margin above minimum)
- Frontend Input min value set to 50ms
- Document why interval matters (receiver duplicate detection)

**Warning Signs:**
- Receiver sees duplicate digits or skips digits
- DTMF detection unreliable on far end

**Fix:**
```typescript
// Enforce minimum interval in frontend
<Input
  type="number"
  value={data.intervalMs || 100}
  onChange={(e) => {
    const val = parseInt(e.target.value);
    onUpdate({ intervalMs: Math.max(50, val) }); // Clamp to minimum
  }}
  min={50}
  max={1000}
/>
```

---

## Code Examples

### Example 1: SendDTMF Backend Implementation

**Source:** Adapted from diago examples/dtmf/main.go and RTPDtmfWriter

```go
// Add to internal/engine/executor.go

func (ex *Executor) executeCommand(ctx context.Context, instanceID string, node *GraphNode) error {
    switch node.Command {
    case "MakeCall":
        return ex.executeMakeCall(ctx, instanceID, node)
    case "Answer":
        return ex.executeAnswer(ctx, instanceID, node)
    case "Release":
        return ex.executeRelease(ctx, instanceID, node)
    case "PlayAudio":
        return ex.executePlayAudio(ctx, instanceID, node)
    case "SendDTMF":  // NEW
        return ex.executeSendDTMF(ctx, instanceID, node)
    default:
        return fmt.Errorf("unknown command: %s", node.Command)
    }
}

func (ex *Executor) executeSendDTMF(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse digits string
    digits := getStringField(node.Data, "digits", "")
    if digits == "" {
        return fmt.Errorf("SendDTMF requires digits")
    }

    // Parse interval (default 100ms)
    intervalMs := getFloatField(node.Data, "intervalMs", 100)
    interval := time.Duration(intervalMs) * time.Millisecond

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        ex.engine.emitActionLog(node.ID, instanceID,
            "No active dialog for SendDTMF (call must be answered first)", "error")
        return fmt.Errorf("no active dialog for SendDTMF")
    }

    // Create DTMF writer
    dtmfWriter := dialog.AudioWriterDTMF()

    // Log start
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("Sending DTMF digits: %s (interval: %dms)", digits, int(intervalMs)), "info")

    // Send each digit with interval
    for i, digit := range digits {
        // Check context
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }

        // Validate digit
        if !isValidDTMF(digit) {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Invalid DTMF digit: %c", digit), "error")
            return fmt.Errorf("invalid DTMF digit: %c (allowed: 0-9, *, #, A-D)", digit)
        }

        // Send DTMF
        if err := dtmfWriter.WriteDTMF(digit); err != nil {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Failed to send DTMF %c: %v", digit, err), "error")
            return fmt.Errorf("WriteDTMF failed for %c: %w", digit, err)
        }

        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Sent DTMF: %c", digit), "info")

        // Wait interval before next digit (except last)
        if i < len(digits)-1 {
            select {
            case <-ctx.Done():
                return ctx.Err()
            case <-time.After(interval):
            }
        }
    }

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("DTMF transmission completed (%d digits)", len(digits)), "info")
    return nil
}

// Validation helper
func isValidDTMF(r rune) bool {
    switch r {
    case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#':
        return true
    case 'A', 'B', 'C', 'D': // Extended DTMF (rarely used but supported by RFC 2833)
        return true
    default:
        return false
    }
}
```

### Example 2: DTMFReceived Event Backend Implementation

**Source:** Adapted from diago examples/dtmf/main.go ReadDTMF pattern

```go
// Add to internal/engine/executor.go

func (ex *Executor) executeEvent(ctx context.Context, instanceID string, node *GraphNode) error {
    switch node.Event {
    case "INCOMING":
        return ex.executeIncoming(ctx, instanceID, node)
    case "DISCONNECTED":
        return ex.executeDisconnected(ctx, instanceID, node)
    case "RINGING":
        return ex.executeRinging(ctx, instanceID, node)
    case "TIMEOUT":
        return ex.executeTimeout(ctx, instanceID, node)
    case "DTMFReceived":  // NEW
        return ex.executeDTMFReceived(ctx, instanceID, node)
    default:
        return fmt.Errorf("unknown event: %s", node.Event)
    }
}

func (ex *Executor) executeDTMFReceived(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse expected digit (optional)
    expectedDigit := getStringField(node.Data, "expectedDigit", "")

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        ex.engine.emitActionLog(node.ID, instanceID,
            "No active dialog for DTMFReceived (call must be answered first)", "error")
        return fmt.Errorf("no active dialog for DTMFReceived")
    }

    // Create DTMF reader
    dtmfReader := dialog.AudioReaderDTMF()

    // Log waiting state
    if expectedDigit != "" {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Waiting for DTMF digit: %s (timeout: %dms)", expectedDigit, node.Timeout.Milliseconds()), "info")
    } else {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Waiting for any DTMF digit (timeout: %dms)", node.Timeout.Milliseconds()), "info")
    }

    // Channels for signaling
    receivedCh := make(chan rune, 1)
    errCh := make(chan error, 1)

    // Listen for DTMF in goroutine
    go func() {
        // Setup callback
        dtmfReader.OnDTMF(func(digit rune) error {
            // Check if expected digit matches
            if expectedDigit != "" {
                if string(digit) != expectedDigit {
                    ex.engine.emitActionLog(node.ID, instanceID,
                        fmt.Sprintf("Received DTMF: %c (waiting for %s, continuing)", digit, expectedDigit), "info")
                    return nil // Continue listening
                }
            }

            // Digit accepted
            receivedCh <- digit
            return fmt.Errorf("digit received") // Signal to stop listening
        })

        // Read loop
        buf := make([]byte, 1024)
        for {
            select {
            case <-ctx.Done():
                errCh <- ctx.Err()
                return
            default:
            }

            if _, err := dtmfReader.Read(buf); err != nil {
                if err.Error() == "digit received" {
                    return // Success, exit goroutine
                }
                errCh <- err
                return
            }
        }
    }()

    // Wait for result, error, or timeout
    select {
    case <-ctx.Done():
        return ctx.Err()
    case digit := <-receivedCh:
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Received DTMF: %c", digit), "info")
        return nil
    case err := <-errCh:
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("DTMF receive error: %v", err), "error")
        return fmt.Errorf("DTMF receive failed: %w", err)
    case <-time.After(node.Timeout):
        ex.engine.emitActionLog(node.ID, instanceID,
            "DTMF receive timeout", "warning")
        return fmt.Errorf("timeout waiting for DTMF")
    }
}
```

### Example 3: Frontend Node Properties (SendDTMF)

**Source:** Existing command-properties.tsx patterns

```typescript
// frontend/src/features/scenario-builder/components/properties/command-properties.tsx

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CommandProperties({ node, onUpdate }: CommandPropertiesProps) {
  const { data } = node;

  return (
    <div className="space-y-4 nodrag">
      {/* ... existing fields ... */}

      {data.command === 'SendDTMF' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">DTMF Settings</h3>

            <div className="space-y-2">
              <Label>Digits</Label>
              <Input
                value={data.digits || ''}
                onChange={(e) => {
                  // Filter to valid DTMF characters only
                  const filtered = e.target.value.replace(/[^0-9*#A-D]/gi, '');
                  onUpdate({ digits: filtered.toUpperCase() });
                }}
                placeholder="1234*#"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Valid characters: 0-9, *, #, A-D (max 20 digits)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Interval Between Digits (ms)</Label>
              <Input
                type="number"
                value={data.intervalMs ?? 100}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 100;
                  // Clamp to 50-1000ms range
                  const clamped = Math.max(50, Math.min(1000, val));
                  onUpdate({ intervalMs: clamped });
                }}
                min={50}
                max={1000}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                Default: 100ms (minimum: 50ms per RFC 2833)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### Example 4: Frontend Event Properties (DTMFReceived)

**Source:** Existing event-properties.tsx patterns

```typescript
// frontend/src/features/scenario-builder/components/properties/event-properties.tsx

export function EventProperties({ node, onUpdate }: EventPropertiesProps) {
  const { data } = node;

  return (
    <div className="space-y-4 nodrag">
      {/* ... existing fields ... */}

      {data.event === 'DTMFReceived' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">DTMF Filter</h3>

            <div className="space-y-2">
              <Label>Expected Digit (optional)</Label>
              <Input
                value={data.expectedDigit || ''}
                onChange={(e) => {
                  // Only allow single valid DTMF character
                  const filtered = e.target.value.replace(/[^0-9*#A-D]/gi, '').slice(0, 1);
                  onUpdate({ expectedDigit: filtered.toUpperCase() });
                }}
                placeholder="Leave empty to accept any digit"
                maxLength={1}
              />
              <p className="text-xs text-muted-foreground">
                If set, wait for this specific digit. If empty, accept any digit.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={data.timeout ?? 10000}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 10000;
                  onUpdate({ timeout: Math.max(1000, Math.min(60000, val)) });
                }}
                min={1000}
                max={60000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">
                Maximum wait time for DTMF digit (default: 10000ms)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## State of the Art

| Previous Approach | Current Approach | Changed When | Impact |
|-------------------|------------------|--------------|--------|
| SIP INFO DTMF signaling | RFC 2833 RTP telephone-event | ~2005 (RFC 4733 updates RFC 2833) | More reliable, no SIP-layer dependency, works with proxies |
| In-band DTMF (audio tones) | Out-of-band RFC 2833 | ~2000 (RFC 2833) | Codec-independent, reliable with compressed audio (G.729, Opus) |
| Manual RTP DTMF encoding | diago RTPDtmfWriter/Reader | diago v0.27.0 (2024) | Automatic redundancy, timing, duplicate suppression |

**Deprecated/Outdated:**
- **In-band DTMF detection:** Frequency analysis (697-1633 Hz dual tones) unreliable with modern codecs
- **SIP INFO method:** Non-standard, requires proxy support, not widely deployed
- **Custom RFC 2833 implementation:** diago provides complete implementation with redundancy and timing

---

## Open Questions

### Question 1: DTMF Pattern Validation (Deferred to v1.2)

**What We Know:**
- User requirements mention "DTMF pattern validation (regex matching)" deferred to v1.2+
- Phase 8 implements basic digit-by-digit sending
- No pattern validation required for MVP

**What's Unclear:**
- Should frontend allow arbitrary digit strings or enforce patterns?
- Is there a common use case for pattern validation (e.g., IVR menu paths)?

**Recommendation:**
- Phase 8: Allow any valid DTMF string (0-9, *, #, A-D) up to 20 characters
- v1.2: Add optional regex pattern validation if IVR testing scenarios require it
- Example future pattern: `^[1-5]$` for "menu option 1-5 only"

### Question 2: DTMF Logging Granularity

**What We Know:**
- Success criteria: "Received digit values are displayed in log panel"
- SendDTMF should log each digit sent
- DTMFReceived should log received digit

**What's Unclear:**
- Should we log intermediate DTMF packets (non-EndOfEvent)?
- Should we log RFC 2833 redundancy (7 packets per digit)?

**Recommendation:**
- Phase 8: Log only complete digits (EndOfEvent for receive, after WriteDTMF for send)
- Suppress intermediate packet logs to avoid clutter (7 packets → 1 log line)
- Debug mode (future): Add verbose DTMF packet logging for troubleshooting

### Question 3: A-D Extended Digits UI

**What We Know:**
- RFC 2833 supports digits 0-9, *, #, A, B, C, D
- diago has full A-D support in dtmfEventMapping
- Most SIP phones only have 0-9, *, # keys

**What's Unclear:**
- Should frontend UI mention A-D in placeholder/help text?
- Are A-D digits commonly used in IVR systems?

**Recommendation:**
- Phase 8: Support A-D in validation (they're in RFC spec)
- UI: Mention A-D in help text but keep placeholder simple ("1234*#")
- Rationale: Some enterprise IVR systems use A-D for special functions, good to support even if uncommon

---

## Sources

### Primary (HIGH Confidence)

**diago Library:**
- [GitHub - emiago/diago v0.27.0](https://github.com/emiago/diago) - Main repository
- [diago/examples/dtmf/main.go](https://github.com/emiago/diago/blob/main/examples/dtmf/main.go) - Official DTMF example
- [diago/dialog_media.go](https://github.com/emiago/diago/blob/main/dialog_media.go) - AudioWriterDTMF/AudioReaderDTMF implementation
- [diago/media/rtp_dtmf_writer.go](https://github.com/emiago/diago/blob/main/media/rtp_dtmf_writer.go) - RFC 2833 encoding
- [diago/media/rtp_dtmf_reader.go](https://github.com/emiago/diago/blob/main/media/rtp_dtmf_reader.go) - RFC 2833 decoding
- [diago/media/rtp_dtmf.go](https://github.com/emiago/diago/blob/main/media/rtp_dtmf.go) - DTMFEvent struct, RTPDTMFEncode8000
- Verified in go.mod: `github.com/emiago/diago v0.27.0`

**RFC Standards:**
- [RFC 2833: RTP Payload for DTMF Digits](https://datatracker.ietf.org/doc/html/rfc2833) - Original DTMF over RTP spec
- [RFC 4733: RTP Payload for DTMF Digits (updates 2833)](https://datatracker.ietf.org/doc/html/rfc4733) - Current standard

**Existing Codebase:**
- `/home/overthinker/Project/sipflow/internal/engine/graph.go` - GraphNode structure, parsing patterns
- `/home/overthinker/Project/sipflow/internal/engine/executor.go` - Command/Event execution patterns
- `/home/overthinker/Project/sipflow/internal/engine/instance_manager.go` - stringToCodecs (includes telephone-event)
- `/home/overthinker/Project/sipflow/frontend/src/features/scenario-builder/types/scenario.ts` - Node type definitions

### Secondary (MEDIUM Confidence)

- [Phase 6 RESEARCH.md](../06-codec-configuration/06-RESEARCH.md) - Confirms telephone-event auto-inclusion
- [Phase 7 RESEARCH.md](../07-media-playback/07-RESEARCH.md) - DialogMedia usage patterns (Answer requirement)

### Tertiary (LOW Confidence)

None - all findings verified against official diago source code and RFC specifications

---

## Metadata

**Confidence Breakdown:**
- diago DTMF API: **HIGH** - Official examples + source code review
- RFC 2833 support: **HIGH** - diago implements complete spec with redundancy
- Executor patterns: **HIGH** - Existing codebase provides complete Command/Event examples
- telephone-event availability: **HIGH** - Phase 6 already includes codec in all instances
- Frontend patterns: **HIGH** - Consistent with PlayAudio (Phase 7) and existing nodes

**Research Date:** 2026-02-19

**Validity Period:** 30 days (stable libraries, diago v0.27.0 released 2024, RFC 2833/4733 are finalized standards)

**Review Notes:**
- All technical decisions are grounded in diago v0.27.0 capabilities
- No CONTEXT.md exists for Phase 8, all decisions at Claude's discretion
- Existing architecture (Command/Event nodes, executor pattern, SessionStore) fully supports DTMF implementation
- telephone-event codec already configured in all SIP instances (Phase 6)
- Implementation straightforward: two new node types, two new executor methods, frontend properties
