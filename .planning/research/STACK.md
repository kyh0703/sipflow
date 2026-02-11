# 기술 스택 — SIP 미디어 재생/녹음/DTMF/코덱

**프로젝트:** SIPFLOW v1.1
**도메인:** SIP 미디어 기능 (재생, 녹음, DTMF, 코덱 선택)
**리서치일:** 2026-02-11
**전체 신뢰도:** HIGH

## 요약

v1.1은 기존 검증된 스택(Wails v2, diago v0.27.0, Go)에 SIP 미디어 기능을 추가합니다. **diago가 이미 필수 미디어 API를 모두 제공하므로** 새로운 SIP/RTP 라이브러리 추가는 불필요합니다. WAV 파일 처리와 코덱 변환용 표준 Go 라이브러리만 추가하면 됩니다.

**핵심 발견:**
- **diago v0.27.0이 모든 미디어 API 제공** (PlaybackCreate, AudioStereoRecordingCreate, AudioReaderDTMF/WriterDTMF)
- **pion/rtp 이미 의존성에 포함** (diago가 내부적으로 사용)
- **기존 스택 재사용** — 새 프레임워크 불필요
- **3개 라이브러리만 추가** — WAV (go-audio/wav), G.711 (zaf/g711), Opus (hraban/opus - 선택적)

---

## 추천 스택

### 미디어 재생/녹음 (코어)

| 기술 | 버전 | 용도 | 이유 |
|------|------|------|------|
| **github.com/emiago/diago** | v0.27.0 | SIP 미디어 API | 이미 사용 중. PlaybackCreate, Record, DTMF 기능 내장. 추가 불필요. |
| **github.com/go-audio/wav** | v1.1.0+ | WAV 인코딩/디코딩 | 표준 WAV 처리. battle-tested. Encoder/Decoder API 제공. |
| **github.com/go-audio/audio** | v1.0.0+ | PCM 버퍼 인터페이스 | go-audio/wav의 의존성. IntBuffer, Format 타입 제공. |
| **github.com/pion/rtp** | v1.8.18 | RTP 패킷 처리 | 이미 의존성에 포함 (diago 내부 사용). 명시적 사용 불필요. |

**신뢰도:** HIGH — diago v0.27.0 (2026-02-08 릴리스), 공식 문서 확인됨

### 코덱 라이브러리

| 기술 | 버전 | 용도 | 언제 사용 |
|------|------|------|-----------|
| **github.com/zaf/g711** | v1.4.0 | G.711 (PCMU/PCMA) 인코딩/디코딩 | WAV ↔ RTP 변환시 (RTP는 G.711, WAV는 LPCM). 필수. |
| **github.com/hraban/opus** | v2+ | Opus 인코딩/디코딩 | Opus 코덱 지원시만. libopus C 바인딩. CGO 필요. **선택적**. |

**신뢰도:** HIGH — zaf/g711 v1.4.0 (2024-01-09), 217 의존 프로젝트. hraban/opus는 diago 공식 권장.

### 파일 관리 (UI)

| 기술 | 버전 | 용도 | 이유 |
|------|------|------|------|
| **Wails runtime.OpenFileDialog** | v2 (현재) | WAV 파일 선택 | 이미 사용 중인 Wails v2 런타임. 크로스 플랫폼 네이티브 다이얼로그. |
| **Wails runtime.SaveFileDialog** | v2 (현재) | 녹음 저장 경로 | 파일 필터 (.wav), DefaultFilename 지원. |

**신뢰도:** HIGH — Wails v2 공식 API

---

## 고려한 대안

| 카테고리 | 추천 | 대안 | 채택 안 한 이유 |
|----------|------|------|-----------------|
| WAV 처리 | go-audio/wav | youpy/go-wav | youpy/go-wav는 유지보수 중단 (마지막 활동 2018). go-audio는 battle-tested, 1200+ 의존자. |
| Opus 코덱 | hraban/opus | pion/opus | pion/opus는 순수 Go지만 SILK만 지원 (CELT 미지원). hraban/opus는 전체 Opus 구현 + diago 공식 권장. |
| SIP 미디어 | diago (기존) | 새 라이브러리 | diago가 이미 DialogMedia API 제공. 중복 라이브러리 추가는 복잡도 증가만 유발. |
| RTP DTMF | diago DTMF API | pion/rtp 직접 사용 | diago가 AudioReaderDTMF/WriterDTMF로 RFC2833 추상화 제공. 직접 구현은 불필요한 저수준 작업. |

---

## 스택 통합 포인트

### 1. diago DialogMedia API (기존 스택과 통합)

**현재 상태:**
- `internal/engine/executor.go`에 diago 사용 중
- `DialogSession` 타입으로 세션 관리
- `Media()` 메서드로 DialogMedia 획득 가능

**추가할 통합:**
```go
// 미디어 재생
pb, err := dialog.Media().PlaybackCreate()
pb.Play(wavFilePath, "audio/wav")

// 통화 녹음
rec, err := dialog.Media().AudioStereoRecordingCreate(outputPath)
dialog.Media().Listen() // 블로킹 녹음

// DTMF 송신
dtmfWriter := dialog.Media().AudioWriterDTMF()
dtmfWriter.WriteDTMF('1', 160*time.Millisecond)

// DTMF 수신
dtmfReader := dialog.Media().AudioReaderDTMF()
dtmfReader.OnDTMF(func(digit rune) {
    // 처리
})
```

**참고:** diago 예제 확인됨 (examples/playback, examples/wav_record, examples/dtmf)

### 2. WAV ↔ RTP 코덱 변환

**필요 이유:** RTP는 G.711 (PCMU/PCMA) 사용, WAV는 LPCM 포맷

**변환 흐름:**
```
재생: WAV (LPCM) → go-audio/wav Decoder → IntBuffer → zaf/g711 Encode → RTP (G.711)
녹음: RTP (G.711) → zaf/g711 Decode → IntBuffer → go-audio/wav Encoder → WAV (LPCM)
```

**구현 예시:**
```go
// WAV 디코딩 (재생용)
f, _ := os.Open("audio.wav")
decoder := wav.NewDecoder(f)
buf, _ := decoder.FullPCMBuffer()

// G.711 인코딩 (RTP 전송용)
pcmData := buf.Data // []int → []int16 변환 필요
g711Data := make([]byte, len(pcmData))
for i, sample := range pcmData {
    g711Data[i] = g711.EncodeUlawFrame(int16(sample))
}

// G.711 디코딩 (RTP 수신 → WAV 저장)
lpcmData := make([]int16, len(g711Data))
for i, g711Sample := range g711Data {
    lpcmData[i] = g711.DecodeUlawFrame(g711Sample)
}

// WAV 인코딩 (저장)
out, _ := os.Create("recording.wav")
encoder := wav.NewEncoder(out, 8000, 16, 1, 1) // 8kHz, 16-bit, mono
encoder.Write(intBuffer)
encoder.Close()
```

### 3. Wails 파일 다이얼로그 (기존 바인딩 확장)

**현재 구조:** `internal/binding/app.go`에 Wails 메서드 바인딩

**추가할 메서드:**
```go
// internal/binding/app.go
func (a *App) SelectAudioFile(ctx context.Context) (string, error) {
    return runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
        Title: "Select WAV Audio File",
        Filters: []runtime.FileFilter{
            {DisplayName: "WAV Audio", Pattern: "*.wav"},
            {DisplayName: "All Files", Pattern: "*.*"},
        },
    })
}

func (a *App) SelectRecordingPath(ctx context.Context, defaultName string) (string, error) {
    return runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
        Title: "Save Recording As",
        DefaultFilename: defaultName,
        Filters: []runtime.FileFilter{
            {DisplayName: "WAV Audio", Pattern: "*.wav"},
        },
    })
}
```

**프론트엔드 호출:**
```typescript
// frontend/src/services/binding.ts
import { SelectAudioFile, SelectRecordingPath } from '@wailsapp/runtime';

const filePath = await SelectAudioFile();
const savePath = await SelectRecordingPath("recording.wav");
```

---

## 코덱 지원 전략

### PCMU/PCMA (G.711) — 필수

**우선순위:** HIGH
**이유:** SIP 표준 필수 코덱. 모든 SIP 기기 지원.

**구현:**
- `zaf/g711` 사용
- diago MediaConfig에서 기본 활성화됨
- 빌드 태그 불필요

### Opus — 선택적

**우선순위:** LOW (v1.2+로 연기 권장)
**이유:**
- 고품질 wideband 코덱이지만 CGO 의존성
- 크로스 컴파일 복잡도 증가 (Windows, Linux, macOS 각각 libopus 필요)
- MVP에는 G.711만으로 충분

**활성화 조건 (나중에 추가시):**
1. libopus 개발 파일 설치 필요
   ```bash
   # Ubuntu/Debian
   sudo apt-get install pkg-config libopus-dev libopusfile-dev

   # Fedora
   sudo dnf install opus-devel opusfile-devel
   ```

2. 빌드 태그로 컴파일
   ```bash
   go build -tags with_opus_c .
   ```

3. diago MediaConfig 설정
   ```go
   diago.MediaConfig{
       Codecs: []string{media.CodecAudioOpus, media.CodecAudioUlaw},
   }
   ```

**크로스 컴파일 (Opus 지원시):**
- Docker 사용 권장 (karalabe/xgo 또는 gythialy/golang-cross)
- CI/CD에서 멀티 플랫폼 빌드 필요

**v1.1 권장:** Opus 제외, PCMU/PCMA만 지원 → CGO 의존성 회피

---

## 설치 명령어

### 필수 의존성
```bash
# WAV 처리
go get github.com/go-audio/wav@latest
go get github.com/go-audio/audio@latest

# G.711 코덱
go get github.com/zaf/g711@v1.4.0

# diago, pion/rtp는 이미 go.mod에 포함됨 (추가 불필요)
```

### 선택적 (Opus 지원시만)
```bash
# 시스템 라이브러리 설치 (Ubuntu)
sudo apt-get install pkg-config libopus-dev libopusfile-dev

# Go 패키지
go get github.com/hraban/opus@latest

# 빌드
go build -tags with_opus_c .
```

---

## 명시적 제외 항목

### ❌ 추가하지 말 것

| 항목 | 이유 |
|------|------|
| **새 SIP 라이브러리** | diago가 이미 완전한 SIP+미디어 API 제공. 중복. |
| **pion/webrtc** | WebRTC 불필요. SIP만 사용. 과도한 의존성. |
| **FFmpeg/libav** | 단순 WAV 재생/녹음에 과도. go-audio/wav로 충분. |
| **PortAudio** | 실시간 오디오 I/O 불필요. RTP 스트림만 처리. |
| **faiface/beep** | 고수준 오디오 라이브러리지만 SIP 코덱 변환 미지원. |
| **GoAudio (DylanMeeus)** | 종합 오디오 라이브러리지만 과도. go-audio/wav가 더 가벼움. |

**원칙:** 기존 스택 최대 재사용. 새 기능에 정확히 필요한 라이브러리만 추가.

---

## 아키텍처 함의

### 계층 구조
```
Frontend (React + shadcn/ui)
    ↓ Wails Runtime (파일 다이얼로그)
    ↓
Wails Binding (internal/binding)
    ↓
Engine (internal/engine)
    ↓ diago DialogMedia API
    ↓
Media Layer (새로 추가)
    ├─ WAV Handler (go-audio/wav)
    ├─ Codec Converter (zaf/g711)
    └─ File Manager
    ↓
diago SIP/RTP Engine (기존)
    ↓ pion/rtp (내부 사용)
    ↓
Network (UDP)
```

### 새로운 패키지 제안
```
internal/
├─ engine/          (기존)
├─ binding/         (기존)
├─ scenario/        (기존)
└─ media/           (신규)
   ├─ player.go     (WAV 재생 → RTP)
   ├─ recorder.go   (RTP → WAV 녹음)
   ├─ dtmf.go       (DTMF 헬퍼)
   └─ codec.go      (G.711 변환 유틸)
```

**왜 분리:** 미디어 로직을 engine에서 분리 → 테스트 용이성, 재사용성

---

## 소스

### 공식 문서 (HIGH 신뢰도)
- [Diago v0.27.0 GitHub](https://github.com/emiago/diago) — 2026-02-08 릴리스 확인
- [Diago DialogMedia API](https://github.com/emiago/diago/blob/main/dialog_media.go) — PlaybackCreate, Record, DTMF 메서드 확인
- [Diago Media Codecs](https://emiago.github.io/diago/docs/media_codecs/) — PCMU, PCMA, Opus 지원 확인
- [Diago Examples](https://github.com/emiago/diago/tree/main/examples) — playback, wav_record, dtmf 예제 확인
- [go-audio/wav pkg.go.dev](https://pkg.go.dev/github.com/go-audio/wav) — v1.1.0, Encoder/Decoder API
- [go-audio/wav GitHub](https://github.com/go-audio/wav) — 383 stars, 1200+ 의존자
- [zaf/g711 pkg.go.dev](https://pkg.go.dev/github.com/zaf/g711) — v1.4.0 (2024-01-09), Alaw/Ulaw 코덱
- [zaf/g711 GitHub](https://github.com/zaf/g711) — 109 stars, 217 의존자
- [pion/rtp pkg.go.dev](https://pkg.go.dev/github.com/pion/rtp) — v1.8.18, Packetizer/Depacketizer
- [Wails Dialog Runtime](https://wails.io/docs/reference/runtime/dialog/) — OpenFileDialog, SaveFileDialog

### 커뮤니티 소스 (MEDIUM 신뢰도)
- [hraban/opus GitHub](https://github.com/hraban/opus) — Opus C 바인딩, diago 공식 권장
- [Cross-Compiling CGO Projects](https://dh1tw.de/2019/12/cross-compiling-golang-cgo-projects/) — Opus 크로스 컴파일 가이드
- [karalabe/xgo](https://github.com/karalabe/xgo) — CGO 크로스 컴파일 도구

### RFC 표준 (참고)
- [RFC 4733](https://datatracker.ietf.org/doc/html/rfc4733) — RTP DTMF 표준 (RFC 2833 대체)
- [G.711 Wikipedia](https://en.wikipedia.org/wiki/G.711) — PCMU/PCMA 코덱 설명

---

## 신뢰도 평가

| 영역 | 수준 | 이유 |
|------|------|------|
| diago 미디어 API | **HIGH** | v0.27.0 소스코드 직접 확인, 공식 예제 존재, 2026-02-08 릴리스 |
| WAV 라이브러리 | **HIGH** | go-audio/wav는 battle-tested, 1200+ 의존자, 명확한 API |
| G.711 코덱 | **HIGH** | zaf/g711 v1.4.0 공식 릴리스, 217 의존자, 단순 API |
| Opus 지원 | **MEDIUM** | diago 문서에 언급, 하지만 CGO 복잡도로 v1.1 제외 권장 |
| 파일 다이얼로그 | **HIGH** | Wails v2 공식 API, 이미 프로젝트에서 사용 중 |

---

## 다음 단계 (로드맵 생성용)

### Phase 1: 기본 미디어 재생
- go-audio/wav, zaf/g711 설치
- internal/media/player.go 구현 (WAV → G.711 → RTP)
- diago PlaybackCreate API 통합
- Wails 파일 선택 다이얼로그
- UI: 노드에 "Play Audio" 액션 추가

### Phase 2: 통화 녹음
- internal/media/recorder.go 구현 (RTP → G.711 → WAV)
- diago AudioStereoRecordingCreate 통합
- Wails 저장 다이얼로그
- UI: 녹음 시작/정지 버튼

### Phase 3: DTMF 송수신
- internal/media/dtmf.go 헬퍼
- diago AudioReaderDTMF/WriterDTMF 통합
- UI: DTMF 패드 (0-9, *, #)

### Phase 4: 코덱 선택 UI
- 시나리오 모델에 codec 필드 추가 (PCMU/PCMA)
- UI: 드롭다운 선택
- diago MediaConfig 동적 설정

### (선택적) Phase 5: Opus 지원
- CGO 빌드 환경 구성
- hraban/opus 통합
- Docker 크로스 컴파일 설정
- CI/CD 멀티 플랫폼 빌드

---

## 위험 요소

| 위험 | 영향 | 완화 |
|------|------|------|
| **diago MediaConfig 복잡도** | 중간 | 예제 코드 존재 (examples/playback). 문서화됨. |
| **WAV ↔ G.711 변환 성능** | 낮음 | 8kHz 샘플레이트로 충분히 가벼움. 프로파일링 후 최적화. |
| **Opus CGO 의존성** | 높음 | **v1.1에서 제외**로 회피. v1.2+로 연기. |
| **크로스 플랫폼 오디오 경로** | 낮음 | Wails 파일 다이얼로그가 네이티브 경로 반환. OS 무관. |

---

## 결론

**v1.1 스택은 간단합니다:**
1. **기존 스택 재사용** — diago, Wails, pion/rtp 모두 현재 사용 중
2. **3개 라이브러리만 추가** — go-audio/wav, go-audio/audio, zaf/g711
3. **CGO 회피** — Opus 제외로 크로스 컴파일 단순화
4. **검증된 라이브러리** — battle-tested, 높은 의존자 수, 명확한 API

**로드맵 생성 준비 완료.** 모든 기술 의사결정에 근거가 명확하며, 기존 스택과의 통합 포인트가 식별되었습니다.
