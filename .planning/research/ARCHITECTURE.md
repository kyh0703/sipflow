# Architecture Integration: SIP Media Features

**Project:** SIPFLOW v1.1 Media + Recording
**Research Date:** 2026-02-11
**Confidence Level:** HIGH

## Executive Summary

This document outlines the architectural integration of media playback, recording, DTMF, and codec features into the existing SIPFLOW v1.0 architecture. The integration follows the established Command/Event pattern and extends the diago DialogMedia interface usage without requiring fundamental restructuring.

**Key Insight:** The existing architecture already supports media features through the diago `DialogMedia` interface. Our task is to expose these capabilities through new Command nodes, extend Event nodes for media events, and add asset management for WAV files.

## Current Architecture Analysis

### Backend Structure (Go)

```
internal/engine/
├── engine.go              # Orchestrator - manages scenario execution
├── executor.go            # Command/Event dispatcher
├── graph.go               # ExecutionGraph parser (FlowData → GraphNode)
├── instance_manager.go    # diago UA lifecycle management
├── session_store.go       # DialogSession storage (thread-safe)
└── events.go              # EventEmitter abstraction
```

**Current Flow:**
1. `Engine.StartScenario()` → Parse graph → Create instances → Start goroutines
2. `Executor.ExecuteChain()` → Traverse nodes → Call `executeNode()`
3. `executeNode()` → Switch on type → `executeCommand()` or `executeEvent()`
4. `executeCommand()` → Switch on Command → Execute SIP action
5. `SessionStore` → Store/retrieve DialogSession for reuse across nodes
6. `EventEmitter` → Push real-time updates to frontend

**Key Integration Points:**
- `DialogSession.Media()` → Returns `*DialogMedia` (currently unused)
- `SessionStore` → Already stores DialogSession with Media() method
- `Executor.executeCommand()` → Add media command cases here
- `Executor.executeEvent()` → Add media event cases here

### Frontend Structure (React + TypeScript)

```
frontend/src/features/scenario-builder/
├── components/nodes/
│   ├── command-node.tsx    # Visual Command node
│   ├── event-node.tsx      # Visual Event node
│   └── sip-instance-node.tsx
├── store/
│   ├── scenario-store.ts   # Zustand store for scenario data
│   └── execution-store.ts  # Zustand store for runtime state
└── types/scenario.ts       # TypeScript types (FlowNode, FlowEdge)
```

**Current Node Data Model:**
```typescript
// Command nodes store:
{
  command: "MakeCall" | "Answer" | "Release"
  sipInstanceId: string
  targetUri?: string  // MakeCall only
  timeout?: number
}

// Event nodes store:
{
  event: "INCOMING" | "DISCONNECTED" | "RINGING" | "TIMEOUT"
  sipInstanceId: string
  timeout?: number
}
```

## Media Feature Architecture

### 1. Backend Integration Points

#### 1.1 New Command Nodes (executor.go)

Add to `executeCommand()` switch statement:

```go
// EXISTING:
case "MakeCall": return ex.executeMakeCall(...)
case "Answer": return ex.executeAnswer(...)
case "Release": return ex.executeRelease(...)

// NEW:
case "PlayMedia": return ex.executePlayMedia(...)
case "Record": return ex.executeRecord(...)
case "SendDTMF": return ex.executeSendDTMF(...)
case "StopRecord": return ex.executeStopRecord(...)
```

**Implementation Pattern:**
```go
func (ex *Executor) executePlayMedia(ctx context.Context, instanceID string, node *GraphNode) error {
    // 1. Log action
    ex.engine.emitActionLog(node.ID, instanceID, "Playing media file", "info")

    // 2. Get dialog from SessionStore
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for PlayMedia")
    }

    // 3. Access DialogMedia
    media := dialog.Media()
    if media == nil {
        return fmt.Errorf("media not available on dialog")
    }

    // 4. Open WAV file
    wavPath := node.MediaPath  // From GraphNode.MediaPath
    file, err := os.Open(wavPath)
    if err != nil {
        return fmt.Errorf("failed to open media file: %w", err)
    }
    defer file.Close()

    // 5. Create playback
    playback, err := media.PlaybackCreate(file)
    if err != nil {
        return fmt.Errorf("playback failed: %w", err)
    }

    // 6. Wait for playback completion or context cancel
    select {
    case <-playback.Done():
        ex.engine.emitActionLog(node.ID, instanceID, "Media playback completed", "info")
        return nil
    case <-ctx.Done():
        playback.Stop()
        return ctx.Err()
    }
}
```

#### 1.2 Extended Event Nodes (executor.go)

Add to `executeEvent()` switch statement:

```go
// NEW:
case "DTMF_RECEIVED": return ex.executeDTMFReceived(...)
case "RECORD_COMPLETED": return ex.executeRecordCompleted(...)
```

**DTMF Detection Implementation:**
```go
func (ex *Executor) executeDTMFReceived(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for DTMF detection")
    }

    media := dialog.Media()
    dtmfReader := media.AudioReaderDTMF()

    // Wait for expected DTMF digit(s)
    expectedDigit := node.DTMFDigit  // From GraphNode.DTMFDigit

    select {
    case digit := <-dtmfReader.DTMF():
        if expectedDigit == "" || string(digit) == expectedDigit {
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("DTMF received: %c", digit), "info")
            return nil
        }
        return fmt.Errorf("unexpected DTMF: %c (expected: %s)", digit, expectedDigit)
    case <-ctx.Done():
        return fmt.Errorf("DTMF timeout")
    }
}
```

#### 1.3 GraphNode Data Model Extension (graph.go)

Extend `GraphNode` struct:

```go
type GraphNode struct {
    // EXISTING FIELDS:
    ID          string
    Type        string        // "command" | "event"
    InstanceID  string
    Command     string
    TargetURI   string
    Event       string
    Timeout     time.Duration
    SuccessNext *GraphNode
    FailureNext *GraphNode

    // NEW MEDIA FIELDS:
    MediaPath   string        // WAV file path for PlayMedia
    RecordPath  string        // Output path for Record
    DTMFDigits  string        // Digits to send for SendDTMF
    DTMFDigit   string        // Expected digit for DTMF_RECEIVED event
    CodecPrefs  []string      // Codec preferences for instance
}
```

#### 1.4 Codec Configuration (instance_manager.go)

Extend `SipInstanceConfig` and modify `CreateInstances()`:

```go
type SipInstanceConfig struct {
    // EXISTING:
    ID       string
    Label    string
    Mode     string
    DN       string
    Register bool
    Color    string

    // NEW:
    Codecs   []string  // ["PCMU", "PCMA", "Opus"]
}

func (im *InstanceManager) CreateInstances(graph *ExecutionGraph) error {
    // ... existing code ...

    // Configure codecs
    mediaConfig := diago.MediaConfig{
        Codecs: convertCodecs(chain.Config.Codecs),
    }

    dg := diago.NewDiago(ua,
        diago.WithTransport(/* existing */),
        diago.WithMediaConfig(mediaConfig),  // NEW
    )

    // ... rest of code ...
}

func convertCodecs(codecNames []string) []string {
    // Map UI codec names to diago constants
    // "PCMU" → media.CodecAudioPCMU
    // "PCMA" → media.CodecAudioPCMA
    // "Opus" → media.CodecAudioOpus
}
```

#### 1.5 Media Asset Management

**New Component: `internal/media/asset_manager.go`**

```go
package media

import (
    "fmt"
    "os"
    "path/filepath"
)

type AssetManager struct {
    baseDir string  // User's media directory
}

func NewAssetManager() *AssetManager {
    // Default: ~/.sipflow/media/
    homeDir, _ := os.UserHomeDir()
    return &AssetManager{
        baseDir: filepath.Join(homeDir, ".sipflow", "media"),
    }
}

func (am *AssetManager) ResolveMediaPath(filename string) (string, error) {
    // Resolve relative path to absolute
    if filepath.IsAbs(filename) {
        return filename, nil
    }

    fullPath := filepath.Join(am.baseDir, filename)
    if _, err := os.Stat(fullPath); err != nil {
        return "", fmt.Errorf("media file not found: %s", filename)
    }

    return fullPath, nil
}

func (am *AssetManager) ListMediaFiles() ([]string, error) {
    // Return all .wav files in baseDir
    entries, err := os.ReadDir(am.baseDir)
    if err != nil {
        return nil, err
    }

    var files []string
    for _, entry := range entries {
        if !entry.IsDir() && filepath.Ext(entry.Name()) == ".wav" {
            files = append(files, entry.Name())
        }
    }

    return files, nil
}

func (am *AssetManager) GenerateRecordingPath(instanceID string) string {
    // Generate unique recording filename
    timestamp := time.Now().Format("20060102_150405")
    return filepath.Join(am.baseDir, "recordings",
        fmt.Sprintf("rec_%s_%s.wav", instanceID, timestamp))
}
```

**Wails Binding: `internal/binding/media.go`**

```go
package binding

type MediaBinding struct {
    am *media.AssetManager
}

func NewMediaBinding(am *media.AssetManager) *MediaBinding {
    return &MediaBinding{am: am}
}

func (mb *MediaBinding) ListMediaFiles() ([]string, error) {
    return mb.am.ListMediaFiles()
}

func (mb *MediaBinding) SelectMediaFile() (string, error) {
    // Wails file dialog
    // Return selected file path
}
```

#### 1.6 Recording Session Management

**New Component: `SessionStore` extension**

```go
// Add to SessionStore in executor.go
type SessionStore struct {
    // EXISTING:
    mu             sync.RWMutex
    dialogs        map[string]diago.DialogSession
    serverSessions map[string]*diago.DialogServerSession

    // NEW:
    recordings     map[string]*RecordingSession  // instanceID → recording
}

type RecordingSession struct {
    OutputPath string
    File       *os.File
    Recording  interface{}  // diago recording object
    StopCh     chan struct{}
}

func (ss *SessionStore) StartRecording(instanceID, outputPath string, dialog diago.DialogSession) error {
    ss.mu.Lock()
    defer ss.mu.Unlock()

    file, err := os.Create(outputPath)
    if err != nil {
        return err
    }

    media := dialog.Media()
    recording, err := media.AudioStereoRecordingCreate(file)
    if err != nil {
        file.Close()
        return err
    }

    ss.recordings[instanceID] = &RecordingSession{
        OutputPath: outputPath,
        File:       file,
        Recording:  recording,
        StopCh:     make(chan struct{}),
    }

    return nil
}

func (ss *SessionStore) StopRecording(instanceID string) error {
    ss.mu.Lock()
    defer ss.mu.Unlock()

    rec, exists := ss.recordings[instanceID]
    if !exists {
        return fmt.Errorf("no recording for instance %s", instanceID)
    }

    close(rec.StopCh)
    rec.File.Close()
    delete(ss.recordings, instanceID)

    return nil
}
```

### 2. Frontend Integration Points

#### 2.1 Extended Node Data Types

**File: `frontend/src/features/scenario-builder/types/scenario.ts`**

```typescript
// Extend CommandNode type
export interface CommandNode extends Node {
  data: {
    // EXISTING:
    command: "MakeCall" | "Answer" | "Release"
           | "PlayMedia" | "Record" | "StopRecord" | "SendDTMF";  // NEW
    sipInstanceId: string;
    label: string;
    targetUri?: string;
    timeout?: number;

    // NEW FIELDS:
    mediaPath?: string;      // PlayMedia: selected WAV file
    recordPath?: string;     // Record: output filename
    dtmfDigits?: string;     // SendDTMF: digits to send
  };
}

// Extend EventNode type
export interface EventNode extends Node {
  data: {
    event: "INCOMING" | "DISCONNECTED" | "RINGING" | "TIMEOUT"
         | "DTMF_RECEIVED" | "RECORD_COMPLETED";  // NEW
    sipInstanceId: string;
    label: string;
    timeout?: number;

    // NEW FIELDS:
    dtmfDigit?: string;      // DTMF_RECEIVED: expected digit (optional)
  };
}

// Extend SipInstanceNode type
export interface SipInstanceNode extends Node {
  data: {
    // EXISTING:
    label: string;
    mode: "DN" | "Endpoint";
    dn: string;
    register: boolean;
    color: string;

    // NEW:
    codecs: Array<"PCMU" | "PCMA" | "Opus">;  // Codec preferences
  };
}
```

#### 2.2 Command Node Component Extension

**File: `frontend/src/features/scenario-builder/components/nodes/command-node.tsx`**

```typescript
// Add new icons
import { Play, Mic, Hash, Phone, PhoneIncoming, PhoneOff } from 'lucide-react';

const COMMAND_ICONS = {
  MakeCall: Phone,
  Answer: PhoneIncoming,
  Release: PhoneOff,
  PlayMedia: Play,      // NEW
  Record: Mic,          // NEW
  StopRecord: Mic,      // NEW
  SendDTMF: Hash,       // NEW
} as const;

// Render media-specific details
export function CommandNode({ data, id }: NodeProps<CommandNodeType>) {
  // ... existing code ...

  return (
    <div className={/* ... */}>
      {/* Existing renders */}

      {/* NEW: Media playback details */}
      {data.command === 'PlayMedia' && data.mediaPath && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground">
            File: {path.basename(data.mediaPath)}
          </div>
        </div>
      )}

      {/* NEW: DTMF digits */}
      {data.command === 'SendDTMF' && data.dtmfDigits && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground">
            Digits: {data.dtmfDigits}
          </div>
        </div>
      )}

      {/* NEW: Recording output */}
      {data.command === 'Record' && data.recordPath && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground">
            Save as: {data.recordPath}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Node Palette Extension

**Add media commands to palette:**

```typescript
const MEDIA_COMMANDS = [
  { type: 'command', command: 'PlayMedia', label: 'Play Media', icon: Play },
  { type: 'command', command: 'Record', label: 'Record', icon: Mic },
  { type: 'command', command: 'StopRecord', label: 'Stop Record', icon: Mic },
  { type: 'command', command: 'SendDTMF', label: 'Send DTMF', icon: Hash },
];

const MEDIA_EVENTS = [
  { type: 'event', event: 'DTMF_RECEIVED', label: 'DTMF Received' },
  { type: 'event', event: 'RECORD_COMPLETED', label: 'Record Completed' },
];
```

#### 2.4 Node Configuration Panel

**New Component: `MediaConfigPanel.tsx`**

```typescript
export function MediaConfigPanel({ node }: { node: CommandNode }) {
  const { updateNodeData } = useScenarioStore();
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);

  // Fetch media files from backend
  useEffect(() => {
    window.backend.ListMediaFiles().then(setMediaFiles);
  }, []);

  if (node.data.command === 'PlayMedia') {
    return (
      <div className="space-y-2">
        <Label>Media File</Label>
        <Select
          value={node.data.mediaPath}
          onValueChange={(path) => updateNodeData(node.id, { mediaPath: path })}
        >
          {mediaFiles.map((file) => (
            <SelectItem key={file} value={file}>{file}</SelectItem>
          ))}
        </Select>
        <Button onClick={selectMediaFile}>Browse...</Button>
      </div>
    );
  }

  if (node.data.command === 'SendDTMF') {
    return (
      <div className="space-y-2">
        <Label>DTMF Digits</Label>
        <Input
          value={node.data.dtmfDigits || ''}
          onChange={(e) => updateNodeData(node.id, { dtmfDigits: e.target.value })}
          placeholder="123#*ABC"
          pattern="[0-9#*A-D]+"
        />
      </div>
    );
  }

  // ... other command configurations
}
```

#### 2.5 SIP Instance Codec Configuration

**Component: `SipInstanceConfigPanel.tsx`**

```typescript
export function CodecSelector({ node }: { node: SipInstanceNode }) {
  const { updateNodeData } = useScenarioStore();

  const availableCodecs = [
    { value: 'PCMU', label: 'PCMU (G.711 μ-law)' },
    { value: 'PCMA', label: 'PCMA (G.711 A-law)' },
    { value: 'Opus', label: 'Opus' },
  ];

  return (
    <div className="space-y-2">
      <Label>Codecs (priority order)</Label>
      <DragDropList
        items={node.data.codecs || ['PCMU', 'PCMA']}
        onChange={(codecs) => updateNodeData(node.id, { codecs })}
        renderItem={(codec) => (
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4" />
            {availableCodecs.find(c => c.value === codec)?.label}
          </div>
        )}
      />
    </div>
  );
}
```

#### 2.6 Execution Events Extension

**File: `frontend/src/features/scenario-builder/store/execution-store.ts`**

```typescript
// Add new event listener for media progress
EventsOn('scenario:media-progress', (data: {
  nodeId: string;
  progress: number;      // 0-100
  duration: number;      // total ms
  elapsed: number;       // elapsed ms
}) => {
  set((state) => ({
    mediaProgress: {
      ...state.mediaProgress,
      [data.nodeId]: data,
    },
  }));
});
```

**Backend Event Emission:**

```go
// In executePlayMedia(), emit progress updates
func (ex *Executor) executePlayMedia(...) error {
    // ... setup code ...

    // Emit progress updates every 500ms
    ticker := time.NewTicker(500 * time.Millisecond)
    defer ticker.Stop()

    for {
        select {
        case <-playback.Done():
            ex.engine.emitMediaProgress(node.ID, 100, duration, duration)
            return nil
        case <-ticker.C:
            elapsed := playback.Position()
            progress := (elapsed * 100) / duration
            ex.engine.emitMediaProgress(node.ID, progress, duration, elapsed)
        case <-ctx.Done():
            playback.Stop()
            return ctx.Err()
        }
    }
}

// events.go
func (e *Engine) emitMediaProgress(nodeID string, progress, duration, elapsed int) {
    if e.emitter != nil {
        e.emitter.Emit("scenario:media-progress", map[string]interface{}{
            "nodeId":   nodeID,
            "progress": progress,
            "duration": duration,
            "elapsed":  elapsed,
        })
    }
}
```

## Component Integration Matrix

| Component | Modification Type | Files Changed | New Files |
|-----------|------------------|---------------|-----------|
| **GraphNode** | Extend struct | `graph.go` | - |
| **Executor** | Add command/event handlers | `executor.go` | - |
| **SessionStore** | Add recording management | `executor.go` | - |
| **InstanceManager** | Add codec config | `instance_manager.go` | - |
| **EventEmitter** | Add media events | `events.go` | - |
| **AssetManager** | New component | - | `internal/media/asset_manager.go` |
| **MediaBinding** | New Wails binding | - | `internal/binding/media.go` |
| **Command Node UI** | Extend component | `command-node.tsx` | - |
| **Event Node UI** | Extend component | `event-node.tsx` | - |
| **Instance Node UI** | Add codec selector | `sip-instance-node.tsx` | `CodecSelector.tsx` |
| **Node Palette** | Add media commands/events | `node-palette.tsx` | - |
| **Config Panels** | New media config panels | - | `MediaConfigPanel.tsx` |
| **TypeScript Types** | Extend node types | `scenario.ts` | - |
| **Execution Store** | Add media state | `execution-store.ts` | - |

## Data Flow Diagrams

### PlayMedia Command Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: User drags PlayMedia node to canvas               │
│ - Select WAV file via MediaConfigPanel                      │
│ - Store mediaPath in node.data                              │
└────────────────────┬────────────────────────────────────────┘
                     │ Save scenario
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: Engine.StartScenario()                             │
│ 1. ParseScenario() → GraphNode with MediaPath               │
│ 2. CreateInstances() → diago UA instances                   │
│ 3. StartServing() → goroutines per instance                 │
└────────────────────┬────────────────────────────────────────┘
                     │ Execution reaches PlayMedia node
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Executor.executePlayMedia()                                 │
│ 1. Get dialog from SessionStore                             │
│ 2. Access dialog.Media() → DialogMedia                      │
│ 3. Open WAV file (node.MediaPath)                           │
│ 4. media.PlaybackCreate(file) → Playback object             │
│ 5. Wait for playback.Done() or context cancel               │
│ 6. Emit progress events every 500ms                         │
└────────────────────┬────────────────────────────────────────┘
                     │ Emit events
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: ExecutionStore receives media-progress events     │
│ - Update progress bar on PlayMedia node                     │
│ - Show elapsed/total time                                   │
└─────────────────────────────────────────────────────────────┘
```

### Record Command Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: User adds Record node after Answer                │
│ - Specify output filename (optional, auto-generated)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Executor.executeRecord()                                    │
│ 1. Get dialog from SessionStore                             │
│ 2. Generate recording path via AssetManager                 │
│ 3. Create output file (WAV)                                 │
│ 4. media.AudioStereoRecordingCreate(file)                   │
│ 5. Store RecordingSession in SessionStore                   │
│ 6. Return immediately (recording in background)             │
└────────────────────┬────────────────────────────────────────┘
                     │ Recording active
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Executor.executeStopRecord()                                │
│ 1. Get RecordingSession from SessionStore                   │
│ 2. Stop recording, close file                               │
│ 3. Emit RECORD_COMPLETED event                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Show "Recording saved: filename.wav"              │
└─────────────────────────────────────────────────────────────┘
```

### SendDTMF Command Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: User configures SendDTMF node with digits "123#"  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Executor.executeSendDTMF()                                  │
│ 1. Get dialog from SessionStore                             │
│ 2. Access media.AudioWriterDTMF() → DTMFWriter              │
│ 3. For each digit in node.DTMFDigits:                       │
│    - dtmfWriter.WriteDTMF(digit)                            │
│    - time.Sleep(100ms)  // Inter-digit delay                │
│ 4. Return success                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Remote SIP endpoint receives RTP DTMF events                │
└─────────────────────────────────────────────────────────────┘
```

### DTMF_RECEIVED Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Remote SIP endpoint sends DTMF "1"                          │
└────────────────────┬────────────────────────────────────────┘
                     │ RTP DTMF packet
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Executor.executeDTMFReceived()                              │
│ 1. Get dialog from SessionStore                             │
│ 2. Access media.AudioReaderDTMF() → DTMFReader              │
│ 3. Wait for digit: <-dtmfReader.DTMF()                      │
│ 4. If expectedDigit matches or empty, success               │
│ 5. Emit action log: "DTMF received: 1"                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Show DTMF received in log panel                   │
└─────────────────────────────────────────────────────────────┘
```

### Codec Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: User drags codec order in SIP Instance config     │
│ - Default: [PCMU, PCMA]                                     │
│ - User reorders: [Opus, PCMU, PCMA]                         │
│ - Saved in node.data.codecs                                 │
└────────────────────┬────────────────────────────────────────┘
                     │ Save scenario
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: ParseScenario()                                    │
│ - Extract codecs from sipInstance node data                 │
│ - Store in SipInstanceConfig.Codecs                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ InstanceManager.CreateInstances()                           │
│ 1. convertCodecs(config.Codecs) → diago codec constants     │
│ 2. Create MediaConfig with ordered codec list               │
│ 3. diago.NewDiago(..., WithMediaConfig(mediaConfig))        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ diago negotiates SDP with ordered codec preferences         │
│ - Offer includes Opus first, then PCMU, then PCMA           │
│ - Remote responds with matching codec                       │
└─────────────────────────────────────────────────────────────┘
```

## File Asset Management Strategy

### Directory Structure

```
~/.sipflow/
├── media/                 # User's media library
│   ├── greeting.wav
│   ├── hold_music.wav
│   ├── ivr_menu.wav
│   └── recordings/        # Auto-generated recordings
│       ├── rec_inst1_20260211_143022.wav
│       └── rec_inst2_20260211_143145.wav
└── sipflow.db             # SQLite database
```

### Asset Resolution Strategy

**Approach 1: Absolute Paths (Recommended)**
- Store absolute paths in scenario JSON
- Pros: Simple, no resolution needed
- Cons: Scenarios not portable across machines

**Approach 2: Relative Paths + Base Directory**
- Store relative paths (e.g., "greeting.wav")
- Resolve at runtime: `~/.sipflow/media/` + filename
- Pros: More portable
- Cons: Requires asset copying when sharing scenarios

**Recommendation:** Start with Approach 1 for MVP. Add Approach 2 + asset export/import in future milestone.

### File Validation

```go
func (am *AssetManager) ValidateMediaFile(path string) error {
    // 1. Check file exists
    stat, err := os.Stat(path)
    if err != nil {
        return fmt.Errorf("file not found: %w", err)
    }

    // 2. Check file size (max 100MB)
    if stat.Size() > 100*1024*1024 {
        return fmt.Errorf("file too large: %d MB", stat.Size()/1024/1024)
    }

    // 3. Check WAV header
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()

    header := make([]byte, 12)
    if _, err := file.Read(header); err != nil {
        return err
    }

    if string(header[0:4]) != "RIFF" || string(header[8:12]) != "WAVE" {
        return fmt.Errorf("invalid WAV file")
    }

    return nil
}
```

## Codec Configuration Details

### Supported Codecs (diago v0.17.0+)

| Codec | Constant | Sampling Rate | Use Case |
|-------|----------|---------------|----------|
| PCMU | `media.CodecAudioPCMU` | 8 kHz | Standard telephony (G.711 μ-law) |
| PCMA | `media.CodecAudioPCMA` | 8 kHz | European telephony (G.711 A-law) |
| Opus | `media.CodecAudioOpus` | 8-48 kHz | High-quality, low-bandwidth |

**Opus Build Note:** Requires `-tags with_opus_c` and Opus development libraries.

### Default Codec Strategy

```go
// Default codec preferences (if user doesn't configure)
var DefaultCodecs = []string{
    media.CodecAudioPCMU,  // Most compatible
    media.CodecAudioPCMA,  // Fallback
}

// Codec priority affects SDP offer/answer negotiation
// First codec in list = highest priority in SDP m= line
```

### Codec Mismatch Handling

```go
// diago will return error if codecs don't match in bridge scenarios
// SIPFLOW doesn't bridge calls in v1.1, so no transcoding needed
// Each instance negotiates independently with remote endpoint
```

## Testing Strategy

### Unit Tests (Go)

**Test Coverage:**
- `executePlayMedia()` with mock file
- `executeSendDTMF()` with test digits
- `executeRecord()` / `executeStopRecord()` lifecycle
- `executeDTMFReceived()` with simulated DTMF
- `AssetManager.ResolveMediaPath()` edge cases
- Codec configuration parsing

**Example Test:**
```go
func TestExecutePlayMedia(t *testing.T) {
    // Setup mock dialog with Media()
    mockDialog := &MockDialogSession{
        media: &MockDialogMedia{
            playbackDone: make(chan struct{}),
        },
    }

    // Create test WAV file
    tmpFile := createTestWAV(t)
    defer os.Remove(tmpFile)

    // Execute
    node := &GraphNode{
        Command:   "PlayMedia",
        MediaPath: tmpFile,
    }
    err := executor.executePlayMedia(ctx, "inst1", node)

    assert.NoError(t, err)
    assert.True(t, mockDialog.media.playbackCalled)
}
```

### Integration Tests (Go)

**Test Scenarios:**
1. MakeCall → PlayMedia → Release
2. Answer → Record → (wait 5s) → StopRecord → Release
3. Answer → SendDTMF("123#") → Release
4. Answer → (wait for DTMF) → DTMF_RECEIVED → Release
5. MakeCall with custom codec order → verify SDP

### E2E Tests (Frontend + Backend)

**Test Flow:**
1. Create scenario with PlayMedia node
2. Select WAV file via MediaConfigPanel
3. Save scenario
4. Start execution
5. Verify media progress events received
6. Verify playback completion

## Build Order Recommendation

### Phase 1: Codec Configuration (Foundational)
**Rationale:** Codec setup affects all media operations. Must be first.

1. Extend `SipInstanceConfig` with `Codecs` field
2. Modify `InstanceManager.CreateInstances()` to apply `MediaConfig`
3. Add `convertCodecs()` helper
4. Add codec selector UI to SIP Instance node
5. Unit tests for codec parsing

**Deliverable:** SIP instances created with custom codec preferences

### Phase 2: Asset Management (Infrastructure)
**Rationale:** Required before any media playback/recording.

1. Create `internal/media/asset_manager.go`
2. Implement `ResolveMediaPath()`, `ListMediaFiles()`, `GenerateRecordingPath()`
3. Create `internal/binding/media.go` Wails binding
4. Add file validation logic
5. Unit tests for asset manager

**Deliverable:** Backend can resolve and list WAV files

### Phase 3: PlayMedia Command (Core Feature)
**Rationale:** Most visible feature, demonstrates media integration.

1. Extend `GraphNode` with `MediaPath` field
2. Add `executePlayMedia()` to `executor.go`
3. Add `PlayMedia` to `executeCommand()` switch
4. Add media progress event emission
5. Add `PlayMedia` to frontend command node
6. Add `MediaConfigPanel` for file selection
7. Add progress bar UI
8. Integration test: MakeCall → PlayMedia → Release

**Deliverable:** Users can play WAV files during calls

### Phase 4: DTMF Sending (Quick Win)
**Rationale:** Simple, no file I/O, high user value.

1. Extend `GraphNode` with `DTMFDigits` field
2. Add `executeSendDTMF()` to `executor.go`
3. Add `SendDTMF` to frontend command node
4. Add DTMF digit input to `MediaConfigPanel`
5. Integration test: Answer → SendDTMF → Release

**Deliverable:** Users can send DTMF tones

### Phase 5: DTMF Receiving (Event Extension)
**Rationale:** Complements DTMF sending, enables IVR scenarios.

1. Extend `GraphNode` with `DTMFDigit` field (optional)
2. Add `executeDTMFReceived()` to `executor.go`
3. Add `DTMF_RECEIVED` event to frontend
4. Add expected digit input to event config panel
5. Integration test: Answer → DTMF_RECEIVED → Release

**Deliverable:** Users can wait for DTMF input

### Phase 6: Recording (Complex Feature)
**Rationale:** Requires session lifecycle management, most complex.

1. Extend `SessionStore` with `RecordingSession` map
2. Add `StartRecording()` / `StopRecording()` methods
3. Extend `GraphNode` with `RecordPath` field
4. Add `executeRecord()` / `executeStopRecord()` to `executor.go`
5. Add `Record` / `StopRecord` commands to frontend
6. Add recording filename input to `MediaConfigPanel`
7. Add `RECORD_COMPLETED` event (optional)
8. Integration test: Answer → Record → wait → StopRecord → Release

**Deliverable:** Users can record calls to WAV files

### Phase 7: Polish and Documentation
**Rationale:** Production readiness.

1. Add validation for media file paths in scenario validation
2. Add error handling for missing files
3. Add loading states for media file list
4. Add recording playback preview (optional)
5. Update user documentation
6. Add tooltips and help text

**Deliverable:** Production-quality media features

## Known Limitations and Future Considerations

### Current Limitations

1. **No Transcoding:** Each instance must negotiate compatible codec with remote endpoint. No transcoding between instances in multi-party scenarios.

2. **WAV Format Only:** diago currently supports WAV (PCM 16-bit). No MP3/OGG support.

3. **Stereo Recording Only:** `AudioStereoRecordingCreate()` is the only recording API (as of diago v0.17.0). Mono recording requires custom implementation.

4. **No Playback Control:** `PlaybackCreate()` lacks pause/resume. Must use `PlaybackControlCreate()` for mute/unmute.

5. **No Progress Callback:** diago doesn't provide playback position callback. Must poll or estimate.

6. **File Size Limits:** Large WAV files (>100MB) may cause memory issues. Need validation.

### Future Enhancements

1. **Audio Transcoding:** Use ffmpeg-go for format conversion (WAV ↔ MP3 ↔ OGG).

2. **Text-to-Speech:** Integrate TTS engine for dynamic prompts.

3. **Audio Mixer:** Combine multiple audio sources (background music + TTS).

4. **Waveform Visualization:** Show audio waveform in PlayMedia node.

5. **Recording Playback:** Play recorded files directly in UI.

6. **Asset Library Management:** Import/export media assets with scenarios.

7. **Codec Quality Presets:** "High Quality" (Opus 48kHz) vs "Telephony" (PCMU 8kHz).

## Architectural Risks and Mitigations

### Risk 1: File Path Portability
**Issue:** Scenarios with absolute paths won't work on different machines.

**Mitigation:** Phase 1 (MVP): Store absolute paths, document limitation. Phase 2: Add asset export/import feature.

### Risk 2: Large File Memory Usage
**Issue:** Loading 100MB WAV into memory could cause OOM.

**Mitigation:** Add file size validation (max 100MB). Use streaming playback (diago already does this).

### Risk 3: Recording Session Cleanup
**Issue:** If scenario stops during recording, file may be corrupted or not closed.

**Mitigation:** Add cleanup logic in `Executor.sessions.CloseAll()` to stop all recordings and close files.

### Risk 4: DTMF Timing
**Issue:** Inter-digit delay affects DTMF recognition by remote systems.

**Mitigation:** Add configurable inter-digit delay (default 100ms). Make it a node property.

### Risk 5: Codec Negotiation Failures
**Issue:** If user selects Opus but remote only supports PCMU, call fails.

**Mitigation:** Add fallback logic in codec list. Default: [Opus, PCMU, PCMA]. Document codec compatibility.

### Risk 6: diago API Changes
**Issue:** diago is actively developed. API may break in future versions.

**Mitigation:** Pin diago version in go.mod. Add integration tests that fail on API breakage.

## Confidence Assessment

| Domain | Confidence | Rationale |
|--------|------------|-----------|
| **diago Media API** | HIGH | Official documentation and source code reviewed. DialogMedia methods confirmed. |
| **Codec Support** | HIGH | Diago documentation lists PCMU, PCMA, Opus. Build requirements clear. |
| **Recording API** | MEDIUM | `AudioStereoRecordingCreate()` confirmed in v0.17.0. API young, may evolve. |
| **DTMF Methods** | HIGH | `AudioReaderDTMF()` / `AudioWriterDTMF()` documented and in examples. |
| **File Management** | HIGH | Standard Go file I/O patterns. Well-established practices. |
| **Frontend Integration** | HIGH | Existing node extension pattern clear. TypeScript types straightforward. |
| **Build Order** | HIGH | Phases ordered by dependency. Codec → Assets → PlayMedia → DTMF → Recording. |

## Sources

### Diago Library Documentation
- [Diago GitHub Repository](https://github.com/emiago/diago)
- [Diago Media Codecs Documentation](https://emiago.github.io/diago/docs/media_codecs/)
- [Diago API Documentation](https://emiago.github.io/diago/docs/api_docs/)
- [Diago dialog_media.go Source](https://github.com/emiago/diago/blob/main/dialog_media.go)
- [Diago Release v0.17.0 Notes](https://github.com/emiago/diago/releases/tag/v0.17.0)
- [DTMF Examples](https://pkg.go.dev/github.com/emiago/diago/examples/dtmf)

### RTP and Media Architecture
- [emiago/media - Go RTP/RTCP Library](https://github.com/emiago/media)
- [GoRTP - RTP Stack for Go](https://github.com/wernerd/GoRTP)
- [Pion RTP Implementation](https://github.com/pion/rtp)

### SIP Recording Best Practices
- [VoIP SIP SDK - Recording Voice Calls](https://voip-sip-sdk.com/p_7362-how-to-record-voip-sip-voice-call.html)
- [VoIP File Formats (WAV, MP3)](https://voip-sip-sdk.com/p_7314-voip-file-formats.html)
- [RFC 6341 - SIPREC Use Cases](https://datatracker.ietf.org/doc/html/rfc6341)

### Go Best Practices
- [Go Project Layout Standards](https://github.com/golang-standards/project-layout)
- [Go File Handling Best Practices](https://jsschools.com/golang/go_file_handling_best_practices_essential_patterns_for_robust_production_applications/)
- [Go Folder Structure Practices](https://www.codingexplorations.com/blog/managing-files-in-a-go-api-folder-structure-best-practices-for-organizing-your-project)

---

**Next Steps:** Proceed to roadmap generation with phases structured according to the Build Order recommendation.
