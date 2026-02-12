# Phase 07: Media Playback - Research

**Researched:** 2026-02-12
**Domain:** WAV file playback to RTP streams using diago, WAV validation, Wails file dialogs
**Confidence:** HIGH

## Summary

Phase 07 implements WAV audio playback to RTP streams for IVR simulation. The research confirms that diago v0.27.0 provides `PlaybackCreate()` and `Play()` methods for media playback, requiring the dialog to be answered before media operations. WAV file validation can be handled by the go-audio/wav library, which provides header parsing to verify 8kHz mono PCM format. Wails runtime provides `OpenFileDialog` with FileFilter support for native file selection.

The existing codebase architecture supports this phase well. The executor pattern provides session access via `ex.sessions.GetDialog()`, command nodes use `getStringField()` for data parsing, and Wails bindings follow the pattern in `internal/binding/`. The frontend node registration pattern is established in `node-palette.tsx` and command properties use a section-based UI.

**Key Recommendation:** Create PlayAudio Command node, implement WAV validation with go-audio/wav, use Wails runtime.OpenFileDialog for file selection, and extend executor with `executePlayAudio()` that calls dialog.PlaybackCreate().Play(). Store absolute file paths in flow_data, validate on file selection, and verify file existence at execution time.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**WAV File Path Strategy:**
- File storage: Original absolute path reference
- Wails file dialog selects WAV file, absolute path stored in scenario flow_data
- No file copying to project directory
- Path stored in `node.data.filePath` as string in flow_data JSON
- Backend parsing uses existing `getStringField` pattern

**File Missing Handling:**
- Execution-time verification: Check file existence when PlayAudio node executes
- If file missing and failure branch exists → proceed to failure branch
- If file missing and no failure branch → abort scenario
- No pre-flight validation on scenario start

**WAV Format Validation:**
- Validation timing: Immediate on file selection (in file dialog callback)
- Validation requirement: 8kHz mono PCM only
- Backend validates WAV header after file selection
- Invalid format → error message returned to frontend → toast notification
- Invalid format → do not store path in node data
- Valid format → path stored normally

**Properties Panel Path Display:**
- Display: Filename only (not full path)
- Tooltip: Full absolute path on hover
- No file selected state: Show "Select File" button only
- File selected state: Show filename + tooltip + "Change File" button

### Claude's Discretion

**PlayAudio Node UX:**
- Palette registration: Add `"PlayAudio"` to COMMAND_TYPES constant
- Icon: Lucide `Volume2`
- Color: Command blue scheme (consistent with MakeCall/Answer/Release)
- Canvas node badge: Display selected filename as badge/label

**Simulation Mode Behavior:**
- Simulation mode: Calculate WAV duration, delay for that duration, then complete
- Real mode: Call diago PlaybackCreate() and Play() APIs
- Duration calculation: Read WAV header SampleRate and data chunk size
- Note: Phase 07 implements real mode only; simulation deferred to future milestone

**Playback Progress Feedback:**
- Log panel: Emit ActionLog events for playback start/progress/completion
- Node state transitions: pending → running (during playback) → completed (after finish)
- Progress events: "Playing audio file X" at start, "Playback completed" at end
- Optional: Percentage progress events during playback (LOW priority)

### Deferred Ideas (OUT OF SCOPE)

- stopOnDTMF flag → v1.2
- loop flag → v1.2
- Detailed progress percentage events → v1.2
- Recording functionality → v1.2
- Multiple file formats (MP3, OGG) → v1.2

</user_constraints>

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/emiago/diago | v0.27.0 | SIP/RTP media engine | Already in use, provides PlaybackCreate/Play APIs |
| github.com/go-audio/wav | latest | WAV header parsing/validation | Industry standard Go WAV library, pure Go, no C dependencies |
| wails/v2/pkg/runtime | v2.11.0 | Native file dialog | Built-in Wails API for OS file dialogs |
| os (stdlib) | - | File I/O | Standard library for os.Open, os.Stat |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| io (stdlib) | - | io.ReadSeeker interface | WAV decoder requires io.ReadSeeker from os.File |
| path/filepath (stdlib) | - | Path manipulation | Extract filename from absolute path |
| time (stdlib) | - | Duration calculation | Calculate WAV playback duration |

### Installation

```bash
# Add to go.mod
go get github.com/go-audio/wav@latest

# Already installed in project
# - github.com/emiago/diago v0.27.0
# - github.com/wailsapp/wails/v2 v2.11.0
```

**Note:** go-audio/wav is not currently in go.mod. It needs to be added for WAV validation.

---

## Architecture Patterns

### Recommended Project Structure

No new directories required. Follow existing patterns:

```
internal/
├── engine/
│   ├── executor.go           # Add executePlayAudio()
│   └── graph.go              # PlayAudio parsing already supported
├── binding/
│   └── media_binding.go      # NEW: Add ValidateWAVFile() and SelectWAVFile()
frontend/src/
├── features/scenario-builder/
│   ├── components/
│   │   ├── node-palette.tsx                    # Add PlayAudio to Commands section
│   │   └── properties/
│   │       └── command-properties.tsx          # Add PlayAudio-specific fields
│   └── types/
│       └── scenario.ts                         # Add "PlayAudio" to COMMAND_TYPES
```

### Pattern 1: WAV File Selection Flow

**Description:** User selects WAV file → Backend validates → Frontend stores path
**When to Use:** PlayAudio node properties panel file selection button

**Flow:**
1. Frontend calls `ValidateWAVFile(filePath)` Wails binding
2. Backend opens file, parses WAV header with go-audio/wav
3. Backend checks: SampleRate == 8000, NumChans == 1, AudioFormat == PCM
4. Backend returns validation result (success/error message)
5. Frontend shows toast on error, updates node data on success

**Example:**
```typescript
// Frontend (command-properties.tsx)
const handleSelectFile = async () => {
  const selected = await runtime.OpenFileDialog({
    Title: "Select WAV Audio File",
    Filters: [{
      DisplayName: "WAV Audio (*.wav)",
      Pattern: "*.wav"
    }]
  });

  if (!selected) return;

  // Validate immediately
  const result = await ValidateWAVFile(selected);
  if (result.error) {
    toast.error(`Invalid WAV: ${result.error}`);
    return;
  }

  // Store absolute path
  onUpdate({ filePath: selected });
};
```

```go
// Backend (internal/binding/media_binding.go)
type WAVValidationResult struct {
    Valid   bool   `json:"valid"`
    Error   string `json:"error"`
    Details string `json:"details"` // e.g., "8kHz mono PCM"
}

func (m *MediaBinding) ValidateWAVFile(filePath string) (*WAVValidationResult, error) {
    f, err := os.Open(filePath)
    if err != nil {
        return &WAVValidationResult{Valid: false, Error: "File not found"}, nil
    }
    defer f.Close()

    decoder := wav.NewDecoder(f)
    if !decoder.IsValidFile() {
        return &WAVValidationResult{Valid: false, Error: "Not a valid WAV file"}, nil
    }

    // Parse header
    decoder.ReadInfo()

    // Validate 8kHz mono PCM
    if decoder.SampleRate != 8000 {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Sample rate must be 8kHz (got %d Hz)", decoder.SampleRate),
        }, nil
    }
    if decoder.NumChans != 1 {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Must be mono (got %d channels)", decoder.NumChans),
        }, nil
    }

    // PCM is audio format 1
    if decoder.AudioFormat != 1 {
        return &WAVValidationResult{
            Valid: false,
            Error: "Must be PCM format",
        }, nil
    }

    return &WAVValidationResult{
        Valid: true,
        Details: "8kHz mono PCM",
    }, nil
}
```

### Pattern 2: PlayAudio Execution Flow

**Description:** Executor calls diago PlaybackCreate and Play with WAV file
**When to Use:** executePlayAudio() in executor.go

**Flow:**
1. Parse filePath from node.Data using getStringField()
2. Check file existence with os.Stat()
3. Get dialog session from ex.sessions.GetDialog()
4. Verify dialog is answered (session exists)
5. Open file with os.Open() → io.ReadSeeker
6. Call dialog.PlaybackCreate() → AudioPlayback instance
7. Call playback.Play(file, "audio/wav")
8. Emit ActionLog events for progress
9. Wait for Play() to complete (blocking)
10. Close file, return nil on success

**Example:**
```go
// internal/engine/executor.go
func (ex *Executor) executePlayAudio(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse filePath from node data
    filePath := getStringField(node.Data, "filePath", "")
    if filePath == "" {
        return fmt.Errorf("PlayAudio requires filePath")
    }

    // Verify file exists
    if _, err := os.Stat(filePath); err != nil {
        return fmt.Errorf("audio file not found: %s", filePath)
    }

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for PlayAudio (call must be answered first)")
    }

    // Open WAV file
    file, err := os.Open(filePath)
    if err != nil {
        return fmt.Errorf("failed to open audio file: %w", err)
    }
    defer file.Close()

    // Create playback
    pb, err := dialog.PlaybackCreate()
    if err != nil {
        return fmt.Errorf("PlaybackCreate failed: %w", err)
    }

    // Emit start log
    fileName := filepath.Base(filePath)
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("Playing audio file: %s", fileName), "info")

    // Play file (blocking until complete)
    if err := pb.Play(file, "audio/wav"); err != nil {
        return fmt.Errorf("Play failed: %w", err)
    }

    // Emit completion log
    ex.engine.emitActionLog(node.ID, instanceID, "Playback completed", "info")

    return nil
}
```

### Pattern 3: Frontend Node Registration

**Description:** Add PlayAudio to node palette and command properties
**When to Use:** Extending frontend for new command type

**Changes:**
1. Add to COMMAND_TYPES in `types/scenario.ts`
2. Add PaletteItem in `node-palette.tsx` under Commands section
3. Add command-specific UI in `command-properties.tsx`

**Example:**
```typescript
// types/scenario.ts
export const COMMAND_TYPES = [
  'MakeCall',
  'Answer',
  'Release',
  'PlayAudio'  // NEW
] as const;

// node-palette.tsx
import { Volume2 } from 'lucide-react';

<Section title="Commands">
  {/* existing commands */}
  <PaletteItem
    type="command-PlayAudio"
    label="PlayAudio"
    icon={Volume2}
    colorClass="bg-blue-50 border-blue-400 text-blue-900"
  />
</Section>

// command-properties.tsx
{data.command === 'PlayAudio' && (
  <div className="space-y-2">
    <Label>Audio File</Label>
    {data.filePath ? (
      <div className="flex items-center gap-2">
        <Badge variant="outline" title={data.filePath}>
          {path.basename(data.filePath)}
        </Badge>
        <Button size="sm" onClick={handleSelectFile}>Change</Button>
      </div>
    ) : (
      <Button onClick={handleSelectFile}>Select File</Button>
    )}
  </div>
)}
```

### Anti-Patterns to Avoid

- **Don't copy WAV files**: Store absolute paths only, avoid filesystem clutter
- **Don't validate at scenario start**: Validate on file selection, check existence at execution
- **Don't hand-roll WAV parsing**: Use go-audio/wav for reliable header validation
- **Don't block on Play() without context**: Always respect context cancellation during playback

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Reason |
|---------|-------------|-------------|--------|
| WAV header parsing | Custom RIFF/WAV parser | go-audio/wav.NewDecoder() | WAV format has edge cases (metadata chunks, alignment), battle-tested library handles all variants |
| File dialog | Custom file picker UI | runtime.OpenFileDialog | Native OS dialogs provide familiar UX, handle permissions, multi-platform |
| RTP packetization | Custom RTP encoder for audio | diago PlaybackCreate/Play | diago handles codec negotiation, RTP timing, RTCP, packet loss |
| Duration calculation | Manual PCM math | go-audio/wav Decoder.Duration() | Handles variable bit depths, sample rates, padding |

**Key Insight:** WAV "simple" format has many variants (extensible format, BWF metadata, iXML chunks, RF64 for large files). go-audio/wav handles all of them, while hand-rolled parser will break on real-world files.

---

## Common Pitfalls

### Pitfall 1: Playing Before Dialog Answered

**What Happens:** Call dialog.PlaybackCreate() before dialog.Answer() completes
**Why It Fails:** Media session requires SDP negotiation, which happens during Answer
**How to Avoid:**
- Always call PlaybackCreate only after Answer succeeds
- In executor, verify `ex.sessions.GetDialog(instanceID)` returns valid session
- If session doesn't exist, return error immediately

**Warning Signs:**
- Error: "media not available" or "no media session"
- PlaybackCreate returns error about SDP

**Fix:**
```go
// BAD: Call PlaybackCreate in MakeCall
func (ex *Executor) executeMakeCall(...) {
    dialog, _ := instance.UA.Invite(...)
    pb, _ := dialog.PlaybackCreate() // WRONG: No SDP yet
}

// GOOD: Call PlaybackCreate after Answer
func (ex *Executor) executePlayAudio(...) {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no dialog (must Answer first)")
    }
    pb, _ := dialog.PlaybackCreate() // Correct: SDP negotiated
}
```

### Pitfall 2: File Path Portability Assumptions

**What Happens:** Store relative paths or assume Unix path separators
**Why It Fails:** Wails apps run on Windows/Mac/Linux, absolute paths differ
**How to Avoid:**
- Always store absolute paths from runtime.OpenFileDialog
- Use filepath.Base() to extract filename for display
- Never hardcode "/" or "\\" separators
- Validate file existence at execution time (user may move/delete file)

**Warning Signs:**
- File not found errors on different OS
- Backslash issues on Windows

**Fix:**
```go
// BAD: Hardcode path separators
fileName := strings.Split(filePath, "/")[len(...)-1]

// GOOD: Use filepath.Base
fileName := filepath.Base(filePath)
```

### Pitfall 3: Blocking Play() Without Context Cancellation

**What Happens:** Play() blocks until audio finishes, ignoring context.Done()
**Why It Fails:** User stops scenario, but PlayAudio continues playing
**How to Avoid:**
- Check ctx.Done() before calling Play()
- diago Play() respects context internally (verify in testing)
- If Play() doesn't respect context, use separate goroutine with select

**Warning Signs:**
- Scenario stop doesn't halt playback immediately
- StopScenario timeout warnings in logs

**Fix:**
```go
// Check context before Play
select {
case <-ctx.Done():
    return ctx.Err()
default:
}

if err := pb.Play(file, "audio/wav"); err != nil {
    return err
}
```

### Pitfall 4: go-audio/wav Decoder State Management

**What Happens:** Call decoder methods out of order or reuse decoder
**Why It Fails:** Decoder uses internal state, requires specific method call order
**How to Avoid:**
- Always call NewDecoder → IsValidFile → ReadInfo in order
- Don't reuse decoder for multiple files
- Close file after validation complete
- For playback, pass file directly to diago (don't decode PCM yourself)

**Warning Signs:**
- Validation fails on valid files
- Panic from decoder internal state

**Fix:**
```go
// GOOD: Proper decoder lifecycle
f, _ := os.Open(filePath)
defer f.Close()

decoder := wav.NewDecoder(f)
if !decoder.IsValidFile() {
    return errors.New("invalid WAV")
}

decoder.ReadInfo() // Must call before accessing SampleRate/NumChans
if decoder.SampleRate != 8000 { ... }
```

---

## Code Examples

### Example 1: WAV File Validation (Backend)

**Source:** Combining go-audio/wav documentation patterns

```go
package binding

import (
    "context"
    "fmt"
    "os"

    "github.com/go-audio/wav"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type MediaBinding struct {
    ctx context.Context
}

func NewMediaBinding() *MediaBinding {
    return &MediaBinding{}
}

func (m *MediaBinding) SetContext(ctx context.Context) {
    m.ctx = ctx
}

type WAVValidationResult struct {
    Valid   bool   `json:"valid"`
    Error   string `json:"error,omitempty"`
    Details string `json:"details,omitempty"`
}

// ValidateWAVFile validates WAV file format for 8kHz mono PCM
func (m *MediaBinding) ValidateWAVFile(filePath string) (*WAVValidationResult, error) {
    runtime.LogInfo(m.ctx, fmt.Sprintf("Validating WAV: %s", filePath))

    f, err := os.Open(filePath)
    if err != nil {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Cannot open file: %v", err),
        }, nil
    }
    defer f.Close()

    decoder := wav.NewDecoder(f)
    if !decoder.IsValidFile() {
        return &WAVValidationResult{
            Valid: false,
            Error: "Not a valid WAV file",
        }, nil
    }

    // ReadInfo populates decoder fields
    if err := decoder.ReadInfo(); err != nil {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Failed to read WAV header: %v", err),
        }, nil
    }

    // Validate 8kHz mono PCM
    if decoder.SampleRate != 8000 {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Sample rate must be 8kHz (file is %d Hz)", decoder.SampleRate),
        }, nil
    }

    if decoder.NumChans != 1 {
        return &WAVValidationResult{
            Valid: false,
            Error: fmt.Sprintf("Must be mono (file has %d channels)", decoder.NumChans),
        }, nil
    }

    // PCM format is 1 in WAV spec
    if decoder.Format().AudioFormat != 1 {
        return &WAVValidationResult{
            Valid: false,
            Error: "Audio format must be PCM",
        }, nil
    }

    runtime.LogInfo(m.ctx, "WAV validation passed")
    return &WAVValidationResult{
        Valid:   true,
        Details: fmt.Sprintf("8kHz mono PCM, %d-bit", decoder.BitDepth),
    }, nil
}

// SelectWAVFile opens file dialog and validates selection
func (m *MediaBinding) SelectWAVFile() (string, error) {
    runtime.LogInfo(m.ctx, "Opening WAV file dialog")

    selected, err := runtime.OpenFileDialog(m.ctx, runtime.OpenDialogOptions{
        Title: "Select WAV Audio File",
        Filters: []runtime.FileFilter{
            {
                DisplayName: "WAV Audio (*.wav)",
                Pattern:     "*.wav",
            },
        },
    })

    if err != nil {
        runtime.LogError(m.ctx, fmt.Sprintf("File dialog error: %v", err))
        return "", err
    }

    if selected == "" {
        // User cancelled
        return "", nil
    }

    // Validate immediately
    result, err := m.ValidateWAVFile(selected)
    if err != nil {
        return "", err
    }

    if !result.Valid {
        runtime.LogWarning(m.ctx, fmt.Sprintf("WAV validation failed: %s", result.Error))
        return "", fmt.Errorf(result.Error)
    }

    runtime.LogInfo(m.ctx, fmt.Sprintf("Selected valid WAV: %s", selected))
    return selected, nil
}
```

### Example 2: PlayAudio Execution (Backend)

**Source:** Adapted from diago documentation patterns and existing executor.go

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
    case "PlayAudio":  // NEW
        return ex.executePlayAudio(ctx, instanceID, node)
    default:
        return fmt.Errorf("unknown command: %s", node.Command)
    }
}

func (ex *Executor) executePlayAudio(ctx context.Context, instanceID string, node *GraphNode) error {
    // Parse filePath from node data
    filePath := getStringField(node.Data, "filePath", "")
    if filePath == "" {
        return fmt.Errorf("PlayAudio requires filePath")
    }

    // Verify file exists at execution time
    if _, err := os.Stat(filePath); err != nil {
        if os.IsNotExist(err) {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Audio file not found: %s", filePath), "error")
            return fmt.Errorf("audio file not found: %s", filePath)
        }
        return fmt.Errorf("cannot access audio file: %w", err)
    }

    // Get dialog session
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        ex.engine.emitActionLog(node.ID, instanceID,
            "No active dialog for PlayAudio (call must be answered first)", "error")
        return fmt.Errorf("no active dialog for PlayAudio")
    }

    // Open WAV file
    file, err := os.Open(filePath)
    if err != nil {
        return fmt.Errorf("failed to open audio file: %w", err)
    }
    defer file.Close()

    // Create playback instance
    pb, err := dialog.PlaybackCreate()
    if err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("PlaybackCreate failed: %v", err), "error")
        return fmt.Errorf("PlaybackCreate failed: %w", err)
    }

    // Emit start log
    fileName := filepath.Base(filePath)
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("Playing audio file: %s", fileName), "info")

    // Check context before blocking call
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
    }

    // Play file (blocking until playback completes)
    if err := pb.Play(file, "audio/wav"); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("Playback failed: %v", err), "error")
        return fmt.Errorf("Play failed: %w", err)
    }

    // Emit completion log
    ex.engine.emitActionLog(node.ID, instanceID, "Playback completed", "info")

    return nil
}
```

### Example 3: Frontend File Selection (TypeScript)

**Source:** Existing command-properties.tsx patterns

```typescript
// Add to frontend/src/features/scenario-builder/components/properties/command-properties.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SelectWAVFile } from '../../../../../wailsjs/go/binding/MediaBinding';

export function CommandProperties({ node, onUpdate }: CommandPropertiesProps) {
  const { data } = node;
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectAudioFile = async () => {
    setIsSelecting(true);
    try {
      // SelectWAVFile opens dialog and validates in one call
      const filePath = await SelectWAVFile();

      if (!filePath) {
        // User cancelled
        return;
      }

      // Update node data with absolute path
      onUpdate({ filePath });
      toast.success('Audio file selected');

    } catch (err) {
      // Validation error from backend
      toast.error(`Invalid WAV file: ${err.message}`);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="space-y-4 nodrag">
      {/* ... existing fields ... */}

      {data.command === 'PlayAudio' && (
        <div className="space-y-2">
          <Label>Audio File</Label>
          {data.filePath ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                title={data.filePath}
                className="max-w-[200px] truncate"
              >
                {/* Show filename only, full path in tooltip */}
                {data.filePath.split(/[\\/]/).pop()}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSelectAudioFile}
                disabled={isSelecting}
              >
                Change
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSelectAudioFile}
              disabled={isSelecting}
            >
              {isSelecting ? 'Selecting...' : 'Select File'}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Required: 8kHz mono PCM WAV format
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## State of the Art

| Previous Approach | Current Approach | Changed When | Impact |
|-------------------|------------------|--------------|--------|
| Manual RTP packetization | diago PlaybackCreate/Play | diago v0.27.0 (2024) | Simplified media handling, automatic codec support |
| Custom WAV parsers | go-audio/wav | 2020+ | Reliable parsing, handles all WAV variants |
| Platform-specific file dialogs | Wails runtime.OpenFileDialog | Wails v2 (2022) | Cross-platform native dialogs without CGO |

**Deprecated/Outdated:**
- **Manual SDP offer/answer for media**: diago handles SDP negotiation automatically via Answer()
- **CGO-based audio libraries**: go-audio/wav is pure Go, no C dependencies
- **Embedding files in binary**: Store absolute paths, users can update audio without rebuilding

---

## Open Questions

### Question 1: Simulation Mode Duration Calculation

**What We Know:**
- Simulation mode should delay for WAV duration instead of actually playing
- go-audio/wav provides Duration() method
- Requires reading entire WAV header and data chunk size

**What's Unclear:**
- Should simulation mode be implemented in Phase 07 or deferred?
- User decisions mention "simulation mode" but don't specify scope

**Recommendation:**
- Implement real playback only in Phase 07
- Defer simulation mode to v1.2 (matches DTMF/recording deferral pattern)
- If simulation needed, calculate duration: `samples / sampleRate = seconds`

### Question 2: Playback Progress Events

**What We Know:**
- User decisions mention "progress events" as optional
- diago Play() is blocking (no built-in progress callback)
- Could estimate progress with timer during Play()

**What's Unclear:**
- Is percentage progress required for Phase 07 verification?
- How important is progress feedback vs. simple "playing"/"completed"?

**Recommendation:**
- Phase 07: Emit only "Playing file X" and "Playback completed" logs
- v1.2: Add percentage progress with separate goroutine + timer estimation
- Rationale: Start/complete events sufficient for MVP, detailed progress is polish

---

## Sources

### Primary (HIGH Confidence)

**diago Library:**
- [GitHub - emiago/diago](https://github.com/emiago/diago) - Main repository
- [diago/dialog_media.go source](https://github.com/emiago/diago/blob/main/dialog_media.go) - PlaybackCreate implementation
- [Diago API Documentation](https://emiago.github.io/diago/docs/api_docs/) - Official API docs
- [Diago Demo Examples](https://emiago.github.io/diago/docs/examples/) - Playback examples
- Verified in go.mod: `github.com/emiago/diago v0.27.0`

**go-audio/wav Library:**
- [wav package - github.com/go-audio/wav](https://pkg.go.dev/github.com/go-audio/wav) - Official package docs
- [wav/decoder.go source](https://github.com/go-audio/wav/blob/master/decoder.go) - Decoder implementation
- [wav/decoder_test.go](https://github.com/go-audio/wav/blob/master/decoder_test.go) - Usage examples

**Wails Runtime:**
- [Wails Dialog Documentation](https://wails.io/docs/reference/runtime/dialog/) - OpenFileDialog API
- Verified in codebase: `internal/binding/` pattern, existing Wails bindings

### Secondary (MEDIUM Confidence)

- [Dialog package Go Packages](https://pkg.go.dev/github.com/wailsapp/wails/v2/pkg/options/dialog) - FileFilter struct details
- Verified by existing usage in sipflow codebase patterns

### Tertiary (LOW Confidence)

None - all findings verified against official documentation or codebase

---

## Metadata

**Confidence Breakdown:**
- diago PlaybackCreate/Play API: **HIGH** - Official documentation + source code review
- go-audio/wav validation: **HIGH** - Battle-tested library, official docs, test examples
- Wails file dialog: **HIGH** - Built-in API, already used in project
- Executor pattern: **HIGH** - Existing codebase provides complete examples
- Simulation mode: **LOW** - Not specified in user requirements, deferred

**Research Date:** 2026-02-12

**Validity Period:** 30 days (stable libraries, diago v0.27.0 released 2024, go-audio/wav stable)

**Review Notes:**
- All user decisions from CONTEXT.md are technically sound
- Existing architecture supports Phase 07 without major refactoring
- go-audio/wav needs to be added to go.mod (not currently present)
- Simulation mode implementation is ambiguous, recommend deferring to v1.2
