# 도메인 함정: SIP 미디어 재생/녹음/DTMF 기능 추가

**도메인:** SIP Call Flow Simulator — Media Playback, Recording, DTMF, Codec 기능 추가
**리서치일:** 2026-02-11
**프로젝트:** SIPFLOW v1.1 (diago v0.27.0 기반)

---

## 치명적 함정

재작업이나 주요 이슈를 일으키는 실수.

### 함정 1: diago DialogMedia 초기화 순서 오류

**잘못되는 것:**
`DialogSession.Media()` 호출을 SDP 협상 완료 전에 호출하거나, Answer/200 OK + ACK 교환 전에 미디어 세션을 초기화하려고 시도하면 nil RTP 세션 오류 발생.

**왜 발생하는지:**
diago의 `InitMediaSession()` → `initRTPSessionUnsafe()` 체인은 SDP 협상이 완료되어야만 RTP 세션을 생성함. 이전 버전(v0.27.0)의 diago는 내부적으로 early media 체크(`checkEarlyMedia()`)를 통해 RTP 세션이 null인지 확인하지만, 사용자가 명시적으로 `Media()` 호출 시점을 제어해야 함.

**결과:**
- `panic: runtime error: invalid memory address or nil pointer dereference`
- 미디어 재생/녹음이 전혀 작동하지 않음
- 통화는 성공하지만 미디어 스트림 없음 (one-way audio)

**예방:**
```go
// ❌ 잘못된 순서
dialog, err := ua.Invite(ctx, recipient, opts)
media := dialog.Media() // 너무 이름 — RTP 세션 아직 없음
pb, _ := media.PlaybackCreate()

// ✅ 올바른 순서
dialog, err := ua.Invite(ctx, recipient, opts)
// Invite는 200 OK + ACK까지 대기 (SDP 협상 완료)
media := dialog.Media() // 안전: RTP 세션 초기화됨
pb, _ := media.PlaybackCreate()

// ✅ Answer 시나리오
serverSession.Answer() // SDP 교환 완료
media := serverSession.Media() // 안전
rec, _ := media.AudioStereoRecordingCreate(wavFile)
```

**탐지:**
- 로그에 "early media detected but RTP session not initialized" 경고
- `dialog.Context().Done()` 체크 후에도 미디어 API 호출 시 nil pointer 에러
- Wireshark로 SDP 교환 확인 — m=audio 라인이 없으면 RTP 세션 없음

**관련 기존 이슈:**
SIPFLOW는 이미 `executeMakeCall`에서 `Invite()`가 blocking하여 200 OK까지 대기하므로 비교적 안전. 하지만 **IncomingCall + Answer 시나리오**에서 `Answer()` 호출 즉시 `Media()` 접근하면 race condition 가능.

---

### 함정 2: WAV 파일 포맷 불일치로 인한 재생 실패

**잘못되는 것:**
임의의 WAV 파일(44.1kHz stereo, 16-bit)을 RTP 스트림에 직접 재생하려고 하면 디코딩 실패하거나 재생 속도가 2배 빠르거나 느림.

**왜 발생하는지:**
- SIP/RTP는 표준적으로 **8kHz 샘플레이트, mono, μ-law(PCMU) 또는 A-law(PCMA)** 코덱 사용
- diago의 `PlaybackCreate()`는 협상된 코덱에 맞춰 RTP 패킷을 생성하는데, WAV 헤더와 코덱이 불일치하면 샘플 수 계산 오류 발생
- 44.1kHz stereo WAV를 8kHz mono로 변환 없이 재생 시: 각 샘플이 2개로 분리되어 2배 길이로 재생됨 ([소스](https://github.com/sipwise/rtpengine/issues/886))

**결과:**
- 재생 속도 왜곡 (chipmunk voice 또는 slow motion)
- 재생 길이가 실제 파일 길이와 불일치
- 일부 코덱에서는 완전히 디코딩 실패 (G.729 압축 시 in-band DTMF 불가능)

**예방:**
1. **WAV 파일 표준화 필수:**
   ```bash
   # ffmpeg로 변환 (PCMU/PCMA 호환 포맷)
   ffmpeg -i input.wav -ar 8000 -ac 1 -acodec pcm_mulaw output.wav
   # -ar 8000: 8kHz 샘플레이트
   # -ac 1: mono
   # -acodec pcm_mulaw: μ-law (PCMU)
   ```

2. **코드에서 WAV 헤더 검증:**
   ```go
   import "github.com/go-audio/wav"

   decoder := wav.NewDecoder(file)
   if !decoder.IsValidFile() {
       return fmt.Errorf("invalid WAV file")
   }
   format := decoder.Format()
   if format.SampleRate != 8000 || format.NumChannels != 1 {
       return fmt.Errorf("WAV must be 8kHz mono, got %dHz %d-channel",
           format.SampleRate, format.NumChannels)
   }
   ```

3. **SIPFLOW UI에 명시적 경고:**
   - "WAV 파일 요구사항: 8kHz, Mono, PCM μ-law 또는 A-law"
   - 파일 선택 시 자동 검증 + 변환 옵션 제공

**탐지:**
- 재생 속도가 기대와 다름 (QA 테스트 시 들어보면 명확)
- RTP 디버그 로그에서 timestamp 증가량이 이상함 (`media.RTPDebug` 활성화)
- Wireshark로 RTP payload 확인 — clock rate 불일치

**관련 소스:**
- [RTP Payload Formats (Wikipedia)](https://en.wikipedia.org/wiki/RTP_payload_formats)
- [G.711 PCMU/PCMA spec](https://en.wikipedia.org/wiki/G.711)

---

### 함정 3: 코덱 불일치로 미디어 스트림 실패 (488 Not Acceptable)

**잘못되는 것:**
SIPFLOW의 두 인스턴스가 서로 다른 코덱을 지원하도록 설정되어 있고(Instance A: PCMU만, Instance B: PCMA만), 중간에 transcoding 없이 통화 시도 시 SDP 협상 실패로 통화 불가.

**왜 발생하는지:**
- SIP SDP 협상 시 양쪽이 공통으로 지원하는 코덱이 없으면 **488 Not Acceptable Media** 응답
- diago Bridge는 **transcoding을 지원하지 않음** — 양쪽 Dialog가 동일 코덱을 협상해야 함
- 기존 PROJECT.md에 명시: "diago Bridge는 코덱 호환성 필수 (트랜스코딩 미지원)"

**결과:**
- INVITE → 488 Not Acceptable Here 응답 → 통화 설정 실패
- "No audio" 문제 (양쪽 다 들리지 않음)
- CPU 부하가 높아짐 (transcoding 시도하다가 실패)

**예방:**
1. **SIPFLOW UI에 코덱 선택 기능 추가 시 기본값 설정:**
   ```go
   // SipInstanceConfig에 Codecs 필드 추가
   type SipInstanceConfig struct {
       DN      string   `json:"dn"`
       Codecs  []string `json:"codecs"` // 기본값: ["PCMU", "PCMA"]
   }
   ```

2. **SDP Offer/Answer 검증 로직:**
   ```go
   // Invite 전에 양쪽 인스턴스의 코덱 교집합 확인
   func validateCodecCompatibility(instanceA, instanceB *SipInstanceConfig) error {
       common := intersection(instanceA.Codecs, instanceB.Codecs)
       if len(common) == 0 {
           return fmt.Errorf("no common codec between %s and %s",
               instanceA.DN, instanceB.DN)
       }
       return nil
   }
   ```

3. **시뮬레이션 모드 vs 실제 모드 차이:**
   - **시뮬레이션 모드**: 로컬에서 양쪽 모두 제어 가능 → 코덱 사전 검증 가능
   - **실제 모드**: 외부 SIP 서버와 통신 → 서버가 지원하는 코덱 미리 파악 불가 → **fallback 코덱 목록 필수** (PCMU를 항상 포함 — RFC 권장)

**탐지:**
- SIP 응답 코드 488
- 로그에 "no matching codec found in SDP answer"
- Wireshark로 SDP m=audio 라인 확인 — Offer와 Answer의 payload type 불일치

**관련 소스:**
- [Asterisk Codec Mismatch Troubleshooting](https://kingasterisk.com/codec-mismatch-problems-in-asterisk/)
- [FreeSWITCH Codec Negotiation](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Codecs-and-Media/Codec-Negotiation_2883752/)

---

### 함정 4: 녹음 파일 동시 쓰기 Race Condition

**잘못되는 것:**
여러 goroutine(멀티 인스턴스 병렬 실행)이 동일한 WAV 파일에 동시에 쓰기 시도하면 파일 손상 또는 panic 발생.

**왜 발생하는지:**
- SIPFLOW는 "인스턴스별 goroutine"으로 병렬 실행 (`ExecuteChain`이 각 인스턴스마다 별도 고루틴)
- `os.File.Write()`는 **atomic하지 않음** ([golang issue #49877](https://github.com/golang/go/issues/49877))
- diago의 `AudioStereoRecordingCreate(wavFile *os.File)`는 호출자가 파일 라이프사이클 관리 책임
- 여러 인스턴스가 같은 파일 경로를 지정하면 race condition 발생

**결과:**
- WAV 파일 헤더 손상 (재생 불가)
- 인터리브된 오디오 데이터 (2개 통화의 샘플이 뒤섞임)
- `panic: concurrent map writes` 또는 파일 I/O 에러

**예방:**
1. **인스턴스별 고유 파일명 강제:**
   ```go
   // ❌ 잘못된 예
   wavFile, _ := os.Create("recording.wav") // 모든 인스턴스가 같은 파일 사용

   // ✅ 올바른 예
   filename := fmt.Sprintf("recording_%s_%d.wav", instanceID, time.Now().Unix())
   wavFile, _ := os.Create(filename)
   ```

2. **Mutex로 파일 접근 보호 (같은 파일 공유 필요 시):**
   ```go
   import "sync"

   var recordingMutex sync.Mutex

   func writeAudioData(file *os.File, data []byte) error {
       recordingMutex.Lock()
       defer recordingMutex.Unlock()
       _, err := file.Write(data)
       return err
   }
   ```

3. **SIPFLOW 설계 권장:**
   - **각 인스턴스마다 독립적인 녹음 파일** (인스턴스 ID 포함)
   - UI에서 녹음 파일 경로 입력 시 `{{instanceID}}` 템플릿 변수 제공
   - 예: `recordings/{{instanceID}}_{{timestamp}}.wav`

**탐지:**
- `go test -race`로 race detector 활성화 시 경고
- 녹음 파일 재생 시 "file is corrupted" 에러
- 여러 통화의 오디오가 뒤섞여 들림

**관련 소스:**
- [Go Data Race Detector](https://go.dev/doc/articles/race_detector)
- [Concurrency Safe File Access in Go](https://echorand.me/posts/go-file-mutex/)

---

### 함정 5: RTP Timestamp 동기화 실패로 인한 재생 타이밍 오류

**잘못되는 것:**
오디오 재생 시 RTP timestamp를 수동으로 관리하지 않고 단순히 패킷을 전송하면 지터/끊김/속도 불일치 발생.

**왜 발생하는지:**
- RTP timestamp는 샘플 단위로 증가해야 함 (8kHz 샘플레이트 시 20ms 패킷 = 160 샘플)
- diago `PlaybackCreate()`는 "automatic RTP timestamp resets" 제공하지만, 사용자가 `Play()` 호출 간격을 잘못 관리하면 timestamp jump 발생
- Jitter buffer가 예상치 못한 timestamp 증가량을 받으면 버퍼 리셋 → 오디오 끊김

**결과:**
- 재생 속도가 일정하지 않음 (빨라졌다 느려졌다)
- 오디오 끊김 (choppy audio)
- 수신 측에서 "jitter buffer constantly resizing" 로그

**예방:**
1. **diago의 자동 timestamp 관리 활용:**
   ```go
   pb, err := media.PlaybackCreate()
   if err != nil {
       return err
   }
   // Play는 내부적으로 timestamp 관리
   err = pb.Play("/path/to/file.wav", "audio/wav")
   ```

2. **수동 RTP 전송 시 timestamp 계산:**
   ```go
   const sampleRate = 8000
   const packetDuration = 20 * time.Millisecond
   samplesPerPacket := int(sampleRate * packetDuration.Seconds())

   timestamp := uint32(0)
   for _, packet := range audioPackets {
       rtpPacket := &rtp.Packet{
           Header: rtp.Header{
               Timestamp: timestamp,
               // ...
           },
           Payload: packet,
       }
       // send rtpPacket
       timestamp += uint32(samplesPerPacket) // 160 증가 (20ms @ 8kHz)
   }
   ```

3. **네트워크 지터 대응:**
   - 수신 측에 적절한 jitter buffer 크기 설정
   - 패킷 전송 간격을 일정하게 유지 (`time.Ticker` 사용)

**탐지:**
- Wireshark에서 RTP stream analysis — "timestamp jump" 경고
- `media.RTPDebug` 활성화 시 timestamp 증가량 로그 확인
- VoIP 품질 저하 (MOS 점수 낮음)

**관련 소스:**
- [Jitter Buffer in Go (pion)](https://pkg.go.dev/github.com/pion/interceptor/pkg/jitterbuffer)
- [RTP Timing Issues](https://thelinuxcode.com/voice-over-internet-protocol-voip-how-internet-voice-calls-actually-work-and-how-to-build-them-reliably-in-2026/)

---

## 중간 함정

지연이나 기술 부채를 일으키는 실수.

### 함정 6: DTMF RFC 2833 vs In-Band 선택 오류

**잘못되는 것:**
압축 코덱(G.729) 사용 시 in-band DTMF를 활성화하면 DTMF 감지 실패율이 높아짐.

**왜 발생하는지:**
- **In-band DTMF**: 오디오 스트림에 톤을 직접 삽입 → 코덱 압축 시 톤 왜곡 → 감지 실패
- **RFC 2833 (out-of-band)**: 별도 RTP event 패킷으로 DTMF 전송 → 코덱 독립적 → 높은 신뢰도
- diago는 `AudioWriterDTMF()` / `AudioReaderDTMF()`로 RFC 2833 지원하지만, 사용자가 명시적으로 활성화해야 함

**예방:**
1. **RFC 2833을 기본값으로 사용:**
   ```go
   // DTMF 전송
   dtmfWriter := media.AudioWriterDTMF()
   dtmfWriter.WriteDTMF('1') // RTP event로 전송

   // DTMF 수신
   dtmfReader := media.AudioReaderDTMF()
   dtmfReader.Listen(func(dtmf rune) error {
       log.Printf("DTMF received: %c", dtmf)
       return nil
   }, 5*time.Second)
   ```

2. **In-band는 G.711(PCMU/PCMA) 전용으로 제한:**
   - UI에서 코덱 선택 시 "G.729 사용 시 RFC 2833 필수" 경고

3. **DTMF 감지 타임아웃 적절히 설정:**
   - `Listen(onDTMF, duration)` — 너무 짧으면 놓침, 너무 길면 blocking

**탐지:**
- DTMF 입력했는데 이벤트 미발생
- 로그에 "DTMF detection timeout"
- Wireshark로 RTP event 패킷 확인 (payload type 101 typically)

**관련 소스:**
- [DTMF RFC 2833 vs In-Band](https://voipnuggets.com/2023/06/12/different-types-of-dtmf-in-sip-and-why-dtmf-via-rfc2833-is-more-reliable/)
- [DTMF Over IP](https://nickvsnetworking.com/dtmf-over-ip-sip-info-inband-rtp-events/)

---

### 함정 7: Early Media (183 Session Progress) 처리 누락

**잘못되는 것:**
183 Session Progress 응답 후 RTP 스트림이 시작되었는데도 `Media()` 호출을 200 OK까지 기다리면 초기 미디어(예: 안내 멘트) 놓침.

**왜 발생하는지:**
- SIP early media는 통화 연결 전에 미디어 전송 가능 (예: "모든 상담원이 통화 중입니다")
- 183 응답에 SDP가 포함되면 RTP 세션이 먼저 시작될 수 있음
- SIPFLOW의 현재 `executeMakeCall`은 `Invite()`가 200 OK까지 blocking하므로 early media 시나리오 미지원

**예방:**
1. **Early Media Event 노드 추가:**
   ```go
   // Event 노드: "EARLY_MEDIA"
   // 183 Session Progress 수신 + SDP 있으면 트리거

   func executeEarlyMedia(ctx context.Context, instanceID string, node *GraphNode) error {
       instance, _ := ex.im.GetInstance(instanceID)
       // diago checkEarlyMedia() 활용
       media := dialog.Media()
       if media != nil {
           // early media 재생 가능
           pb, _ := media.PlaybackCreate()
           pb.Play(earlyMediaFile, "audio/wav")
       }
       return nil
   }
   ```

2. **UI에서 Early Media 옵션:**
   - "Early Media 재생 활성화" 체크박스
   - 183 응답 시 자동으로 미디어 재생 시작

**탐지:**
- 로그에 "183 Session Progress received with SDP"
- 200 OK 전에 Wireshark에서 RTP 패킷 관찰됨
- 사용자가 "초기 멘트가 안 들린다" 보고

**관련 소스:**
- [Early Media in SIP](https://www.dialogic.com/webhelp/csp1010/8.4.1_ipn3/sip_software_chap_-_early_media.htm)
- [180 vs 183 vs Early Media](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Codecs-and-Media/Early-Media/vs-183-vs-Early-Media_7143480/)

---

### 함정 8: 미디어 리소스 정리 순서 오류 (파일 핸들 누수)

**잘못되는 것:**
통화 종료 시 `dialog.Close()` 만 호출하고 WAV 파일 핸들이나 미디어 스트림을 명시적으로 정리하지 않으면 파일 디스크립터 누수 발생.

**왜 발생하는지:**
- diago `AudioStereoRecordingCreate(wavFile *os.File)`는 호출자가 파일 라이프사이클 관리 책임
- `dialog.Close()`는 내부적으로 `onClose` 훅 → RTP 세션 → 미디어 세션 순서로 정리하지만, 외부에서 생성한 파일 핸들은 자동 닫기 안 함
- 여러 통화 반복 시 파일 디스크립터 고갈 → "too many open files" 에러

**예방:**
1. **Cleanup 순서 명확히:**
   ```go
   // 기존 SessionStore 패턴 확장
   type SessionStore struct {
       // ...
       recordingFiles map[string]*os.File // instanceID -> recording file
   }

   func (ss *SessionStore) CloseAll() {
       ss.mu.Lock()
       defer ss.mu.Unlock()

       // 1. Hangup (BYE 전송)
       for _, dialog := range ss.dialogs {
           _ = dialog.Hangup(ctx)
       }

       // 2. Close dialogs (RTP 세션 종료)
       for _, dialog := range ss.dialogs {
           _ = dialog.Close()
       }

       // 3. Close recording files
       for _, file := range ss.recordingFiles {
           _ = file.Close()
       }
   }
   ```

2. **defer로 파일 정리 보장:**
   ```go
   func executeRecording(ctx context.Context, instanceID string, node *GraphNode) error {
       wavFile, err := os.Create(filename)
       if err != nil {
           return err
       }
       defer wavFile.Close() // 확실히 닫기

       media := dialog.Media()
       rec, err := media.AudioStereoRecordingCreate(wavFile)
       if err != nil {
           return err
       }

       // 녹음 시작
       rec.ListenBackground(ctx)

       return nil
   }
   ```

3. **SIPFLOW의 기존 cleanup 패턴 유지:**
   - 현재 `Hangup → Close → IM.Cleanup` 순서에 **파일 정리 단계 추가**

**탐지:**
- 여러 시나리오 실행 후 `lsof -p <pid> | wc -l`로 파일 디스크립터 증가 확인
- "too many open files" 에러
- 녹음 파일이 불완전하게 저장됨 (헤더 없음)

**관련 소스:**
- [diago DialogMedia Close() 패턴](https://github.com/emiago/diago/blob/main/dialog_media.go)

---

### 함정 9: 시뮬레이션 모드와 실제 모드의 미디어 동작 차이

**잘못되는 것:**
로컬 시뮬레이션 모드에서는 잘 작동하던 미디어 재생이 실제 SIP 서버 연결 시 작동하지 않거나, 반대로 시뮬레이션에서만 실패.

**왜 발생하는지:**
- **시뮬레이션 모드 (localhost)**: 네트워크 지연 없음, 패킷 로스 없음, NAT 없음
- **실제 모드**: 방화벽, NAT, 비대칭 라우팅 등으로 RTP 포트가 막히거나 SDP IP가 잘못됨
- 기존 이슈: "diago localhost 포트 충돌" — 포트 순차 할당 +2 간격 패턴이 로컬에서만 충돌 가능

**예방:**
1. **RTP 포트 범위 명시적 설정:**
   ```go
   // 시뮬레이션 모드: 좁은 범위 (5060~5080)
   // 실제 모드: 넓은 범위 (10000~20000)

   if config.Mode == "simulation" {
       rtpPortRange = PortRange{Min: 5060, Max: 5080}
   } else {
       rtpPortRange = PortRange{Min: 10000, Max: 20000}
   }
   ```

2. **NAT/방화벽 대응:**
   - 실제 모드에서 SDP에 공인 IP 삽입 (STUN/TURN 활용)
   - RTP 포트가 방화벽에 열려 있는지 확인

3. **SIPFLOW 통합 테스트 주의:**
   - 현재 `integration_test.go`가 "diago localhost 포트 충돌로 Skip"됨
   - 미디어 기능 추가 시 **실제 SIP 서버로 E2E 테스트 필수**

**탐지:**
- 로컬에서는 성공, 원격 서버에서는 "no audio" 또는 488 에러
- Wireshark로 RTP 패킷이 방화벽에서 DROP되는지 확인
- SDP의 c=IN IP4 주소가 private IP(127.0.0.1)인지 확인

**관련 소스:**
- [SIP RTP Routing and NAT](https://www.asterisk.org/sip-and-rtp-routing/)
- [One-Way Audio Troubleshooting](https://blog.opensips.org/2023/07/06/troubleshooting-one-way-audio-calls/)

---

### 함정 10: 포트 순차 할당 충돌 (기존 패턴 확장 시)

**잘못되는 것:**
RTP 포트도 +2 간격으로 할당하려다가 SIP 포트(5060~)와 겹치거나, 여러 인스턴스 생성 시 포트 고갈.

**왜 발생하는지:**
- 기존 `InstanceManager.allocatePort()`는 SIP 시그널링 포트를 +2 간격으로 할당 (5060, 5062, 5064...)
- RTP는 일반적으로 **짝수 포트**(RTP) + **홀수 포트**(RTCP) 쌍으로 사용
- diago는 RTP 포트를 자동 할당하지만, 사용자가 명시적으로 지정 시 충돌 가능

**예방:**
1. **SIP와 RTP 포트 범위 분리:**
   ```go
   const (
       sipBasePort  = 5060
       rtpBasePort  = 10000 // 별도 범위
   )
   ```

2. **RTP 포트 쌍 할당 로직:**
   ```go
   func allocateRTPPortPair() (rtpPort int, rtcpPort int, err error) {
       for i := 0; i < maxRetries; i++ {
           rtpPort = rtpBasePort + (i * 2)     // 짝수
           rtcpPort = rtpPort + 1              // 홀수

           // 양쪽 모두 가용성 테스트
           if isPortAvailable(rtpPort) && isPortAvailable(rtcpPort) {
               return rtpPort, rtcpPort, nil
           }
       }
       return 0, 0, fmt.Errorf("failed to allocate RTP port pair")
   }
   ```

**탐지:**
- "Failed to get 2 consecutive ports on interface" 에러
- 여러 인스턴스 생성 시 특정 개수 이상에서 실패
- Wireshark로 RTP/RTCP 포트 확인

**관련 소스:**
- [RTP Port Allocation Issues](https://groups.google.com/g/rtpengine/c/USmO5UC-W_k)

---

## 사소한 함정

짜증나지만 수정 가능한 실수.

### 함정 11: WAV 헤더 쓰기 타이밍 오류

**잘못되는 것:**
녹음 시작 시 WAV 헤더를 먼저 쓰지 않고 오디오 데이터부터 쓰면 파일 손상.

**예방:**
```go
// diago AudioStereoRecordingCreate 사용 시 자동 처리됨
// 수동 구현 시 반드시 헤더 먼저 쓰기
wavEncoder := wav.NewEncoder(file, sampleRate, bitDepth, numChannels, audioFormat)
defer wavEncoder.Close() // Close 시 헤더 업데이트 (총 샘플 수)
```

---

### 함정 12: DTMF 감지 타임아웃 너무 짧음

**잘못되는 것:**
`Listen(onDTMF, 100*time.Millisecond)` — DTMF 톤은 보통 100~200ms 지속되므로 너무 짧은 타임아웃은 감지 실패.

**예방:**
```go
// 최소 500ms 이상 권장
dtmfReader.Listen(func(dtmf rune) error {
    log.Printf("DTMF: %c", dtmf)
    return nil
}, 500*time.Millisecond)
```

---

### 함정 13: 코덱 이름 대소문자 불일치

**잘못되는 것:**
SDP에서 "pcmu"와 "PCMU"를 다르게 인식하여 협상 실패.

**예방:**
```go
codecName = strings.ToUpper(codecName) // 항상 대문자로 정규화
```

---

## 페이즈별 경고

v1.1 마일스톤을 여러 페이즈로 나눌 경우 각 페이즈에서 주의할 함정.

| 페이즈 주제 | 있을 법한 함정 | 완화 |
|-------------|----------------|------|
| **Phase 1: 미디어 재생** | 함정 1 (초기화 순서), 함정 2 (WAV 포맷), 함정 5 (RTP 타이밍) | diago API 문서 정독, WAV 검증 로직 우선 구현, 타이밍 테스트 |
| **Phase 2: 통화 녹음** | 함정 4 (동시 쓰기), 함정 8 (리소스 정리), 함정 11 (헤더 타이밍) | 인스턴스별 파일명 강제, defer 패턴, diago API 활용 |
| **Phase 3: DTMF 송수신** | 함정 6 (RFC 2833 vs In-band), 함정 12 (타임아웃) | RFC 2833 기본값, 타임아웃 500ms 이상 |
| **Phase 4: 코덱 선택 UI** | 함정 3 (코덱 불일치), 함정 13 (대소문자) | 협상 전 검증, 대문자 정규화 |
| **Phase 5: 통합 테스트** | 함정 9 (시뮬레이션 vs 실제), 함정 10 (포트 충돌) | 실제 SIP 서버 테스트, 포트 범위 분리 |

---

## 신뢰도 평가

| 영역 | 신뢰도 | 근거 |
|------|--------|------|
| diago API 사용법 | **MEDIUM** | GitHub 소스 분석 + WebFetch 기반, 하지만 v0.27.0 특정 변경사항 미확인 |
| WAV 포맷 요구사항 | **HIGH** | RTP RFC, G.711 스펙으로 검증됨 |
| 코덱 협상 이슈 | **HIGH** | 여러 SIP 스택(FreeSWITCH, Asterisk) 문서와 일치 |
| DTMF 정확도 | **HIGH** | RFC 2833 vs in-band는 업계 표준 권장사항 |
| 동시성 이슈 | **HIGH** | Go 공식 문서 + race detector 패턴 |
| 시뮬레이션 vs 실제 모드 | **MEDIUM** | 기존 SIPFLOW 코드에서 추론, 실제 테스트 필요 |

---

## 리서치 소스

### diago 라이브러리
- [GitHub - emiago/diago](https://github.com/emiago/diago)
- [diago dialog_media.go 소스](https://github.com/emiago/diago/blob/main/dialog_media.go)
- [diago API Docs](https://emiago.github.io/diago/docs/api_docs/)
- [gophone CLI 예제](https://github.com/emiago/gophone)

### SIP/RTP 프로토콜
- [RTP Payload Formats - Wikipedia](https://en.wikipedia.org/wiki/RTP_payload_formats)
- [G.711 PCMU/PCMA - Wikipedia](https://en.wikipedia.org/wiki/G.711)
- [RFC 2833 - RTP Payload for DTMF](https://datatracker.ietf.org/doc/html/rfc2833)

### 미디어 함정 케이스
- [Troubleshooting One-Way Audio Calls - OpenSIPS](https://blog.opensips.org/2023/07/06/troubleshooting-one-way-audio-calls/)
- [DTMF RFC 2833 vs In-Band Reliability](https://voipnuggets.com/2023/06/12/different-types-of-dtmf-in-sip-and-why-dtmf-via-rfc2833-is-more-reliable/)
- [DTMF Over IP - Nick vs Networking](https://nickvsnetworking.com/dtmf-over-ip-sip-info-inband-rtp-events/)

### 코덱 협상
- [Asterisk Codec Mismatch Fix](https://kingasterisk.com/codec-mismatch-problems-in-asterisk/)
- [FreeSWITCH Codec Negotiation](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Codecs-and-Media/Codec-Negotiation_2883752/)

### Early Media
- [Early Media - Dialogic](https://www.dialogic.com/webhelp/csp1010/8.4.1_ipn3/sip_software_chap_-_early_media.htm)
- [180 vs 183 vs Early Media - FreeSWITCH](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Codecs-and-Media/Early-Media/vs-183-vs-Early-Media_7143480/)

### Go 동시성
- [Go Data Race Detector](https://go.dev/doc/articles/race_detector)
- [Concurrency Safe File Access in Go](https://echorand.me/posts/go-file-mutex/)
- [Go Mutex Tutorial](https://gobyexample.com/mutexes)

### RTP 타이밍
- [Jitter Buffer - pion/interceptor](https://pkg.go.dev/github.com/pion/interceptor/pkg/jitterbuffer)
- [VoIP Timing Issues 2026](https://thelinuxcode.com/voice-over-internet-protocol-voip-how-internet-voice-calls-actually-work-and-how-to-build-them-reliably-in-2026/)

### 포트 할당
- [RTP Port Allocation Issues](https://groups.google.com/g/rtpengine/c/USmO5UC-W_k)
- [SIP and RTP Routing - Asterisk](https://www.asterisk.org/sip-and-rtp-routing/)

---

## 추가 검증 필요 항목

다음 항목들은 LOW 신뢰도로, 실제 구현 전 추가 검증 필요:

1. **diago v0.27.0의 정확한 Hold/Unhold SDP 이슈** (GitHub issue #110 참조 필요)
2. **diago DialogSession의 Call-ID 접근 제한** (소스 코드에서 확인 필요)
3. **SIPFLOW 시뮬레이션 모드의 정확한 RTP 동작** (실제 테스트 필요)
4. **멀티 인스턴스 병렬 실행 시 최대 동시 녹음 파일 수** (성능 테스트 필요)

---

## 결론 및 권장사항

### 즉시 적용 가능한 예방 전략:

1. **WAV 파일 검증 로직을 미디어 재생 Phase 1에 우선 구현**
   - 8kHz, mono, PCM μ-law 검증
   - UI에 명시적 요구사항 표시

2. **녹음 파일명에 인스턴스 ID 강제**
   - 동시 쓰기 race condition 원천 차단

3. **RFC 2833을 DTMF 기본값으로 설정**
   - 코덱 독립성 확보

4. **미디어 리소스 정리 순서를 SessionStore에 통합**
   - 기존 Hangup → Close 패턴에 파일 Close 추가

5. **코덱 협상 사전 검증 로직 추가**
   - INVITE 전 양쪽 인스턴스의 코덱 교집합 확인

### 페이즈별 리서치 필요 여부:

- **Phase 1 (미디어 재생)**: 리서치 충분, diago API 문서 참고하며 구현
- **Phase 2 (통화 녹음)**: 리서치 충분, 동시성 테스트 강화 필요
- **Phase 3 (DTMF)**: 리서치 충분, RFC 2833 우선
- **Phase 4 (코덱 선택)**: 리서치 충분, UI/UX 설계에 집중
- **Phase 5 (통합 테스트)**: **추가 리서치 필요** — 실제 SIP 서버(Asterisk/FreeSWITCH) 연동 테스트 시나리오

### 위험도 높은 함정 Top 3:

1. **함정 1 (초기화 순서)** — 조기 감지 어려움, 전체 미디어 기능 차단
2. **함정 3 (코덱 불일치)** — 사용자 혼란 초래, 디버깅 어려움
3. **함정 4 (동시 쓰기)** — 간헐적 발생, 파일 손상 복구 불가

이 3가지를 우선적으로 예방 로직 구현 권장.
