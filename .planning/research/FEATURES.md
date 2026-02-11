# 기능 환경: SIP 미디어 재생/녹음/DTMF/코덱

**도메인:** SIP Call Flow Simulator — 미디어 확장 기능
**리서치일:** 2026-02-11
**프로젝트:** SIPFLOW v1.1 마일스톤

---

## 요약

SIP 미디어 기능(재생, 녹음, DTMF, 코덱)은 IVR 시뮬레이션과 실제 VoIP 테스트에서 필수적입니다. 이 리서치는 SIP 테스팅 툴에서 일반적으로 기대되는 미디어 기능과 SIPFLOW의 시나리오 빌더에 통합하는 방법을 정의합니다.

**핵심 발견:**
- **미디어 재생:** IVR 프롬프트/메뉴를 위해 통화 중 WAV 파일 재생
- **통화 녹음:** RTP 스트림 캡처 → WAV 저장 (stereo/mixed 포맷)
- **DTMF:** RFC 2833 (RTP telephone-event) 방식이 표준, SIP INFO는 폴백
- **코덱 협상:** SDP m= 라인 순서가 우선순위, 동적 payload type 처리 필요
- **노드 통합:** Command/Event 아키텍처에 맞춰 미디어 Command + DTMF Event 추가

---

## 필수 기능 (Table Stakes)

사용자가 SIP 미디어 테스팅 툴에서 기대하는 기본 기능들.

| 기능 | 기대 이유 | 복잡도 | 참고 |
|------|-----------|--------|------|
| **WAV 파일 재생** | IVR/메뉴 시뮬레이션의 기본 | 중간 | 통화 중 PCMA/PCMU 인코딩된 WAV 파일을 RTP로 스트리밍 |
| **통화 녹음 (전체)** | QA/디버깅용 통화 내용 저장 | 중간 | RTP 스트림 → WAV 저장. 통화 시작부터 종료까지 |
| **DTMF 송신** | IVR 메뉴 탐색 자동화 | 낮음 | RFC 2833 RTP telephone-event 송신 |
| **DTMF 수신 이벤트** | IVR 입력 검증 | 낮음 | 이미 DTMFReceived Event 있음, 강화 필요 |
| **코덱 선택 (기본)** | G.711 A-law/μ-law 지원 | 낮음 | SDP m= 라인에 선호 코덱 명시 (PCMA=8, PCMU=0) |
| **RTP 스트림 처리** | 미디어 송수신 인프라 | 높음 | diago의 RTP 핸들링 활용 |

### 상세: WAV 파일 재생

**동작:**
- Command 노드에서 WAV 파일 경로 지정
- 통화 연결 후(CallConnected 이벤트 후) 재생 시작
- RTP 패킷으로 인코딩하여 원격 엔드포인트로 전송
- 재생 완료 시 다음 노드로 진행

**패턴:**
- **MP3StreamPlayback 패턴 (Ozeki SDK 참조):** 오디오 파일을 마이크처럼 취급, 미디어 sender로 attach
- **StartStreaming() 메서드:** 재생 시작 명시적 제어
- **지원 포맷:** WAV (PCM 8kHz 16-bit mono), MP3 (선택적)

**노드 속성:**
```typescript
{
  command: "PlayAudio",
  sipInstanceId: "instance-1",
  audioFile: "/path/to/prompt.wav",  // 파일 경로
  loop: false,                        // 반복 재생 여부
  stopOnDTMF: true,                   // DTMF 수신 시 중단
}
```

**참고:**
- 전화 네트워크는 PCM 8kHz, 16-bit, mono가 표준
- stereo 오디오는 전화망에서 재생 불가
- 파일은 미리 적절한 코덱(PCMA/PCMU)으로 인코딩되어야 함

### 상세: 통화 녹음

**동작:**
- Command 노드로 녹음 시작/중지 제어
- RTP 스트림을 실시간 캡처하여 WAV 파일로 저장
- 녹음 파일은 사용자 지정 경로에 저장

**포맷 옵션:**
- **Mono (mixed):** 양측 오디오를 하나의 모노 트랙으로 믹싱 (기본)
- **Stereo (separate):** Local/Remote를 좌/우 채널로 분리 (QA/훈련용)
- **WAV:** PCM 포맷, 고품질이지만 용량 큼
- **MP3/OGG:** 압축 포맷 (선택적, 향후 확장)

**노드 속성:**
```typescript
// StartRecording Command
{
  command: "StartRecording",
  sipInstanceId: "instance-1",
  outputPath: "/recordings/call-001.wav",
  format: "stereo",  // "mono" | "stereo"
}

// StopRecording Command
{
  command: "StopRecording",
  sipInstanceId: "instance-1",
}
```

**참고:**
- 통화 중 언제든지 녹음 시작/중지 가능 (부분 녹음 지원)
- G.711 코덱: 10분 오디오 ≈ 6MB (PCAP 기준)
- VoIPmonitor와 같은 도구는 G.711/G.722/G.729/Opus 등 다양한 코덱 지원

### 상세: DTMF 송신

**동작:**
- Command 노드로 DTMF digits 전송
- RFC 2833 (RTP telephone-event) 방식 우선
- SIP INFO는 폴백 (협상 실패 시)

**RFC 2833 vs SIP INFO:**
- **RFC 2833 (권장):** RTP 패킷에 DTMF 이벤트 인코딩, 패킷 손실에 강함 (redundancy)
- **SIP INFO:** SIP signaling 경로로 전송, RFC 2833 불가 시 사용
- **In-band:** 오디오 톤으로 전송, G.729/Opus 같은 압축 코덱에서 왜곡됨 (피해야 함)

**협상:**
- SDP에서 `telephone-event` payload type 협상 (dynamic 96-127)
- 협상 성공 시 RFC 2833, 실패 시 SIP INFO 사용

**노드 속성:**
```typescript
{
  command: "SendDTMF",
  sipInstanceId: "instance-1",
  digits: "1234",         // 전송할 DTMF digits
  method: "auto",         // "auto" | "rfc2833" | "sip_info"
  duration: 100,          // ms per digit (optional)
  interval: 100,          // ms between digits (optional)
}
```

**참고:**
- IVR 메뉴 탐색의 핵심 기능
- `stopOnDTMF` (PlayAudio) 옵션과 함께 사용하여 인터럽트 가능 프롬프트 구현

### 상세: DTMF 수신 이벤트

**현재 상태:**
- `DTMFReceived` Event 노드 이미 존재 (PROJECT.md 참조)

**강화 필요:**
- 수신된 digit 값 캡처
- timeout 설정 (입력 대기 시간)
- digit 패턴 매칭 (예: "1", "2-5", "*" 등)

**노드 속성:**
```typescript
{
  event: "DTMFReceived",
  sipInstanceId: "instance-1",
  expectedDigit?: "1",    // 특정 digit 대기 (optional)
  timeout: 5000,          // ms
}
```

**이벤트 데이터:**
```typescript
{
  digit: "1",             // 수신된 DTMF digit
  method: "rfc2833",      // "rfc2833" | "sip_info"
  timestamp: "2026-02-11T10:30:00Z",
}
```

### 상세: 코덱 선택

**동작:**
- SIP Instance 노드에서 선호 코덱 목록 설정
- SDP Offer/Answer 협상 시 우선순위 적용
- m= 라인에 코덱을 선호도 순서로 나열

**SDP 협상:**
- **Offer:** 코덱을 선호도 순서로 나열 (첫 번째가 가장 선호)
- **Answer:** Offer와 일치하는 코덱만 포함, 순서는 answerer의 선호도
- **최종 선택:** Answer의 첫 번째 코덱 사용

**Static vs Dynamic Payload Type:**
- **Static (0-95):** G.711 μ-law (0), G.711 A-law (8), G.729 (18)
- **Dynamic (96-127):** Opus, telephone-event 등. 런타임에 협상됨

**노드 속성 (SipInstance 확장):**
```typescript
{
  // 기존 SipInstance 속성
  mode: "DN",
  dn: "1001",
  register: true,

  // 새 미디어 속성
  codecs: [
    { name: "PCMA", priority: 1 },   // G.711 A-law
    { name: "PCMU", priority: 2 },   // G.711 μ-law
    { name: "Opus", priority: 3 },   // (선택적)
  ],
  enableDTMF: true,  // telephone-event 협상 활성화
}
```

**코덱 선택 전략:**
- **기본:** PCMU (G.711 μ-law) — 가장 넓은 호환성
- **고품질:** Opus — 낮은 레이턴시, 좋은 품질 (최신 시스템)
- **대역폭 절약:** G.729 — 압축률 높지만 라이센스 이슈 (MVP에서 제외)

**참고:**
- Opus는 dynamic payload type (96-127) 사용, inbound/outbound map id 매칭 필요
- 코덱 mismatch → 통화 실패 또는 오디오 왜곡

---

## 차별화 기능 (Differentiators)

경쟁 SIP 테스팅 툴과 차별화되는 기능들.

| 기능 | 가치 제안 | 복잡도 | 참고 |
|------|-----------|--------|------|
| **시각적 미디어 플로우** | 미디어 Command를 시각적으로 배치 | 낮음 | 기존 XYFlow 노드 확장 |
| **부분 녹음 제어** | 특정 구간만 녹음 (민감 정보 제외) | 중간 | StartRecording/StopRecording 쌍으로 구현 |
| **DTMF 패턴 검증** | IVR 메뉴 탐색 자동 검증 | 중간 | DTMFReceived Event에 패턴 매칭 |
| **미디어 재생 + DTMF 인터럽트** | stopOnDTMF로 사용자 입력 시뮬레이션 | 중간 | PlayAudio + DTMFReceived 조합 |
| **코덱별 시나리오 분기** | 협상 결과에 따른 분기 플로우 | 높음 | CodecNegotiated Event (향후) |

### 상세: 시각적 미디어 플로우

**가치:**
- SIPp는 XML 스크립트 기반 — 복잡한 미디어 플로우 이해 어려움
- SIPFLOW는 XYFlow로 미디어 재생/녹음/DTMF를 시각적으로 배치
- 실행 시 엣지 애니메이션으로 미디어 플로우 실시간 추적

**구현:**
- 기존 Command/Event 노드 아키텍처에 자연스럽게 통합
- PlayAudio → DTMFReceived → SendDTMF 플로우를 노드로 표현

**예시 시나리오:**
```
[SIPInstance] → [MakeCall] → [CallConnected Event]
                    ↓
           [PlayAudio: menu.wav]
                    ↓
      [DTMFReceived: "1"] → [PlayAudio: option1.wav]
                    ↓
      [DTMFReceived: "2"] → [PlayAudio: option2.wav]
```

### 상세: 부분 녹음 제어

**가치:**
- 민감 정보(신용카드 번호 등) 입력 구간 녹음 제외
- 특정 구간만 QA용 녹음

**구현:**
```
[CallConnected] → [StartRecording]
                    ↓
         [PlayAudio: prompt.wav]
                    ↓
            [DTMFReceived: "1"]
                    ↓
              [StopRecording]  ← 녹음 중지
                    ↓
    [PlayAudio: sensitive_prompt.wav]  ← 녹음 안 됨
                    ↓
            [DTMFReceived: "1234"]
                    ↓
              [StartRecording]  ← 재개
```

**경쟁 우위:**
- 대부분의 도구는 전체 녹음만 지원
- SIPFLOW는 Command 노드로 세밀한 제어 가능

### 상세: DTMF 패턴 검증

**가치:**
- IVR 메뉴가 올바른 digit만 수락하는지 검증
- 잘못된 입력 시 플로우 분기 (error 핸들링)

**구현:**
```typescript
{
  event: "DTMFReceived",
  expectedDigit: "1-9",  // 패턴: 1~9 중 하나
  timeout: 5000,
  onInvalidDigit: "error-branch",  // 잘못된 digit 수신 시 분기
}
```

**분기:**
- success edge: 기대한 digit 수신
- failure edge: timeout 또는 잘못된 digit

---

## 안티 기능 (Anti-Features)

명시적으로 빌드하지 않을 기능들.

| 안티 기능 | 피하는 이유 | 대신 할 것 |
|-----------|-------------|------------|
| **실시간 오디오 입력 (마이크)** | 테스팅 툴에 불필요, 복잡도 높음 | WAV 파일 재생으로 시뮬레이션 |
| **TTS (Text-to-Speech)** | 외부 의존성, MVP 범위 밖 | 사전 녹음된 WAV 파일 사용 |
| **Video (RTP video)** | SIP 통화 테스트 중심, 비디오는 범위 밖 | 오디오 전용 |
| **In-band DTMF** | 압축 코덱에서 신뢰성 낮음 | RFC 2833/SIP INFO만 지원 |
| **FAX over IP (T.38)** | 니치 기능, 복잡도 매우 높음 | MVP 이후 고려 |
| **실시간 코덱 transcoding** | 복잡도 높고 성능 이슈 | 협상된 코덱 그대로 사용 |
| **멀티파티 믹싱 (Conference)** | 복잡도 높음, v1.1 범위 밖 | 1:1 통화만 지원 (향후 확장) |

### 근거: 실시간 오디오 입력 제외

**이유:**
- SIPFLOW는 자동화된 테스트 시나리오 실행이 목표
- 실시간 마이크 입력은 자동화 불가 (사람 개입 필요)
- 크로스 플랫폼 오디오 캡처는 복잡도 높음 (PortAudio 등 필요)

**대안:**
- 사전 녹음된 WAV 파일로 모든 오디오 시뮬레이션
- 테스트 시나리오 반복 실행 가능

### 근거: TTS 제외

**이유:**
- TTS 엔진 (Google TTS, Amazon Polly) 외부 의존성
- 오프라인 사용 불가
- 비용 발생 가능
- MVP에서 과도한 복잡도

**대안:**
- 사용자가 TTS 서비스로 미리 WAV 생성
- 또는 직접 녹음한 오디오 사용

### 근거: In-band DTMF 제외

**이유:**
- G.729, Opus 같은 압축 코덱에서 DTMF 톤 왜곡됨
- 신뢰성 낮음 (패킷 손실, 압축)
- RFC 2833이 표준이자 권장 방식

**대안:**
- RFC 2833 (RTP telephone-event) 기본
- SIP INFO 폴백

---

## 기능 의존성

```
[SIP Instance with Codec Config]
         ↓
    [MakeCall]
         ↓
  [CallConnected Event] ← RTP 세션 수립됨
         ↓
   ┌─────┴─────────────────────┐
   │                           │
[PlayAudio]             [StartRecording]
   ↓                           ↓
[SendDTMF]                [StopRecording]
   ↓
[DTMFReceived Event]
```

**의존성 규칙:**
1. **미디어 Command → CallConnected 이후:** 통화 연결 전에는 미디어 재생/녹음 불가
2. **DTMF → telephone-event 협상:** SDP 협상에서 telephone-event 활성화되어야 RFC 2833 사용 가능
3. **코덱 → SIP Instance 설정:** 코덱 선택은 INVITE 전에 SIP Instance에서 설정
4. **녹음 → RTP 세션 활성:** RTP 스트림이 흐를 때만 녹음 가능

---

## MVP (v1.1) 권장

v1.1 마일스톤에 우선순위:

### 필수 (Phase 1)
1. **PlayAudio Command** — WAV 파일 재생 (PCMA/PCMU만)
2. **SendDTMF Command** — RFC 2833 DTMF 송신
3. **DTMFReceived Event 강화** — digit 값 캡처, timeout
4. **코덱 선택 (기본)** — SIP Instance에 PCMA/PCMU 우선순위 설정

### 필수 (Phase 2)
5. **StartRecording/StopRecording Command** — 통화 녹음 (stereo WAV)

### MVP 이후로 연기
- **Opus 코덱 지원:** dynamic payload type 처리 복잡도 (v1.2 고려)
- **DTMF SIP INFO 폴백:** RFC 2833만으로 대부분 시나리오 커버
- **DTMF 패턴 검증:** 기본 expectedDigit만 구현, 정규식 패턴은 향후
- **코덱 협상 이벤트:** CodecNegotiated Event는 고급 시나리오 (향후)
- **MP3 재생 지원:** WAV만으로 충분, 향후 확장

---

## 노드 통합 설계

### 새 Command 노드

| Command | 용도 | 속성 |
|---------|------|------|
| **PlayAudio** | WAV 파일 재생 | audioFile, loop, stopOnDTMF |
| **SendDTMF** | DTMF 송신 | digits, method, duration, interval |
| **StartRecording** | 녹음 시작 | outputPath, format |
| **StopRecording** | 녹음 중지 | (없음) |

### 강화할 Event 노드

| Event | 강화 내용 |
|-------|-----------|
| **DTMFReceived** | digit 값 캡처, expectedDigit 속성, timeout |

### SIP Instance 노드 확장

| 새 속성 | 용도 |
|---------|------|
| **codecs** | 선호 코덱 목록 + 우선순위 |
| **enableDTMF** | telephone-event 협상 활성화 |

---

## TypeScript 타입 정의 (예시)

```typescript
// 기존 COMMAND_TYPES 확장
export const COMMAND_TYPES = [
  'MakeCall', 'Answer', 'Release',
  'PlayAudio', 'SendDTMF', 'StartRecording', 'StopRecording',
] as const;

// PlayAudio Command 속성
export interface PlayAudioCommandData extends CommandNodeData {
  command: 'PlayAudio';
  audioFile: string;           // 파일 경로
  loop?: boolean;              // 기본: false
  stopOnDTMF?: boolean;        // 기본: false
}

// SendDTMF Command 속성
export interface SendDTMFCommandData extends CommandNodeData {
  command: 'SendDTMF';
  digits: string;              // "1234", "*", "#" 등
  method?: 'auto' | 'rfc2833' | 'sip_info';  // 기본: 'auto'
  duration?: number;           // ms per digit, 기본: 100
  interval?: number;           // ms between digits, 기본: 100
}

// StartRecording Command 속성
export interface StartRecordingCommandData extends CommandNodeData {
  command: 'StartRecording';
  outputPath: string;          // WAV 파일 경로
  format?: 'mono' | 'stereo';  // 기본: 'mono'
}

// StopRecording Command 속성
export interface StopRecordingCommandData extends CommandNodeData {
  command: 'StopRecording';
}

// DTMFReceived Event 강화
export interface DTMFReceivedEventData extends EventNodeData {
  event: 'DTMFReceived';
  expectedDigit?: string;      // "1", "2-5", "*" 등 (optional)
  timeout: number;             // ms
}

// SipInstance 노드 미디어 속성 확장
export interface SipInstanceNodeData extends Record<string, unknown> {
  // 기존 속성
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string;

  // 새 미디어 속성
  codecs?: Array<{ name: string; priority: number }>;
  enableDTMF?: boolean;        // 기본: true
}
```

---

## UI/UX 권장사항

### Properties Panel

**PlayAudio Command:**
- 파일 경로 입력란 + "Browse..." 버튼 (Wails 파일 다이얼로그)
- loop 체크박스
- stopOnDTMF 체크박스
- 미리듣기 버튼 (선택적, 향후)

**SendDTMF Command:**
- digits 입력란 (텍스트)
- method 드롭다운 (auto/rfc2833/sip_info)
- duration/interval 슬라이더 (50-500ms)

**StartRecording Command:**
- outputPath 입력란 + "Browse..." 버튼
- format 라디오 버튼 (mono/stereo)

**SIP Instance (코덱 설정):**
- 코덱 목록 (드래그로 우선순위 변경)
- enableDTMF 체크박스

### Node Palette

**Media Commands 섹션 추가:**
```
📁 Media Commands
  ▶ PlayAudio
  ▶ SendDTMF
  ▶ StartRecording
  ▶ StopRecording
```

### Execution Timeline

**미디어 이벤트 로깅:**
- `[10:30:01.234] [instance-1] PlayAudio: menu.wav started`
- `[10:30:03.456] [instance-1] DTMF Received: "1" (rfc2833)`
- `[10:30:05.678] [instance-1] Recording started: /recordings/call-001.wav`

---

## 참고 구현: diago 라이브러리

**diago의 미디어 기능 확인 필요:**
- RTP 스트림 송수신 API
- DTMF (RFC 2833) 송수신 메서드
- 코덱 협상 제어 (SDP manipulation)
- 오디오 파일 → RTP 패킷 변환

**예상 구현 레이어:**
```
[Frontend: PlayAudio 노드]
       ↓ Wails Binding
[Backend: PlayAudioCommand]
       ↓
[diago: RTP sender + WAV decoder]
       ↓ RTP packets
[원격 SIP UA]
```

**리서치 플래그:**
- diago가 RTP 미디어를 직접 지원하는지 확인
- 지원 안 하면 RTP 라이브러리 (pion/webrtc) 추가 필요
- 이 부분은 Phase별 리서치에서 상세 조사 필요 (HIGH 우선순위)

---

## 복잡도 평가

| 기능 | 복잡도 | 주요 챌린지 |
|------|--------|-------------|
| PlayAudio | **중간** | WAV 디코딩, RTP 패킷 생성, 타이밍 제어 |
| SendDTMF | **낮음** | RFC 2833 이벤트 생성만, diago 지원 예상 |
| DTMFReceived 강화 | **낮음** | 이벤트 속성 확장, 프론트엔드 UI 추가 |
| StartRecording | **중간** | RTP 스트림 캡처, WAV 인코딩, 파일 쓰기 |
| StopRecording | **낮음** | 녹음 세션 종료, 파일 닫기 |
| 코덱 선택 | **낮음** | SDP m= 라인 조작, diago API 활용 |
| Opus 코덱 | **높음** | dynamic payload type 협상, 디코딩 복잡도 |

---

## 소스

### SIP 미디어 재생
- [VoIP Media Session - sipsorcery](https://sipsorcery-org.github.io/sipsorcery/articles/voipmediasession.html)
- [How to play an mp3 file into a voice call using csharp](https://voip-sip-sdk.com/p_7345-how-to-play-an-mp3-file-into-a-voice-call-using-csharp.html)
- [SIP IVR - Sonetel](https://sonetel.com/en/sip-trunking/help/sip-ivr/)

### 통화 녹음
- [How to record voip sip voice call](https://voip-sip-sdk.com/p_7362-how-to-record-voip-sip-voice-call.html)
- [VoIPmonitor® | VoIP & SIP Monitoring & Call Recording](https://www.voipmonitor.org/)
- [Call Recordings | PortSIP Knowledge Base](https://support.portsip.com/portsip-communications-solution/portsip-pbx-administration-guide/20-cdr-and-call-recordings/call-recordings)

### DTMF
- [RFC 2833: RTP Payload for DTMF Digits](https://datatracker.ietf.org/doc/html/rfc2833)
- [DTMF over IP – SIP INFO, Inband & RTP Events](https://nickvsnetworking.com/dtmf-over-ip-sip-info-inband-rtp-events/)
- [Understand the DTMF in SIP Call – Yeastar Support](https://support.yeastar.com/hc/en-us/articles/360038941513-Understand-the-DTMF-in-SIP-Call)

### 코덱 협상
- [SIP - The Offer/Answer Model](https://www.tutorialspoint.com/session_initiation_protocol/session_initiation_protocol_the_offer_answer_model.htm)
- [Understanding Media in SIP Session Description Protocol (SDP)](https://teraquant.com/understand-media-sip-session-description-protocol/)
- [Understanding codec negotiation](https://wiki.4psa.com/display/KB/Understanding+codec+negotiation)

### IVR 패턴
- [IVR Call Flow: Benefits and Best Practices](https://getvoip.com/blog/ivr-call-flow/)
- [DTMF IVR Explained: What Is are DTMF Tones & How They Works](https://upfirst.ai/blog/dtmf-ivr)
- [IVR Workflow Steps - Dialpad](https://help.dialpad.com/docs/workflow-steps)

### SIP 테스팅 툴
- [MAPS™ SIP Protocol Emulator](https://www.gl.com/sip-rtp-protocol-simulator-maps.html)
- [StarTrinity SIP Tester™](http://startrinity.com/VoIP/SipTester/SipTester.aspx)
- [Handling media with SIPp](https://sipp.readthedocs.io/en/latest/media.html)

### VoIP 함정
- [Most Common VoIP Problems and How to Fix Them in 2026](https://telxi.com/blog/voip-problems/)
- [Debugging and troubleshooting VoIP problems](https://www.voip-info.org/how-to-debug-and-troubleshoot-voip/)

---

## 신뢰도 평가

| 영역 | 신뢰도 | 이유 |
|------|--------|------|
| PlayAudio | **MEDIUM** | 패턴은 명확하지만 diago RTP 지원 확인 필요 |
| Recording | **MEDIUM** | RTP 캡처는 표준이지만 구현 디테일 검증 필요 |
| DTMF | **HIGH** | RFC 2833은 표준, 여러 소스 일치 |
| 코덱 협상 | **HIGH** | SDP offer/answer는 표준 (RFC 3264) |
| 노드 통합 | **HIGH** | 기존 Command/Event 아키텍처 확장만 |

**LOW 신뢰도 항목:**
- diago의 정확한 RTP API (문서 부족, 소스 코드 확인 필요)
- Opus dynamic payload type 처리 디테일

**검증 필요:**
- diago 라이브러리 RTP 미디어 기능 (Context7/GitHub 확인)
- WAV 파일 → RTP 변환 구현 방법
- 녹음 파일 포맷 상세 (WAV 헤더, PCM 인코딩)
