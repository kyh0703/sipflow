# Phase 13: 새 노드 UI + 통합 & 품질 - Research

**Researched:** 2026-02-20
**Domain:** React Flow 노드 UI 패턴 / Go 단위 테스트 / 하위 호환성
**Confidence:** HIGH (코드베이스 직접 분석 기반)

## Summary

Phase 13은 기존 코드베이스에 이미 부분적으로 구현된 기능을 완성하는 작업이다.
분석 결과, 새 6개 노드(Hold, Retrieve, BlindTransfer, TransferEvent, HeldEvent, RetrievedEvent)는
**이미 백엔드에 완전히 구현**되어 있고, **프론트엔드에는 팔레트/아이콘은 있으나 Properties 패널이 누락**되어 있다.
Go 테스트도 Phase 10/11에서 Hold/Retrieve/BlindTransfer/TransferEvent에 대해 이미 추가되었으나,
파라미터 파싱 및 properties panel의 UI-side 연결이 완성되어야 한다.

핵심 발견:
1. `node-palette.tsx`에 HELD, RETRIEVED, TRANSFERRED 이벤트 팔레트 항목이 이미 존재한다
2. `event-node.tsx`의 `EVENT_ICONS`에 Pause(HELD), Play(RETRIEVED), ArrowRightLeft(TRANSFERRED)가 이미 매핑되어 있다
3. `command-node.tsx`의 `COMMAND_ICONS`에 Hold, Retrieve, BlindTransfer가 **누락**되어 있다
4. `command-properties.tsx`에 Hold, Retrieve, BlindTransfer 분기가 **완전히 누락**되어 있다
5. `scenario.ts`의 `COMMAND_TYPES`에 Hold, Retrieve, BlindTransfer가 **누락**되어 있다 (타입 시스템 불일치)
6. `node-palette.tsx`에 command-Hold, command-Retrieve, command-BlindTransfer 팔레트 항목이 **누락**되어 있다
7. 하위 호환성(v1.1 포맷)은 `ParseScenario`에서 JSON 필드를 `map[string]interface{}`로 직접 파싱하므로 자동 보장된다
8. `TestIntegration_TwoPartyCallSimulation` 테스트가 현재 FAIL 상태이다 (Phase 13과 관련 없는 TIMEOUT context deadline exceeded 문제)

**주요 권장사항:** Command 노드 측 UI 갭(COMMAND_TYPES, COMMAND_ICONS, command-palette items, command-properties 분기)을 먼저 채우고, BlindTransfer 전용 Properties 필드(targetUser, targetHost)를 추가한 다음, Go 테스트를 확인하라.

---

## User Constraints

CONTEXT.md 없음 — 이 페이즈는 ROADMAP의 요구사항에 따라 범위가 정의된다.

---

## Standard Stack

이 페이즈에서 사용하는 기술은 기존 코드베이스 스택과 동일하다.

### Core (기존 코드베이스에서 확정됨)

| 라이브러리 | 버전(package.json) | 목적 | 비고 |
|-----------|-------------------|------|------|
| @xyflow/react | (기존) | React Flow 노드 렌더링 | 변경 없음 |
| lucide-react | (기존) | 노드 아이콘 | 기존 아이콘 풀 사용 |
| shadcn/ui (new-york) | (기존) | Properties 패널 Input/Label/Badge/Select | 변경 없음 |
| sonner | (기존) | 토스트 알림 | 변경 없음 |
| zustand | (기존) | 상태 관리 | 변경 없음 |

### Go Backend (기존 확정)

| 패키지 | 목적 |
|-------|------|
| testing (standard library) | 단위 테스트 |
| sipflow/internal/engine | executor, graph, session |

---

## Architecture Patterns

### 1. 노드 타입 등록 패턴

**설명:** `nodeTypes`는 `nodes/index.ts`에서 컴포넌트 외부에 stable reference로 정의된다.
새 노드 타입이 필요한 경우 여기에 추가한다. 그러나 이 프로젝트는 `sipInstance`, `command`, `event` 3개 타입만 사용하며, 새 노드는 기존 `command` / `event` 타입에 매핑된다.

**신규 노드 추가 시 변경 파일 목록:**

```
프론트엔드 (4개 파일):
1. frontend/src/features/scenario-builder/types/scenario.ts
   - COMMAND_TYPES에 'Hold' | 'Retrieve' | 'BlindTransfer' 추가
   - CommandNodeData에 targetUser?, targetHost? 필드 추가 (BlindTransfer용)

2. frontend/src/features/scenario-builder/components/nodes/command-node.tsx
   - COMMAND_ICONS에 Hold, Retrieve, BlindTransfer 아이콘 추가

3. frontend/src/features/scenario-builder/components/node-palette.tsx
   - Commands 섹션에 Hold, Retrieve, BlindTransfer 팔레트 항목 추가

4. frontend/src/features/scenario-builder/components/properties/command-properties.tsx
   - Hold, Retrieve, BlindTransfer 분기 추가

백엔드 (Go, 1개 파일):
5. internal/engine/executor_test.go
   - BlindTransfer 파라미터 파싱 테스트 (graph_test.go에 이미 TestParseScenario_BlindTransferFields 있음)
   - Hold/Retrieve에 대한 추가 테스트 확인
```

### 2. 팔레트 항목 등록 패턴

**드래그앤드롭 타입 문자열 포맷:** `"command-{CommandName}"` 또는 `"event-{EventName}"`

`canvas.tsx`의 `onDrop` 핸들러:
```typescript
// 소스: frontend/src/features/scenario-builder/components/canvas.tsx L75-L95
} else if (dragType.startsWith('command-')) {
  const commandName = dragType.replace('command-', '');
  nodeType = 'command';
  nodeData = {
    label: commandName,
    command: commandName,
  };
} else if (dragType.startsWith('event-')) {
  const eventName = dragType.replace('event-', '');
  nodeType = 'event';
  nodeData = {
    label: eventName,
    event: eventName,
  };
}
```

팔레트 항목 추가 시 `type` prop에 `"command-Hold"`, `"command-Retrieve"`, `"command-BlindTransfer"` 형태를 사용한다. 이미 존재하는 패턴이므로 코드 변경 없이 데이터만 추가하면 된다.

### 3. Command 노드 아이콘 패턴

**설명:** `command-node.tsx`의 `COMMAND_ICONS`는 명령어 이름을 lucide-react 아이콘 컴포넌트에 매핑한다.

```typescript
// 소스: frontend/src/features/scenario-builder/components/nodes/command-node.tsx L7-L13
const COMMAND_ICONS = {
  MakeCall: Phone,
  Answer: PhoneIncoming,
  Release: PhoneOff,
  PlayAudio: Volume2,
  SendDTMF: Hash,
  // 추가 필요:
  Hold: Pause,
  Retrieve: Play,
  BlindTransfer: ArrowRightLeft,
} as const;
```

**이미 `event-node.tsx`에서 Pause, Play, ArrowRightLeft가 import되어 있음** — command-node.tsx에도 동일한 import 추가 필요.

### 4. Event 노드 아이콘 패턴 (이미 완성)

`event-node.tsx`에 HELD(Pause), RETRIEVED(Play), TRANSFERRED(ArrowRightLeft)가 이미 존재한다.

```typescript
// 소스: frontend/src/features/scenario-builder/components/nodes/event-node.tsx L17-L27
const EVENT_ICONS = {
  INCOMING: Bell,
  DISCONNECTED: PhoneMissed,
  RINGING: BellRing,
  TIMEOUT: Clock,
  HELD: Pause,          // 이미 존재
  RETRIEVED: Play,       // 이미 존재
  TRANSFERRED: ArrowRightLeft, // 이미 존재
  NOTIFY: MessageSquare,
  DTMFReceived: Ear,
} as const;
```

### 5. Properties 패널 분기 패턴

**설명:** `command-properties.tsx`는 `data.command` 값에 따라 조건부 필드를 렌더링한다.

기존 패턴 (SendDTMF 예시):
```typescript
// 소스: frontend/src/features/scenario-builder/components/properties/command-properties.tsx L157-L196
{data.command === 'SendDTMF' && (
  <>
    <div className="space-y-2">
      <Label htmlFor="digits">Digits</Label>
      <Input
        id="digits"
        value={data.digits || ''}
        onChange={(e) => { ... }}
      />
    </div>
  </>
)}
```

Hold와 Retrieve는 파라미터 없으므로 분기 불필요 (빈 상태로 SIP Instance만 선택). BlindTransfer는 `targetUser`와 `targetHost` 두 Input 필드가 필요.

### 6. 하위 호환성 패턴

**설명:** `ParseScenario`(`graph.go`)가 `map[string]interface{}`로 데이터를 파싱한다. 없는 필드는 기본값을 반환하므로 신규 필드 추가가 구 포맷에 영향을 주지 않는다.

```go
// 소스: internal/engine/graph.go L127-L143
if node.Type == "command" {
  gnode.Command = getStringField(node.Data, "command", "")
  gnode.TargetUser = getStringField(node.Data, "targetUser", "")  // Phase 11 추가
  gnode.TargetHost = getStringField(node.Data, "targetHost", "")  // Phase 11 추가
  // ...
}
```

v1.1 시나리오(PlayAudio, SendDTMF, DTMFReceived 포함)가 v1.2에서 정상 동작하는 이유: `getStringField`는 필드가 없으면 defaultVal("")을 반환하므로 기존 필드 누락이 에러를 발생시키지 않는다.

### 7. Go 테스트 패턴

**설명:** `executor_test.go`의 기존 테스트는 3가지 패턴을 사용한다.

패턴 A: 핸들러 직접 호출 (dialog 없음 → 에러 확인)
```go
// 소스: internal/engine/executor_test.go L421-L435
func TestExecuteHold_NoDialog(t *testing.T) {
  ex, _ := newTestExecutor(t)
  node := &GraphNode{
    ID:      "test-node",
    Type:    "command",
    Command: "Hold",
  }
  err := ex.executeHold(context.Background(), "inst-1", node)
  if err == nil {
    t.Fatal("expected error for missing dialog")
  }
  if !strings.Contains(err.Error(), "no active dialog") {
    t.Errorf("expected 'no active dialog' error, got: %v", err)
  }
}
```

패턴 B: executeCommand switch 라우팅 확인
```go
// 소스: internal/engine/executor_test.go L455-L471
func TestExecuteCommand_HoldSwitch(t *testing.T) {
  ex, _ := newTestExecutor(t)
  node := &GraphNode{...Command: "Hold"...}
  err := ex.executeCommand(context.Background(), "inst-1", node)
  // 에러는 예상되지만 Hold 핸들러까지 도달 확인
  if !strings.Contains(err.Error(), "no active dialog") { ... }
}
```

패턴 C: SIP 이벤트 버스 타임아웃 확인
```go
// 소스: internal/engine/executor_test.go L492-L510
func TestExecuteEvent_HeldSwitch(t *testing.T) {
  ex, _ := newTestExecutor(t)
  node := &GraphNode{...Event: "HELD", Timeout: 100*time.Millisecond...}
  err := ex.executeEvent(context.Background(), "inst-1", node)
  if !strings.Contains(err.Error(), "HELD event timeout") { ... }
}
```

**TestParseScenario_BlindTransferFields** (`graph_test.go`)도 이미 존재하여 파라미터 파싱을 검증한다.

### 8. 추가 필요한 Go 테스트 (NF-01 요구사항)

현재 누락된 테스트:
- `TestParseScenario_HoldFields` — Hold 커맨드 파싱 (파라미터 없으므로 간단)
- `TestParseScenario_RetrieveFields` — Retrieve 커맨드 파싱
- `TestExecuteEvent_HeldEvent_Success` / `_Timeout` — HeldEvent 이벤트 버스
- `TestExecuteEvent_RetrievedEvent_Success` / `_Timeout` — RetrievedEvent 이벤트 버스
- `TestExecuteEvent_TransferEventSwitch` — TransferEvent 이미 존재 (`TestExecuteEvent_TransferredSwitch`)

실제 현황: Hold/Retrieve/BlindTransfer/HELD/RETRIEVED/TRANSFERRED에 대한 기본 테스트는 **이미 존재**한다. NF-01이 요구하는 추가 커버리지는 파라미터 파싱 및 경계 케이스이다.

---

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|------------|---------|------|
| 노드 아이콘 | SVG 직접 작성 | lucide-react 기존 아이콘 | 이미 event-node.tsx에서 Pause/Play/ArrowRightLeft를 import 중 |
| 팔레트 섹션 컴포넌트 | 새 컴포넌트 | 기존 `Section` 컴포넌트 재사용 | node-palette.tsx 내부에 이미 정의됨 |
| 드래그앤드롭 | 새 DnD 구현 | 기존 `useDnD` hook + dataTransfer 패턴 | canvas.tsx onDrop이 이미 command-/event- 파싱 처리 |
| 테스트 setup | 새 DB/엔진 setup | `newTestExecutor(t)` helper | integration_test.go에서 이미 정의됨 |
| 하위 호환성 변환 | 마이그레이션 코드 | 없음 — 현재 파서가 이미 처리 | getStringField 기본값이 구 포맷을 자동 지원 |

---

## Common Pitfalls

### 함정 1: COMMAND_TYPES 타입 상수 업데이트 누락

**발생하는 문제:** `scenario.ts`의 `COMMAND_TYPES`가 `['MakeCall', 'Answer', 'Release', 'PlayAudio', 'SendDTMF']`만 포함. `CommandNodeData`의 `command` 타입이 이 union에 기반하므로 Hold/Retrieve/BlindTransfer를 추가하지 않으면 TypeScript 타입 에러 발생.

**발생 이유:** Phase 10/11에서 백엔드만 구현되고 프론트엔드 타입 정의 업데이트가 누락됨.

**피하는 방법:** `scenario.ts`의 `COMMAND_TYPES`를 먼저 업데이트하고 TypeScript 컴파일러 에러로 누락 위치 탐지.

**경고 신호:** `Type '"Hold"' is not assignable to type '"MakeCall" | "Answer" | ...` 타입 에러.

### 함정 2: command-node.tsx에 아이콘 import 누락

**발생하는 문제:** `COMMAND_ICONS`에 `Hold: Pause`, `Retrieve: Play`, `BlindTransfer: ArrowRightLeft`를 추가해도 lucide-react에서 import하지 않으면 런타임 에러.

**발생 이유:** `event-node.tsx`에는 Pause/Play/ArrowRightLeft가 있지만 `command-node.tsx`에는 없다.

**피하는 방법:** `command-node.tsx` 상단 import 구문에 `Pause, Play, ArrowRightLeft`를 추가.

### 함정 3: BlindTransfer Properties에서 targetUser/targetHost vs targetUri 혼동

**발생하는 문제:** MakeCall은 `targetUri`(전체 URI) 사용, BlindTransfer는 `targetUser` + `targetHost` (분리된 두 필드) 사용.

**발생 이유:** `executor.go`의 `executeBlindTransfer`가 `node.TargetUser`와 `node.TargetHost`를 사용하고 내부에서 `sip:{targetUser}@{targetHost}` 조합.

**피하는 방법:** `command-properties.tsx`의 BlindTransfer 분기에서 `targetUri` 대신 `targetUser`와 `targetHost` 두 Input을 렌더링.

### 함정 4: CommandNodeData 타입에 targetUser/targetHost 필드 누락

**발생하는 문제:** `CommandNodeData` 인터페이스에 `targetUser?: string`과 `targetHost?: string`이 없으면 `onUpdate({ targetUser: ... })`가 TypeScript 에러 발생.

**피하는 방법:** `scenario.ts`의 `CommandNodeData`에 두 필드를 추가.

### 함정 5: TestIntegration_TwoPartyCallSimulation 테스트 현재 FAIL

**발생하는 문제:** 해당 테스트가 TIMEOUT context deadline exceeded로 실패 중. Phase 13 작업과 무관한 기존 문제.

**경고 신호:** `go test ./internal/engine/... -run TestIntegration_TwoPartyCallSimulation`이 실패.

**피하는 방법:** Phase 13 범위의 테스트만 실행하여 이 기존 실패와 분리. NF-01 요구사항은 "새 Command/Event 핸들러에 대한 Go 단위 테스트"이므로 이 통합 테스트는 해당 없음.

### 함정 6: event-properties.tsx에 HELD/RETRIEVED/TRANSFERRED 분기 누락

**발생하는 문제:** HELD, RETRIEVED, TRANSFERRED 이벤트는 파라미터가 없으므로 추가 분기 없이 기본 Label + SIP Instance만 표시. 그러나 Timeout 필드가 있다면 표시해줄 수 있다.

**현황:** `event-properties.tsx`에 HELD/RETRIEVED/TRANSFERRED 분기가 없음. 이들은 현재 Label과 SIP Instance 선택만 표시됨. 타임아웃은 `executeWaitSIPEvent`에서 node.Timeout으로 사용되므로, Timeout 입력 필드를 추가하는 것이 좋다.

---

## Code Examples

### 새 Command 팔레트 항목 추가

```tsx
// 소스 패턴: frontend/src/features/scenario-builder/components/node-palette.tsx
// 기존 Commands 섹션에 추가할 항목들

<PaletteItem
  type="command-Hold"
  label="Hold"
  icon={Pause}
  colorClass="bg-blue-50 border-blue-400 text-blue-900"
/>
<PaletteItem
  type="command-Retrieve"
  label="Retrieve"
  icon={Play}
  colorClass="bg-blue-50 border-blue-400 text-blue-900"
/>
<PaletteItem
  type="command-BlindTransfer"
  label="BlindTransfer"
  icon={ArrowRightLeft}
  colorClass="bg-blue-50 border-blue-400 text-blue-900"
/>
```

### COMMAND_TYPES 업데이트

```typescript
// 소스: frontend/src/features/scenario-builder/types/scenario.ts
export const COMMAND_TYPES = [
  'MakeCall', 'Answer', 'Release', 'PlayAudio', 'SendDTMF',
  'Hold', 'Retrieve', 'BlindTransfer'  // 추가
] as const;

export interface CommandNodeData extends Record<string, unknown> {
  label: string;
  command: (typeof COMMAND_TYPES)[number];
  sipInstanceId?: string;
  targetUri?: string;
  timeout?: number;
  filePath?: string;
  digits?: string;
  intervalMs?: number;
  targetUser?: string;   // BlindTransfer 추가
  targetHost?: string;   // BlindTransfer 추가
}
```

### BlindTransfer Properties 패널 분기

```tsx
// 소스 패턴: frontend/src/features/scenario-builder/components/properties/command-properties.tsx
{data.command === 'BlindTransfer' && (
  <>
    <div className="space-y-2">
      <Label htmlFor="targetUser">Target User</Label>
      <Input
        id="targetUser"
        value={(data as any).targetUser || ''}
        onChange={(e) => onUpdate({ targetUser: e.target.value } as any)}
        placeholder="carol"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="targetHost">Target Host</Label>
      <Input
        id="targetHost"
        value={(data as any).targetHost || ''}
        onChange={(e) => onUpdate({ targetHost: e.target.value } as any)}
        placeholder="192.168.1.100:5060"
      />
      <p className="text-xs text-muted-foreground">
        host:port (e.g. 192.168.1.100:5060)
      </p>
    </div>
  </>
)}
```

### command-node.tsx COMMAND_ICONS 업데이트

```tsx
// 소스 패턴: frontend/src/features/scenario-builder/components/nodes/command-node.tsx
// import 추가
import { Phone, PhoneIncoming, PhoneOff, Volume2, Hash, Pause, Play, ArrowRightLeft } from 'lucide-react';

const COMMAND_ICONS = {
  MakeCall: Phone,
  Answer: PhoneIncoming,
  Release: PhoneOff,
  PlayAudio: Volume2,
  SendDTMF: Hash,
  Hold: Pause,            // 추가
  Retrieve: Play,         // 추가
  BlindTransfer: ArrowRightLeft,  // 추가
} as const;
```

### command-node.tsx 인라인 데이터 표시 추가

```tsx
// Hold/Retrieve: 파라미터 없으므로 추가 표시 불필요
// BlindTransfer: targetUser@targetHost 표시
{data.command === 'BlindTransfer' && (data as any).targetUser && (
  <div className="px-3 pb-2">
    <div className="text-xs text-muted-foreground">
      To: {(data as any).targetUser}@{(data as any).targetHost}
    </div>
  </div>
)}
```

### Go 테스트 — 추가 필요한 패턴

```go
// 소스 패턴: internal/engine/graph_test.go
// TestParseScenario_HoldFields — Hold는 파라미터 없으므로 Command 필드만 검증
func TestParseScenario_HoldFields(t *testing.T) {
  flowJSON := `{...Hold command node...}`
  graph, err := ParseScenario(flowJSON)
  // 검증: Command == "Hold"
  cmd1 := graph.Nodes["cmd-1"]
  if cmd1.Command != "Hold" { t.Errorf(...) }
}

// TestParseScenario_RetrieveFields — 동일 패턴
```

---

## State of the Art

| 이전 상태 | 현재 상태 (Phase 10/11 완료 후) | 영향 |
|---------|-------------------------------|------|
| Hold/Retrieve 없음 | executor.go에 executeHold, executeRetrieve 구현 완료 | UI만 추가하면 됨 |
| BlindTransfer 없음 | executor.go에 executeBlindTransfer 구현 완료 | UI + targetUser/targetHost fields 필요 |
| HELD/RETRIEVED/TRANSFERRED 이벤트 없음 | executeWaitSIPEvent로 세 이벤트 처리 완료 | 팔레트/아이콘은 있으나 타임아웃 Properties 미완 |
| Phase 12 이전 | Activity Bar + Resizable 레이아웃 완료 | 팔레트가 sidebar에 표시됨 |

**현재 갭 요약 (코드 직접 분석 결과):**

| 항목 | 현황 | 필요 작업 |
|-----|------|---------|
| COMMAND_TYPES에 Hold/Retrieve/BlindTransfer | 누락 | 추가 |
| CommandNodeData에 targetUser/targetHost | 누락 | 추가 |
| command-node.tsx COMMAND_ICONS Hold/Retrieve/BlindTransfer | 누락 | 추가 |
| node-palette.tsx command-Hold/Retrieve/BlindTransfer | 누락 | 추가 |
| command-properties.tsx Hold 분기 | 누락 (파라미터 없음이라 사실상 불필요) | 선택적 |
| command-properties.tsx Retrieve 분기 | 누락 (파라미터 없음이라 사실상 불필요) | 선택적 |
| command-properties.tsx BlindTransfer 분기 | 누락 | 추가 필수 |
| event-properties.tsx HELD/RETRIEVED/TRANSFERRED 타임아웃 | 누락 | 추가 권장 |
| Go 테스트 Hold/Retrieve 파라미터 파싱 | 일부 누락 | TestParseScenario_HoldFields 등 추가 |
| Go 테스트 BlindTransfer | 완료 (TestParseScenario_BlindTransferFields 존재) | 없음 |
| Go 테스트 HELD/RETRIEVED switch | 완료 (TestExecuteEvent_HeldSwitch 등 존재) | 없음 |
| Go 테스트 TRANSFERRED switch | 완료 (TestExecuteEvent_TransferredSwitch 존재) | 없음 |

---

## Open Questions

1. **Hold/Retrieve Properties 패널 — 타임아웃 표시 여부**
   - 아는 것: executeHold/executeRetrieve는 타임아웃 파라미터를 사용하지 않는다 (Re-INVITE 기반)
   - 불명확한 것: Properties 패널에서 빈 상태(파라미터 없음)가 UX상 적합한가
   - 권장사항: 타임아웃 Input 없이 "SIP Instance 선택만" 표시. 나머지는 읽기 전용 Badge로 Command Type 표시.

2. **HELD/RETRIEVED/TRANSFERRED Properties — 타임아웃 Input 필요 여부**
   - 아는 것: `executeWaitSIPEvent`에서 `node.Timeout`을 사용하며 기본 10초 적용
   - 불명확한 것: 사용자가 이 타임아웃을 커스터마이즈할 필요가 있는가
   - 권장사항: Timeout Input 추가 (TIMEOUT 이벤트와 동일 패턴, INCOMING처럼). 기존 DISCONNECTED, RINGING은 타임아웃 입력이 없어서 불일치 - 이 기회에 통일하거나 그냥 두거나 결정 필요.

3. **TestIntegration_TwoPartyCallSimulation 기존 실패 처리**
   - 아는 것: 이 테스트는 Phase 13 범위와 무관. `context deadline exceeded` 실패로 TIMEOUT 이벤트 처리에 문제 있음.
   - 권장사항: Phase 13 범위에서 이 테스트를 수정할 것인가 skip할 것인가 결정 필요.

---

## Sources

### Primary (HIGH 신뢰도) — 직접 코드 분석

- `frontend/src/features/scenario-builder/components/nodes/command-node.tsx` — 기존 COMMAND_ICONS, 렌더링 패턴
- `frontend/src/features/scenario-builder/components/nodes/event-node.tsx` — 기존 EVENT_ICONS, HELD/RETRIEVED/TRANSFERRED 이미 존재 확인
- `frontend/src/features/scenario-builder/components/node-palette.tsx` — 팔레트 항목, Section/PaletteItem 컴포넌트
- `frontend/src/features/scenario-builder/components/canvas.tsx` — onDrop 핸들러 (command-/event- 파싱)
- `frontend/src/features/scenario-builder/components/properties/command-properties.tsx` — 기존 Properties 패턴
- `frontend/src/features/scenario-builder/components/properties/event-properties.tsx` — 기존 Event Properties 패턴
- `frontend/src/features/scenario-builder/types/scenario.ts` — COMMAND_TYPES, CommandNodeData
- `frontend/src/features/scenario-builder/hooks/use-dnd.tsx` — DnD 컨텍스트
- `internal/engine/executor.go` — executeHold, executeRetrieve, executeBlindTransfer, executeWaitSIPEvent
- `internal/engine/graph.go` — ParseScenario, GraphNode, TargetUser, TargetHost 필드
- `internal/engine/executor_test.go` — 기존 테스트 패턴
- `internal/engine/graph_test.go` — ParseScenario 테스트 패턴 (TestParseScenario_BlindTransferFields)
- `internal/engine/integration_test.go` — TestIntegration_V1_0_MakeCallAnswerRelease_Parse (하위 호환성 테스트 패턴)

### 테스트 실행 결과

- Phase 10/11 Hold/Retrieve/BlindTransfer 테스트: **PASS** (직접 실행 확인)
- TestIntegration_TwoPartyCallSimulation: **FAIL** (기존 문제, Phase 13 무관)

---

## Metadata

**신뢰도 세분화:**
- 표준 스택: HIGH — 기존 코드베이스 직접 분석
- 아키텍처: HIGH — 기존 패턴 파일별 확인
- 함정: HIGH — 실제 코드 갭 확인 (COMMAND_TYPES 등 직접 확인)
- Go 테스트 커버리지: HIGH — 테스트 파일 직접 분석 및 실행

**연구 날짜:** 2026-02-20
**유효 기한:** 30일 (코드베이스 안정적)
