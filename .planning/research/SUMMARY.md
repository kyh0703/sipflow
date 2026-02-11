# Research Summary: SIP Media Features (v1.1)

**Project:** SIPFLOW v1.1 — Media Playback + Recording Milestone
**Research Date:** 2026-02-11
**Overall Confidence:** HIGH

---

## Executive Summary

SIPFLOW v1.1은 기존 시나리오 빌더에 SIP 미디어 기능(재생, 녹음, DTMF, 코덱 선택)을 추가하는 마일스톤입니다. **핵심 발견:** 기존 diago v0.27.0 스택이 모든 필요한 미디어 API를 이미 제공하므로 새로운 SIP/RTP 라이브러리 추가는 불필요합니다. 단지 3개의 WAV/코덱 라이브러리만 추가하고, 기존 Command/Event 아키텍처를 확장하면 됩니다.

**추천 접근법:** 기존 v1.0 아키텍처를 재사용하며 점진적 확장. diago의 `DialogMedia` API가 재생/녹음/DTMF를 모두 지원하므로, backend는 `executePlayMedia()`, `executeSendDTMF()`, `executeRecord()` 등의 새 command handler만 추가하면 됩니다. Frontend는 새 Command/Event 노드를 팔레트에 추가하고, 미디어 파일 선택을 위한 Wails 다이얼로그를 통합합니다.

**핵심 위험과 완화:**
1. **DialogMedia 초기화 순서 오류** (치명적) → SDP 협상 완료 후에만 `Media()` 호출하도록 명시적 순서 강제
2. **WAV 포맷 불일치** (치명적) → 파일 업로드 시 8kHz mono PCM 검증 로직 추가
3. **코덱 협상 실패** (치명적) → PCMU를 기본 fallback으로, 코덱 교집합 사전 검증
4. **녹음 파일 동시 쓰기** (중간) → 인스턴스 ID 기반 파일명 자동 생성으로 race condition 원천 차단
5. **CGO 의존성** (회피 가능) → Opus 코덱을 v1.1에서 제외하여 크로스 컴파일 단순화

리서치 결과 모든 기술 결정에 명확한 근거가 확보되었으며, 로드맵 생성에 충분한 정보가 수집되었습니다.

---

## Key Findings

### From STACK.md

**핵심 기술 결정:**
- **diago v0.27.0**: 이미 모든 미디어 API 내장 (PlaybackCreate, AudioStereoRecordingCreate, DTMF Reader/Writer). 추가 SIP 라이브러리 불필요.
- **pion/rtp v1.8.18**: 이미 go.mod에 포함됨 (diago 내부 의존성). 명시적 사용 불필요.
- **go-audio/wav v1.1.0+**: WAV 인코딩/디코딩용 battle-tested 라이브러리 (1200+ 의존자).
- **zaf/g711 v1.4.0**: G.711 (PCMU/PCMA) 코덱 변환 필수 (WAV ↔ RTP).
- **Opus 제외**: CGO 의존성으로 v1.1에서 제외 권장. v1.2+로 연기하여 크로스 컴파일 복잡도 회피.

**버전 요구사항:**
- go-audio/wav: v1.1.0 이상
- go-audio/audio: v1.0.0 이상 (wav의 의존성)
- zaf/g711: v1.4.0 (2024-01-09 릴리스)
- diago: v0.27.0 (2026-02-08 릴리스, 기존 사용 중)

**설치 명령어:**
```bash
go get github.com/go-audio/wav@latest
go get github.com/go-audio/audio@latest
go get github.com/zaf/g711@v1.4.0
```

**통합 포인트:**
- `internal/engine/executor.go`: diago DialogMedia API 사용 (`dialog.Media().PlaybackCreate()`)
- `internal/binding/app.go`: Wails 파일 다이얼로그 추가 (SelectAudioFile, SelectRecordingPath)
- 새 패키지 `internal/media/`: player.go, recorder.go, dtmf.go, codec.go (G.711 변환 유틸)

**근거:** diago 공식 예제 (playback, wav_record, dtmf)와 소스 코드로 검증됨.

---

### From FEATURES.md

**필수 기능 (Table Stakes):**
1. **WAV 파일 재생** (중간 복잡도) — IVR 프롬프트 시뮬레이션의 기본. 통화 중 PCMA/PCMU 인코딩된 WAV를 RTP로 스트리밍.
2. **통화 녹음** (중간 복잡도) — QA/디버깅용. RTP → WAV 저장. Stereo (좌/우 채널로 Local/Remote 분리) 지원.
3. **DTMF 송신** (낮은 복잡도) — RFC 2833 RTP telephone-event로 IVR 메뉴 자동 탐색.
4. **DTMF 수신** (낮은 복잡도) — 기존 DTMFReceived Event 강화 (digit 값 캡처, expectedDigit 속성, timeout).
5. **코덱 선택** (낮은 복잡도) — SDP m= 라인에 선호 코덱 명시 (PCMA=8, PCMU=0).

**차별화 기능 (Differentiators):**
- **시각적 미디어 플로우**: 기존 XYFlow 노드에 PlayAudio → DTMFReceived 플로우를 시각적으로 배치. SIPp(XML)보다 이해 쉬움.
- **부분 녹음 제어**: StartRecording/StopRecording 쌍으로 민감 정보 구간만 녹음 제외.
- **DTMF 패턴 검증**: expectedDigit 속성으로 IVR 입력 자동 검증.

**명시적 제외 (Anti-Features):**
- **실시간 마이크 입력**: 자동화 불가, 크로스 플랫폼 복잡도 높음. WAV 파일로 대체.
- **TTS**: 외부 의존성, 비용 발생. 사전 녹음 파일 사용.
- **In-band DTMF**: 압축 코덱에서 신뢰성 낮음. RFC 2833만 지원.
- **Video**: SIP 오디오 테스트 중심. 비디오는 범위 밖.
- **FAX (T.38)**: 니치 기능, MVP 이후 고려.

**노드 통합:**
- 새 Command 노드: PlayAudio, SendDTMF, StartRecording, StopRecording
- 강화할 Event 노드: DTMFReceived (digit, expectedDigit, timeout 속성)
- SIP Instance 확장: codecs (우선순위 목록), enableDTMF

**MVP 권장:**
- Phase 1: PlayAudio, SendDTMF, DTMFReceived (PCMA/PCMU만)
- Phase 2: StartRecording/StopRecording (stereo WAV)
- 연기: Opus 코덱, DTMF 패턴 정규식, MP3 재생

---

### From ARCHITECTURE.md

**주요 컴포넌트와 책임:**

**Backend 확장 (Go):**
1. **executor.go**: 새 command handler 추가
   - `executePlayMedia()`: WAV 파일 열기 → `dialog.Media().PlaybackCreate()` → 완료 대기
   - `executeRecord()` / `executeStopRecord()`: `AudioStereoRecordingCreate()` → SessionStore에 RecordingSession 저장
   - `executeSendDTMF()`: `AudioWriterDTMF().WriteDTMF(digit)`
   - `executeDTMFReceived()`: `AudioReaderDTMF().DTMF()` 채널 대기

2. **graph.go**: GraphNode 확장
   - 새 필드: `MediaPath`, `RecordPath`, `DTMFDigits`, `DTMFDigit`, `CodecPrefs`

3. **instance_manager.go**: Codec 설정
   - `SipInstanceConfig`에 `Codecs []string` 추가
   - `diago.WithMediaConfig(mediaConfig)` 적용

4. **session_store.go**: 녹음 세션 관리
   - `recordings map[string]*RecordingSession` 추가
   - `StartRecording()` / `StopRecording()` 메서드

5. **internal/media/ (신규 패키지)**:
   - `asset_manager.go`: WAV 파일 검증, 경로 해석, 녹음 파일명 생성
   - `player.go`, `recorder.go`, `dtmf.go`, `codec.go`: 미디어 로직 분리 (테스트 용이성)

**Frontend 확장 (React + TypeScript):**
1. **types/scenario.ts**: CommandNode/EventNode/SipInstanceNode 타입 확장
   - Command에 `mediaPath`, `recordPath`, `dtmfDigits` 추가
   - Event에 `dtmfDigit` 추가
   - SipInstance에 `codecs` 추가

2. **components/nodes/**: Command/Event 노드 아이콘과 상세 정보 추가
   - 아이콘: PlayMedia (Play), SendDTMF (Hash), Record (Mic)

3. **MediaConfigPanel.tsx (신규)**: WAV 파일 선택, DTMF digits 입력, 녹음 경로 설정

4. **execution-store.ts**: 미디어 진행 상태 추가 (`mediaProgress` 맵)

**핵심 패턴:**
- **Command/Event 확장**: 기존 아키텍처를 그대로 유지하며 새 노드 타입만 추가.
- **diago DialogMedia 활용**: `dialog.Media()`로 RTP 세션 접근 → 재생/녹음/DTMF API 사용.
- **Asset Manager 패턴**: 파일 경로 해석과 검증을 별도 컴포넌트로 분리.
- **Cleanup 순서**: Hangup → Close dialogs → Close recording files (defer 활용).

**데이터 흐름 (예: PlayMedia):**
```
Frontend: PlayMedia 노드 추가 + WAV 파일 선택
    ↓
Backend: ParseScenario() → GraphNode with MediaPath
    ↓
Executor.executePlayMedia():
    1. SessionStore에서 dialog 획득
    2. dialog.Media() → DialogMedia
    3. os.Open(MediaPath) → WAV 파일
    4. PlaybackCreate(file) → Playback 객체
    5. <-playback.Done() 대기
    6. 500ms마다 진행 상태 이벤트 emit
    ↓
Frontend: media-progress 이벤트 수신 → 프로그레스 바 업데이트
```

**빌드 순서 권장:**
1. Codec Configuration (기반)
2. Asset Management (인프라)
3. PlayMedia (핵심 기능)
4. DTMF Sending (빠른 성과)
5. DTMF Receiving (이벤트 확장)
6. Recording (복잡한 기능)
7. Polish & Documentation

---

### From PITFALLS.md

**치명적 함정 Top 3:**

1. **함정 1: diago DialogMedia 초기화 순서 오류** (치명적)
   - **문제**: SDP 협상 완료 전에 `dialog.Media()` 호출 시 nil RTP 세션 오류.
   - **원인**: `Invite()` 또는 `Answer()` 호출이 200 OK + ACK 완료까지 대기해야만 RTP 세션 초기화됨.
   - **예방**: `Invite()`/`Answer()` 완료 후에만 `Media()` 호출. IncomingCall 시나리오에서 race condition 주의.
   - **탐지**: "nil pointer dereference", "early media detected but RTP session not initialized" 로그.

2. **함정 2: WAV 파일 포맷 불일치** (치명적)
   - **문제**: 44.1kHz stereo WAV를 8kHz mono RTP로 재생 시 속도 왜곡 (chipmunk voice).
   - **원인**: SIP/RTP는 표준적으로 8kHz mono G.711 사용. 샘플레이트 불일치 시 재생 길이 2배 차이.
   - **예방**: WAV 검증 로직 (8kHz, mono, PCM μ-law 체크). ffmpeg로 사전 변환.
   - **탐지**: 재생 속도가 기대와 다름, RTP timestamp 증가량 이상.

3. **함정 3: 코덱 불일치로 미디어 실패 (488)** (치명적)
   - **문제**: 양쪽 인스턴스가 공통 코덱 없으면 SDP 협상 실패 → 488 Not Acceptable.
   - **원인**: diago Bridge는 transcoding 미지원. 동일 코덱 협상 필수.
   - **예방**: PCMU를 기본 fallback으로 항상 포함. 코덱 교집합 사전 검증.
   - **탐지**: 488 응답, "no matching codec found in SDP answer" 로그.

**중간 함정:**
- **함정 4: 녹음 파일 동시 쓰기 Race Condition** → 인스턴스별 고유 파일명 강제 (`recording_{{instanceID}}_{{timestamp}}.wav`).
- **함정 5: RTP Timestamp 동기화 실패** → diago의 자동 timestamp 관리 활용, 수동 전송 시 160 샘플 단위 증가.
- **함정 6: DTMF In-Band vs RFC 2833** → RFC 2833을 기본값으로, G.729 등 압축 코덱에서 in-band 신뢰성 낮음.
- **함정 7: Early Media (183) 처리 누락** → v1.1에서는 연기, v1.2에서 Early Media Event 노드 추가 고려.
- **함정 8: 파일 핸들 누수** → defer 패턴으로 녹음 파일 Close 보장, SessionStore.CloseAll()에 파일 정리 단계 추가.
- **함정 9: 시뮬레이션 vs 실제 모드 차이** → RTP 포트 범위 분리 (시뮬레이션: 5060~5080, 실제: 10000~20000).
- **함정 10: 포트 순차 할당 충돌** → SIP와 RTP 포트 범위 분리, RTP는 짝수/홀수 쌍으로 할당.

**사소한 함정:**
- WAV 헤더 쓰기 타이밍 (diago API 사용 시 자동 처리됨)
- DTMF 타임아웃 너무 짧음 (최소 500ms 권장)
- 코덱 이름 대소문자 불일치 (항상 대문자로 정규화)

**페이즈별 경고:**
- Phase 1 (미디어 재생): 함정 1, 2, 5 주의 → WAV 검증 우선 구현
- Phase 2 (녹음): 함정 4, 8 주의 → 인스턴스별 파일명, defer 패턴
- Phase 3 (DTMF): 함정 6 주의 → RFC 2833 기본값
- Phase 4 (코덱 선택): 함정 3 주의 → 협상 전 검증
- Phase 5 (통합 테스트): 함정 9 주의 → 실제 SIP 서버 테스트

---

## Roadmap Implications

통합 리서치에 기반하여 다음 페이즈 구조를 제안합니다.

### Phase 1: Codec Configuration + Asset Management (기반)

**근거:** 모든 미디어 기능이 코덱 설정과 파일 관리에 의존하므로 가장 먼저 구축해야 합니다.

**전달하는 것:**
- SIP Instance 노드에 코덱 선택 UI (드래그로 우선순위 변경)
- `InstanceManager.CreateInstances()`에서 `diago.WithMediaConfig()` 적용
- `internal/media/asset_manager.go` 구현 (WAV 검증, 파일 목록, 경로 해석)
- Wails 파일 다이얼로그 바인딩 (`SelectAudioFile`, `SelectRecordingPath`)

**포함하는 기능 (FEATURES.md):**
- 코덱 선택 (PCMU, PCMA) — Opus는 제외
- WAV 파일 검증 (8kHz, mono, PCM)

**피해야 할 함정:**
- 함정 3 (코덱 불일치) → PCMU를 기본값으로 항상 포함
- 함정 2 (WAV 포맷 불일치) → 파일 업로드 시 자동 검증

**리서치 플래그:** 리서치 충분. 표준 패턴 (Wails 다이얼로그, diago MediaConfig).

---

### Phase 2: PlayAudio Command (핵심 기능)

**근거:** 가장 사용자에게 가시적인 기능이며, 미디어 통합을 실증합니다.

**전달하는 것:**
- `executePlayMedia()` 구현 (diago PlaybackCreate API)
- GraphNode에 `MediaPath` 필드 추가
- Frontend: PlayAudio Command 노드 + MediaConfigPanel (파일 선택)
- 미디어 진행 상태 이벤트 (500ms 간격)
- 프로그레스 바 UI

**포함하는 기능 (FEATURES.md):**
- WAV 파일 재생 (필수)
- 재생 완료 후 다음 노드 진행

**피해야 할 함정:**
- 함정 1 (초기화 순서) → `Invite()` 완료 후에만 `Media()` 호출
- 함정 2 (WAV 포맷) → 8kHz mono 검증 로직 적용
- 함정 5 (RTP 타이밍) → diago의 자동 timestamp 관리 활용

**리서치 플래그:** 리서치 충분. diago 예제 (playback) 참고.

---

### Phase 3: DTMF Sending & Receiving (빠른 성과)

**근거:** 복잡도 낮고, 파일 I/O 없으며, IVR 시뮬레이션의 핵심 기능입니다.

**전달하는 것:**
- `executeSendDTMF()` 구현 (AudioWriterDTMF)
- `executeDTMFReceived()` 구현 (AudioReaderDTMF)
- GraphNode에 `DTMFDigits`, `DTMFDigit` 필드 추가
- Frontend: SendDTMF Command + DTMFReceived Event 강화 (expectedDigit, timeout)

**포함하는 기능 (FEATURES.md):**
- DTMF 송신 (RFC 2833)
- DTMF 수신 이벤트 (digit 값 캡처, timeout)

**피해야 할 함정:**
- 함정 6 (In-band vs RFC 2833) → RFC 2833 기본값
- 함정 12 (타임아웃 너무 짧음) → 최소 500ms

**리서치 플래그:** 리서치 충분. 표준 패턴 (RFC 2833, diago DTMF API).

---

### Phase 4: Recording (복잡한 기능)

**근거:** 세션 라이프사이클 관리가 필요하므로 가장 복잡합니다. 앞선 페이즈의 안정화 후 진행.

**전달하는 것:**
- `executeRecord()` / `executeStopRecord()` 구현
- SessionStore에 `RecordingSession` 관리 추가
- GraphNode에 `RecordPath` 필드 추가
- Frontend: StartRecording/StopRecording Command 노드
- 녹음 파일명 자동 생성 (`{{instanceID}}_{{timestamp}}.wav`)

**포함하는 기능 (FEATURES.md):**
- 통화 녹음 (stereo WAV)
- 부분 녹음 제어 (StartRecording/StopRecording 쌍)

**피해야 할 함정:**
- 함정 4 (동시 쓰기) → 인스턴스별 고유 파일명 강제
- 함정 8 (파일 핸들 누수) → defer 패턴, SessionStore.CloseAll()에 정리 로직

**리서치 플래그:** 리서치 충분. diago 예제 (wav_record) 참고. 동시성 테스트 강화 필요.

---

### Phase 5: Integration Testing & Polish (검증)

**근거:** 실제 SIP 서버 연동 테스트와 프로덕션 준비.

**전달하는 것:**
- 실제 SIP 서버 (Asterisk/FreeSWITCH) E2E 테스트
- 시나리오 검증 (누락 파일, 잘못된 포맷 체크)
- 에러 핸들링 강화
- 사용자 문서 (WAV 요구사항, 코덱 선택 가이드)
- 툴팁 및 도움말 텍스트

**포함하는 기능 (FEATURES.md):**
- 모든 기능의 통합 검증

**피해야 할 함정:**
- 함정 9 (시뮬레이션 vs 실제) → RTP 포트 범위 분리, NAT 대응
- 함정 10 (포트 충돌) → 포트 할당 로직 검증

**리서치 플래그:** **추가 리서치 필요** — 실제 SIP 서버 연동 시나리오, NAT/방화벽 대응, 성능 테스트 (최대 동시 녹음 수).

---

## Research Flags

**어떤 페이즈가 `/prp:research-phase` 필요한가?**

- **Phase 1-4**: 리서치 충분. diago 공식 문서와 예제 기반으로 구현 가능.
- **Phase 5 (Integration Testing)**: **추가 리서치 필요**
  - 실제 SIP 서버 (Asterisk/FreeSWITCH) 연동 테스트 시나리오
  - NAT/방화벽 traversal (STUN/TURN 필요 여부)
  - 성능 테스트 (멀티 인스턴스 병렬 녹음 시 최대 동시 파일 수)
  - 대규모 WAV 파일 재생 시 메모리 사용량

**어떤 페이즈가 표준 패턴 있는가 (리서치 건너뛰기)?**

- **Phase 1 (Codec Configuration)**: Wails 다이얼로그, diago MediaConfig — 표준 패턴.
- **Phase 3 (DTMF)**: RFC 2833은 업계 표준, diago DTMF API 명확함 — 표준 패턴.

---

## Confidence Assessment

| 영역 | 신뢰도 | 참고 |
|------|--------|------|
| **Stack** | **HIGH** | diago v0.27.0 소스 코드 확인, 공식 예제 존재, WAV/G.711 라이브러리 battle-tested |
| **Features** | **HIGH** | SIP 미디어 기능은 업계 표준 (RFC 2833, G.711), 여러 SIP 테스팅 툴과 패턴 일치 |
| **Architecture** | **HIGH** | 기존 Command/Event 패턴 확장만, diago DialogMedia API 명확, Wails 통합 검증됨 |
| **Pitfalls** | **HIGH** | diago 소스 분석, SIP/RTP 프로토콜 표준, Go 동시성 best practice 기반 |

**해결 안 된 갭 (계획 중 주의 필요):**

1. **diago v0.27.0의 정확한 API 변경사항** (MEDIUM 신뢰도)
   - 리서치는 GitHub 소스와 문서 기반이지만, 실제 빌드 전까지 breaking change 미확인
   - 완화: Phase 2에서 조기 통합 테스트

2. **Early Media (183 Session Progress) 처리** (LOW 신뢰도)
   - v1.1에서 제외했지만 사용자 요구 발생 가능
   - 완화: 명시적으로 v1.2 로드맵에 포함

3. **실제 SIP 서버 연동 시 NAT/방화벽 이슈** (MEDIUM 신뢰도)
   - 시뮬레이션 모드 중심 리서치, 실제 환경 변수 미검증
   - 완화: Phase 5에서 추가 리서치 (`/prp:research-phase`)

4. **최대 동시 녹음 파일 수** (LOW 신뢰도)
   - 성능 테스트 미실시
   - 완화: Phase 5에서 부하 테스트

---

## Sources

### High Confidence (공식 문서, 검증된 소스)

**diago 라이브러리:**
- [Diago GitHub](https://github.com/emiago/diago) — v0.27.0 릴리스 확인
- [Diago DialogMedia API](https://github.com/emiago/diago/blob/main/dialog_media.go) — PlaybackCreate, Record, DTMF 메서드
- [Diago Media Codecs](https://emiago.github.io/diago/docs/media_codecs/) — PCMU, PCMA, Opus 지원
- [Diago Examples](https://github.com/emiago/diago/tree/main/examples) — playback, wav_record, dtmf

**Go 라이브러리:**
- [go-audio/wav pkg.go.dev](https://pkg.go.dev/github.com/go-audio/wav) — v1.1.0, Encoder/Decoder API
- [go-audio/wav GitHub](https://github.com/go-audio/wav) — 383 stars, 1200+ 의존자
- [zaf/g711 pkg.go.dev](https://pkg.go.dev/github.com/zaf/g711) — v1.4.0, Alaw/Ulaw 코덱
- [zaf/g711 GitHub](https://github.com/zaf/g711) — 109 stars, 217 의존자
- [pion/rtp pkg.go.dev](https://pkg.go.dev/github.com/pion/rtp) — v1.8.18, RTP 처리

**Wails:**
- [Wails Dialog Runtime](https://wails.io/docs/reference/runtime/dialog/) — OpenFileDialog, SaveFileDialog

**RFC 표준:**
- [RFC 2833 - RTP Payload for DTMF](https://datatracker.ietf.org/doc/html/rfc2833)
- [RFC 4733](https://datatracker.ietf.org/doc/html/rfc4733) — RTP DTMF 표준 (RFC 2833 대체)
- [G.711 Wikipedia](https://en.wikipedia.org/wiki/G.711) — PCMU/PCMA 코덱

### Medium Confidence (커뮤니티, 참고 패턴)

**SIP 미디어 재생:**
- [VoIP Media Session - sipsorcery](https://sipsorcery-org.github.io/sipsorcery/articles/voipmediasession.html)
- [How to play mp3 into voice call](https://voip-sip-sdk.com/p_7345-how-to-play-an-mp3-file-into-a-voice-call-using-csharp.html)
- [SIP IVR - Sonetel](https://sonetel.com/en/sip-trunking/help/sip-ivr/)

**통화 녹음:**
- [How to record SIP voice call](https://voip-sip-sdk.com/p_7362-how-to-record-voip-sip-voice-call.html)
- [VoIPmonitor](https://www.voipmonitor.org/)
- [PortSIP Call Recordings](https://support.portsip.com/portsip-communications-solution/portsip-pbx-administration-guide/20-cdr-and-call-recordings/call-recordings)

**DTMF:**
- [DTMF over IP (Nick vs Networking)](https://nickvsnetworking.com/dtmf-over-ip-sip-info-inband-rtp-events/)
- [DTMF in SIP Call - Yeastar](https://support.yeastar.com/hc/en-us/articles/360038941513-Understand-the-DTMF-in-SIP-Call)
- [DTMF RFC 2833 Reliability](https://voipnuggets.com/2023/06/12/different-types-of-dtmf-in-sip-and-why-dtmf-via-rfc2833-is-more-reliable/)

**코덱 협상:**
- [SDP Offer/Answer Model](https://www.tutorialspoint.com/session_initiation_protocol/session_initiation_protocol_the_offer_answer_model.htm)
- [Understanding codec negotiation](https://wiki.4psa.com/display/KB/Understanding+codec+negotiation)
- [Asterisk Codec Mismatch](https://kingasterisk.com/codec-mismatch-problems-in-asterisk/)
- [FreeSWITCH Codec Negotiation](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Codecs-and-Media/Codec-Negotiation_2883752/)

**함정 케이스:**
- [Troubleshooting One-Way Audio](https://blog.opensips.org/2023/07/06/troubleshooting-one-way-audio-calls/)
- [VoIP Problems 2026](https://telxi.com/blog/voip-problems/)
- [Go Data Race Detector](https://go.dev/doc/articles/race_detector)
- [Concurrency Safe File Access](https://echorand.me/posts/go-file-mutex/)

**SIP 테스팅 툴:**
- [MAPS SIP Emulator](https://www.gl.com/sip-rtp-protocol-simulator-maps.html)
- [StarTrinity SIP Tester](http://startrinity.com/VoIP/SipTester/SipTester.aspx)
- [Handling media with SIPp](https://sipp.readthedocs.io/en/latest/media.html)

---

## Requirements Definition Readiness

**SUMMARY.md 완성 상태:**
- ✅ 4개 리서치 파일 모두 종합됨
- ✅ 요약이 핵심 결론 포착 (기존 스택 재사용, 3개 라이브러리만 추가, CGO 회피)
- ✅ 각 파일에서 핵심 발견 추출됨
- ✅ 로드맵 함의에 5개 페이즈 제안 포함 (근거 명확)
- ✅ 리서치 플래그: Phase 5만 추가 리서치 필요, 나머지는 표준 패턴
- ✅ 신뢰도 정직하게 평가 (전체 HIGH, 일부 갭 식별)
- ✅ 해결할 갭 목록화 (diago API 변경, Early Media, NAT/방화벽, 성능 테스트)

**오케스트레이터 진행 가능:** SUMMARY.md가 로드맵 생성에 필요한 모든 정보 제공. 요구사항 정의 및 페이즈별 PLAN 생성 준비 완료.

**다음 단계:** `/prp:generate-roadmap` — 5개 페이즈 구조로 로드맵 생성, Phase 5에서만 `/prp:research-phase` 필요.
