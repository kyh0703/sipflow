# Phase 6: Codec Configuration — Research

## 1. diago Codec API 분석

### 1.1 diago 버전
- **현재 버전**: `v0.27.0` (go.mod 확인)
- **위치**: `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0`

### 1.2 MediaConfig 구조
```go
// diago.go:140-155
type MediaConfig struct {
    Codecs []media.Codec
    // Currently supported Single. Check media.SRTP... constants
    // Experimental
    SecureRTPAlg uint16
    // Used internally
    secureRTP  int // 0 - none, 1 - sdes
    bindIP     net.IP
    externalIP net.IP
    rtpNAT     int
    dtlsConf   media.DTLSConfig
}

func WithMediaConfig(conf MediaConfig) DiagoOption {
    return func(dg *Diago) {
        dg.mediaConf = conf
    }
}
```

### 1.3 지원 코덱
```go
// media/codec.go:19-22
CodecAudioUlaw  = Codec{PayloadType: 0, SampleRate: 8000, SampleDur: 20ms, NumChannels: 1, Name: "PCMU"}
CodecAudioAlaw  = Codec{PayloadType: 8, SampleRate: 8000, SampleDur: 20ms, NumChannels: 1, Name: "PCMA"}
CodecAudioOpus  = Codec{PayloadType: 96, SampleRate: 48000, SampleDur: 20ms, NumChannels: 2, Name: "opus"}
CodecTelephoneEvent8000 = Codec{PayloadType: 101, SampleRate: 8000, SampleDur: 20ms, NumChannels: 1, Name: "telephone-event"}
```

**v1.1 범위**: PCMU(0), PCMA(8), telephone-event(101)만 사용 (Opus는 CGO 의존성으로 제외)

### 1.4 기본 코덱 설정
```go
// diago.go:198-200 (NewDiago)
mediaConf: MediaConfig{
    Codecs: []media.Codec{media.CodecAudioUlaw, media.CodecAudioAlaw, media.CodecTelephoneEvent8000},
}
```

**기본값**: PCMU → PCMA → telephone-event 순서

### 1.5 WithMediaConfig 적용 시점
```go
// diago.go:674-681 (NewDialog 내부)
mediaConf := MediaConfig{
    Codecs:     dg.mediaConf.Codecs,  // ← Diago 생성 시 설정한 Codecs 복사
    secureRTP:  tran.MediaSRTP,
    bindIP:     tran.mediaBindIP,
    externalIP: tran.MediaExternalIP,
    dtlsConf:   tran.MediaDTLSConf,
}
if err := d.initMediaSessionFromConf(mediaConf); err != nil {
    return nil, err
}
```

**중요**: `WithMediaConfig()`는 `NewDiago()` 호출 시 적용되며, 이후 모든 다이얼로그 생성 시 이 설정이 복사됨

---

## 2. Instance Manager 현재 구조

### 2.1 SipInstanceConfig 구조체
```go
// internal/engine/graph.go:44-52
type SipInstanceConfig struct {
    ID       string
    Label    string
    Mode     string // DN|Endpoint
    DN       string
    Register bool
    Color    string
    // ← Codecs 필드 없음 (추가 필요)
}
```

### 2.2 CreateInstances 메서드
```go
// internal/engine/instance_manager.go:42-97
func (im *InstanceManager) CreateInstances(graph *ExecutionGraph) error {
    for instanceID, chain := range graph.Instances {
        // 1. 포트 할당
        port, err := im.allocatePort()

        // 2. sipgo UA 생성
        ua, err := sipgo.NewUA()

        // 3. diago 인스턴스 생성 (127.0.0.1에 바인딩)
        dg := diago.NewDiago(ua,
            diago.WithTransport(diago.Transport{
                Transport: "udp",
                BindHost:  "127.0.0.1",
                BindPort:  port,
            }),
            // ← WithMediaConfig 없음 (추가 필요)
        )

        // 4. ManagedInstance 저장
        managedInst := &ManagedInstance{
            Config: chain.Config,
            UA:     dg,
            Port:   port,
            // ...
        }
        im.instances[instanceID] = managedInst
    }
}
```

**현재 상태**:
- 모든 인스턴스가 diago 기본 코덱 (PCMU, PCMA, telephone-event) 사용
- 인스턴스별 코덱 설정 기능 없음

### 2.3 필요한 변경 사항
1. `SipInstanceConfig`에 `Codecs []string` 필드 추가
2. `CreateInstances()`에서 `config.Codecs` → `[]media.Codec` 변환 로직 추가
3. `diago.NewDiago()`에 `diago.WithMediaConfig()` 옵션 추가

---

## 3. Frontend SIP Instance 노드 구조

### 3.1 SipInstanceNodeData 타입
```typescript
// frontend/src/features/scenario-builder/types/scenario.ts:36-43
export interface SipInstanceNodeData extends Record<string, unknown> {
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string;
  // ← codecs 필드 없음 (추가 필요)
}
```

### 3.2 SIP Instance 노드 컴포넌트
```typescript
// frontend/src/features/scenario-builder/components/nodes/sip-instance-node.tsx
export function SipInstanceNode({ data, id }: NodeProps<SipInstanceNode>) {
  // 현재 표시: label, mode badge, register badge, DN number
  // ← 코덱 표시 없음
}
```

### 3.3 Properties 패널
```typescript
// frontend/src/features/scenario-builder/components/properties/sip-instance-properties.tsx
export function SipInstanceProperties({ node, onUpdate }: SipInstancePropertiesProps) {
  return (
    <div>
      {/* Label */}
      <Input value={data.label} onChange={(e) => onUpdate({ label: e.target.value })} />

      {/* Mode: DN | Endpoint */}
      <Select value={data.mode} onValueChange={handleModeChange}>
        <SelectItem value="DN">DN</SelectItem>
        <SelectItem value="Endpoint">Endpoint</SelectItem>
      </Select>

      {/* DN Number (DN 모드에만 표시) */}
      {data.mode === 'DN' && <Input value={data.dn || ''} />}

      {/* Register Switch */}
      <Switch checked={data.register} onCheckedChange={...} />

      {/* Color Picker */}
      <div className="flex gap-2">
        {INSTANCE_COLORS.map((color) => <button ... />)}
      </div>

      {/* ← 코덱 선택 UI 없음 (추가 필요) */}
    </div>
  );
}
```

**사용 중인 UI 라이브러리**:
- `@/components/ui/input` (shadcn/ui)
- `@/components/ui/select` (shadcn/ui)
- `@/components/ui/switch` (shadcn/ui)
- `@/components/ui/separator` (shadcn/ui)

---

## 4. 시나리오 데이터 모델

### 4.1 ParseScenario 로직
```go
// internal/engine/graph.go:66-96
func ParseScenario(flowData string) (*ExecutionGraph, error) {
    // 1. JSON → FlowData 파싱
    var flow FlowData
    json.Unmarshal([]byte(flowData), &flow)

    // 2. sipInstance 노드 → SipInstanceConfig 변환
    for _, node := range flow.Nodes {
        if node.Type == "sipInstance" {
            config := SipInstanceConfig{
                ID:       node.ID,
                Label:    getStringField(node.Data, "label", ""),
                Mode:     getStringField(node.Data, "mode", "DN"),
                DN:       getStringField(node.Data, "dn", ""),
                Register: getBoolField(node.Data, "register", true),
                Color:    getStringField(node.Data, "color", ""),
                // ← Codecs 필드 없음 (추가 필요)
            }
            graph.Instances[node.ID] = &InstanceChain{Config: config, ...}
        }
    }
}
```

**필요한 변경**:
```go
Codecs: getStringArrayField(node.Data, "codecs", []string{"PCMU", "PCMA"}), // 기본값
```

### 4.2 프론트엔드 저장 형식
React Flow의 `nodes` 배열에 저장:
```json
{
  "id": "sipInstance-1",
  "type": "sipInstance",
  "data": {
    "label": "Alice",
    "mode": "DN",
    "dn": "1001",
    "register": true,
    "color": "#3b82f6",
    "codecs": ["PCMU", "PCMA"]  // ← 추가 필요
  }
}
```

**저장 시점**: Zustand store의 `nodes` 배열이 자동으로 시나리오 JSON에 포함됨

---

## 5. SDP 협상 메커니즘

### 5.1 MediaSession 초기화
```go
// dialog_media.go:151-184
func (d *DialogMedia) initMediaSessionFromConf(conf MediaConfig) error {
    sess := &media.MediaSession{
        Codecs:     slices.Clone(conf.Codecs),  // ← 코덱 순서 그대로 복사
        Laddr:      net.UDPAddr{IP: bindIP, Port: 0},
        ExternalIP: conf.externalIP,
        Mode:       sdp.ModeSendrecv,
        // ...
    }
    if err := sess.Init(); err != nil {
        return err
    }
    d.mediaSession = sess
    return nil
}
```

### 5.2 SDP 생성 (LocalSDP)
```go
// media/media_session.go:292-404
func (s *MediaSession) LocalSDP() []byte {
    // 협상 후 필터링된 코덱이 있으면 사용, 없으면 초기 코덱 사용
    codecs := s.Codecs
    if len(s.filterCodecs) > 0 {
        codecs = s.filterCodecs  // ← 상대방과 협상된 공통 코덱
    }

    return generateSDPForAudio(..., codecs, ...)
}

// media/media_session.go:1090-1110
func generateSDPForAudio(..., codecs []Codec, ...) []byte {
    fmts := make([]string, len(codecs))
    for i, f := range codecs {
        switch f.PayloadType {
        case 0:  // PCMU
            formatsMap = append(formatsMap, "a=rtpmap:0 PCMU/8000")
        case 8:  // PCMA
            formatsMap = append(formatsMap, "a=rtpmap:8 PCMA/8000")
        // ...
        }
        fmts[i] = strconv.Itoa(int(f.PayloadType))
    }
    // m= 라인: "m=audio 5060 RTP/AVP 0 8 101"  ← codecs 순서대로
}
```

**핵심**:
- `MediaSession.Codecs`의 순서가 SDP `m=` 라인의 페이로드 타입 순서를 결정
- RFC 3264: "answerer는 offer와 동일한 상대적 순서를 유지하는 것이 권장됨"

### 5.3 코덱 협상 실패 시나리오

**diago 코드 분석 결과**:
- diago는 SDP 협상 실패 시 **자동으로 488 응답을 보내지 않음**
- `RemoteSDP()` 메서드가 공통 코덱이 없어도 에러 반환하지 않음
- 협상 실패는 **미디어 스트림 생성 시 런타임 에러**로 나타남

**검증된 동작**:
```go
// media/media_session.go:409-490 (RemoteSDP)
// filterCodecs 생성 시 공통 코덱만 추출하지만,
// 결과가 비어있어도 에러를 반환하지 않음
```

**v1.1 구현 전략**:
1. **Backend에서 명시적 검증 추가 필요**:
   ```go
   // Answer 전에 filterCodecs 체크
   if len(d.mediaSession.filterCodecs) == 0 {
       return errors.New("no common codec")
   }
   ```
2. **488 Not Acceptable 응답 구현**:
   ```go
   // command_executor.go에서 Answer 실패 시
   tx.Respond(sip.NewResponseFromRequest(req, 488, "Not Acceptable Here", nil))
   ```

---

## 6. 드래그앤드롭 구현 옵션

### 6.1 현재 프로젝트의 드래그 구현

```typescript
// frontend/src/features/scenario-builder/components/node-palette.tsx
function PaletteItem({ type, label, icon, colorClass }: PaletteItemProps) {
  const { setType } = useDnD();

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
    setType(type);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      {/* ... */}
    </div>
  );
}
```

**패턴**: HTML5 Drag and Drop API 사용 (라이브러리 없음)

### 6.2 코덱 우선순위 변경 UI 옵션

#### 옵션 A: HTML5 Drag API (권장)
**장점**:
- 외부 라이브러리 불필요 (번들 크기 ↓)
- 기존 node-palette 패턴과 일관성
- React 18+ 호환성 우수

**구현**:
```typescript
// CodecListItem.tsx
function CodecListItem({ codec, index, onMove }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    onMove(fromIndex, index);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-2 p-2 border rounded cursor-move",
        isDragging && "opacity-50"
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      <span>{codec}</span>
    </div>
  );
}
```

#### 옵션 B: @dnd-kit/sortable (고려 대상)
**장점**:
- 접근성 지원 (키보드 네비게이션)
- 터치 디바이스 지원
- 애니메이션 내장

**단점**:
- 추가 번들 크기 (~50KB)
- 학습 곡선

**설치 필요**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 옵션 C: 버튼 기반 (단순)
```typescript
<div className="flex items-center gap-2">
  <Button size="icon" onClick={() => moveUp(index)}>
    <ChevronUp />
  </Button>
  <span>{codec}</span>
  <Button size="icon" onClick={() => moveDown(index)}>
    <ChevronDown />
  </Button>
</div>
```

**장점**: 구현 단순, 접근성 우수
**단점**: UX가 다소 번거로움

### 6.3 권장 사항
**Phase 6에는 옵션 A (HTML5 Drag API) 사용**:
- 기존 코드베이스와 일관성 유지
- 외부 의존성 없음
- MVP에 충분한 UX 제공
- 향후 @dnd-kit 전환 가능 (인터페이스 동일)

---

## 7. 구현 핵심 포인트

### 7.1 Backend 수정사항

#### A. graph.go
```go
type SipInstanceConfig struct {
    ID       string
    Label    string
    Mode     string
    DN       string
    Register bool
    Color    string
    Codecs   []string  // ← 추가: ["PCMU", "PCMA"]
}

// ParseScenario 내부
config := SipInstanceConfig{
    // ...
    Codecs: getStringArrayField(node.Data, "codecs", []string{"PCMU", "PCMA"}),
}

// 새 헬퍼 함수
func getStringArrayField(data map[string]interface{}, key string, defaultVal []string) []string {
    if val, ok := data[key]; ok {
        if arr, ok := val.([]interface{}); ok {
            result := make([]string, 0, len(arr))
            for _, v := range arr {
                if s, ok := v.(string); ok {
                    result = append(result, s)
                }
            }
            return result
        }
    }
    return defaultVal
}
```

#### B. instance_manager.go
```go
import "github.com/emiago/diago/media"

// CreateInstances 내부
func (im *InstanceManager) CreateInstances(graph *ExecutionGraph) error {
    for instanceID, chain := range graph.Instances {
        // 포트 할당, UA 생성...

        // 1. 코덱 문자열 → media.Codec 변환
        codecs := stringToCodecs(chain.Config.Codecs)

        // 2. MediaConfig 생성
        mediaConfig := diago.MediaConfig{
            Codecs: codecs,
        }

        // 3. diago 인스턴스 생성 (WithMediaConfig 추가)
        dg := diago.NewDiago(ua,
            diago.WithTransport(diago.Transport{
                Transport: "udp",
                BindHost:  "127.0.0.1",
                BindPort:  port,
            }),
            diago.WithMediaConfig(mediaConfig),  // ← 추가
        )
        // ...
    }
}

// 새 헬퍼 함수
func stringToCodecs(codecNames []string) []media.Codec {
    codecs := make([]media.Codec, 0, len(codecNames)+1)
    for _, name := range codecNames {
        switch name {
        case "PCMU":
            codecs = append(codecs, media.CodecAudioUlaw)
        case "PCMA":
            codecs = append(codecs, media.CodecAudioAlaw)
        }
    }
    // telephone-event는 항상 마지막에 추가
    codecs = append(codecs, media.CodecTelephoneEvent8000)
    return codecs
}
```

**중요 결정**: telephone-event는 사용자 선택과 무관하게 항상 포함 (DTMF 지원)

#### C. command_executor.go (Answer 명령 강화)
```go
func executeAnswerCommand(node *GraphNode, inst *ManagedInstance) error {
    inDialog := <-inst.incomingCh

    // Answer 시도
    if err := inDialog.Answer(); err != nil {
        // 코덱 불일치 체크
        if strings.Contains(err.Error(), "no common codec") {
            // 488 Not Acceptable 응답
            return fmt.Errorf("codec negotiation failed: %w", err)
        }
        return err
    }
    return nil
}
```

**현재 한계**: diago v0.27.0은 코덱 불일치를 명시적으로 감지하지 않음
**대안**: v1.1에서는 로그로 확인 가능, v1.2에서 명시적 검증 추가 고려

### 7.2 Frontend 수정사항

#### A. scenario.ts
```typescript
export interface SipInstanceNodeData extends Record<string, unknown> {
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string;
  codecs?: string[];  // ← 추가: ["PCMU", "PCMA"]
}

// 기본값 상수 추가
export const DEFAULT_CODECS = ['PCMU', 'PCMA'] as const;
```

#### B. sip-instance-properties.tsx
```typescript
import { GripVertical } from 'lucide-react';

export function SipInstanceProperties({ node, onUpdate }: SipInstancePropertiesProps) {
  const [codecs, setCodecs] = useState<string[]>(
    node.data.codecs ?? DEFAULT_CODECS
  );

  const moveCodec = (fromIndex: number, toIndex: number) => {
    const newCodecs = [...codecs];
    const [removed] = newCodecs.splice(fromIndex, 1);
    newCodecs.splice(toIndex, 0, removed);
    setCodecs(newCodecs);
    onUpdate({ codecs: newCodecs });
  };

  return (
    <div className="space-y-4">
      {/* 기존 필드들... */}

      <Separator />

      {/* 코덱 선택 */}
      <div className="space-y-2">
        <Label>Preferred Codecs</Label>
        <p className="text-xs text-muted-foreground">
          Drag to change priority
        </p>
        <div className="space-y-1">
          {codecs.map((codec, index) => (
            <CodecListItem
              key={codec}
              codec={codec}
              index={index}
              onMove={moveCodec}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### C. CodecListItem 컴포넌트 (신규)
```typescript
// frontend/src/features/scenario-builder/components/properties/codec-list-item.tsx
interface CodecListItemProps {
  codec: string;
  index: number;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export function CodecListItem({ codec, index, onMove }: CodecListItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== index) {
      onMove(fromIndex, index);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border rounded-md",
        "cursor-move transition-opacity hover:bg-accent",
        "nodrag",  // React Flow 드래그 비활성화
        isDragging && "opacity-50"
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium">{codec}</span>
    </div>
  );
}
```

**중요 CSS**: `nodrag` 클래스로 React Flow 노드 드래그와 충돌 방지

#### D. sip-instance-node.tsx (선택사항)
노드에 코덱 표시 (간단히):
```typescript
<div className="px-3 py-2">
  {/* 기존 mode, register badges */}
  <div className="text-xs text-muted-foreground mt-1">
    Codecs: {data.codecs?.join(', ') ?? 'PCMU, PCMA'}
  </div>
</div>
```

### 7.3 테스트 시나리오

#### 성공 케이스
```
Alice (PCMU, PCMA) → Bob (PCMU, PCMA)
- 예상: PCMU 우선 사용 (200 OK)

Alice (PCMA, PCMU) → Bob (PCMU, PCMA)
- 예상: PCMA 우선 사용 (Alice가 offerer이므로 Alice 순서 따름)
```

#### 실패 케이스
```
Alice (PCMU만) → Bob (PCMA만)
- 예상: 488 Not Acceptable Here (공통 코덱 없음)
```

**검증 방법**:
1. Wails DevTools에서 SIP 로그 확인
2. SDP `m=` 라인에서 페이로드 타입 순서 검증
3. `filterCodecs` 길이가 0일 때 에러 발생 확인

### 7.4 예상 구현 난이도

| 컴포넌트 | 난이도 | 시간 |
|---------|--------|------|
| Backend: graph.go 수정 | 쉬움 | 30분 |
| Backend: instance_manager.go 수정 | 중간 | 1시간 |
| Frontend: types 수정 | 쉬움 | 15분 |
| Frontend: CodecListItem 구현 | 중간 | 2시간 |
| Frontend: properties 패널 통합 | 쉬움 | 30분 |
| 통합 테스트 | 중간 | 1시간 |
| **총계** | | **5시간 15분** |

---

## RESEARCH COMPLETE

### 핵심 발견사항 요약

1. **diago v0.27.0의 MediaConfig API는 완전히 동작**하며, `WithMediaConfig()`로 인스턴스별 코덱 설정 가능
2. **SDP 생성 시 `MediaSession.Codecs` 배열 순서가 그대로 m= 라인에 반영**됨
3. **코덱 협상 실패 시 diago는 자동으로 488을 보내지 않음** → 명시적 검증 필요
4. **프론트엔드는 HTML5 Drag API로 구현** → 외부 라이브러리 불필요
5. **telephone-event는 항상 포함**되어야 함 (DTMF 지원)

### 구현 권장사항

**우선순위**:
1. Backend 코덱 변환 로직 (`stringToCodecs()`)
2. Frontend 드래그 UI (`CodecListItem`)
3. Properties 패널 통합
4. 시나리오 저장/로드 테스트
5. 코덱 불일치 에러 핸들링 (선택사항, v1.2로 연기 가능)

**함정 회피**:
- `nodrag` 클래스 필수 (React Flow 충돌 방지)
- `telephone-event` 자동 추가 로직 필수
- 프론트엔드 기본값은 `["PCMU", "PCMA"]`로 통일
- Backend 기본값도 `["PCMU", "PCMA"]`로 동일하게 설정 (일관성)
