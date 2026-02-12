---
phase: 07-media-playback
plan: 01
type: execute
subsystem: backend-media-engine
tags: [wav-validation, file-dialog, diago-playback, media-binding]
completed: 2026-02-12
duration: 113s

dependencies:
  requires:
    - 06-01 (코덱 설정 엔진 통합)
    - 03-03 (SessionStore dialog 관리)
  provides:
    - WAV 파일 검증 바인딩 (8kHz mono PCM)
    - 파일 선택 다이얼로그 바인딩
    - executePlayAudio 실행 파이프라인
    - GraphNode.FilePath 파싱
  affects:
    - 07-02 (프론트엔드 PlayAudio 노드 UI)
    - 08-01 (DTMF Send — 유사한 command 노드 패턴)

tech-stack:
  added:
    - go-audio/wav v1.1.0 (WAV decoder)
  patterns:
    - WAV 포맷 검증 파이프라인 (NewDecoder → IsValidFile → ReadInfo)
    - 파일 다이얼로그 + 즉시 검증 패턴
    - diago PlaybackCreate/Play blocking 호출

key-files:
  created:
    - internal/binding/media_binding.go
  modified:
    - internal/engine/graph.go
    - internal/engine/executor.go
    - app.go
    - main.go
    - go.mod
    - go.sum

decisions:
  - title: "go-audio/wav 라이브러리 채택"
    rationale: "순수 Go 구현, CGO 불필요, SampleRate/NumChans/AudioFormat 필드 제공"
    impact: "8kHz mono PCM 검증 가능, 크로스 컴파일 용이"
  - title: "SelectWAVFile에서 즉시 검증"
    rationale: "사용자가 잘못된 파일을 선택 시 즉시 피드백 제공"
    impact: "UX 향상, 실행 시점 에러 방지"
  - title: "pb.Play() bytesPlayed 로깅"
    rationale: "재생 바이트 수를 로그에 기록하여 디버깅 가능"
    impact: "실행 로그에서 파일 크기 확인 가능"
---

# Phase 07 Plan 01: PlayAudio Backend 구현 Summary

**One-line summary:** Go 백엔드가 WAV 파일 검증(8kHz mono PCM), 파일 선택 다이얼로그, diago PlaybackCreate/Play를 통한 RTP 재생 파이프라인을 제공

## What Was Built

### Task 1: MediaBinding + WAV 검증 + 파일 다이얼로그
- **internal/binding/media_binding.go 생성** (126 lines)
  - `MediaBinding` 구조체: ctx context.Context 필드
  - `WAVValidationResult` 타입: Valid, Error, Details 필드
  - `ValidateWAVFile(filePath string)` 메서드:
    - os.Open → wav.NewDecoder → IsValidFile → ReadInfo
    - SampleRate != 8000 → 에러: "Sample rate must be 8kHz (file is X Hz)"
    - NumChans != 1 → 에러: "Must be mono (file has X channels)"
    - WavAudioFormat != 1 → 에러: "Audio format must be PCM"
    - 통과 시: `{Valid: true, Details: "8kHz mono PCM, X-bit"}`
  - `SelectWAVFile()` 메서드:
    - runtime.OpenFileDialog (FileFilter: "*.wav")
    - 선택 후 즉시 ValidateWAVFile 호출
    - 검증 실패 시 fmt.Errorf(result.Error) 반환
- **go-audio/wav@v1.1.0 의존성 추가**
- **Wails 로깅 통합**: runtime.LogInfo/LogWarning/LogError

### Task 2: GraphNode FilePath + executePlayAudio + App 통합
- **graph.go: GraphNode.FilePath 필드 추가**
  - `FilePath string` 필드 (line 38)
  - ParseScenario에서 `getStringField(node.Data, "filePath", "")` 파싱 (line 124)
- **executor.go: executePlayAudio 구현** (lines 390-456)
  - 파이프라인:
    1. node.FilePath 검증 (빈 문자열 체크)
    2. os.Stat으로 파일 존재 확인
    3. ex.sessions.GetDialog(instanceID) — dialog 없으면 에러
    4. os.Open(filePath) + defer file.Close()
    5. dialog.Media().PlaybackCreate() — Playback 인스턴스 생성
    6. filepath.Base(filePath) → emitActionLog "Playing audio file: {filename}"
    7. context 취소 체크 (select/default)
    8. pb.Play(file, "audio/wav") — blocking 호출, bytesPlayed 반환
    9. emitActionLog "Playback completed (X bytes)"
- **executor.go: executeCommand에 "PlayAudio" case 추가** (lines 167-168)
- **app.go: mediaBinding 통합**
  - mediaBinding *binding.MediaBinding 필드 (line 20)
  - NewApp()에서 binding.NewMediaBinding() 생성 (line 52)
  - startup()에서 a.mediaBinding.SetContext(ctx) (line 64)
- **main.go: Wails Bind 배열에 등록** (line 33)

## Task Results

| Task | Name | Status | Commit | Files | Note |
| ---- | ---- | ------ | ------ | ----- | ---- |
| 1 | MediaBinding + WAV 검증 + 파일 다이얼로그 | completed | b05b9f3 | media_binding.go, go.mod, go.sum | 126 lines, 8kHz mono PCM 검증 |
| 2 | GraphNode FilePath + executePlayAudio + App 통합 | completed | b05b9f3 | graph.go, executor.go, app.go, main.go | FilePath 파싱 + PlaybackCreate/Play 파이프라인 |

## Verification Results

✅ Go build: `go build ./...` successful
✅ Go tests: `go test ./internal/engine/...` pass (24.630s)
✅ Go vet: `go vet ./...` no warnings
✅ executePlayAudio exists in executor.go (lines 390-456)
✅ SelectWAVFile and ValidateWAVFile methods exist in media_binding.go
✅ mediaBinding registered in main.go Bind array (line 33)
✅ GraphNode.FilePath parsed in ParseScenario (line 124)
✅ "PlayAudio" case added to executeCommand (lines 167-168)

## Deviations from Plan

### Auto-fixed Issues

**1. [규칙 1 - 버그] pb.Play() 반환값 처리**
- **발견 시점:** Task 2 빌드 검증
- **이슈:** `pb.Play(file, "audio/wav")`가 `(int64, error)`를 반환하는데 에러만 받음
- **수정:** `bytesPlayed, err := pb.Play(...)` + 로그에 바이트 수 포함
- **수정된 파일:** internal/engine/executor.go (line 445)
- **커밋:** b05b9f3 (버그 수정 포함)

## Decisions Made

1. **go-audio/wav 라이브러리 채택**
   - Context: WAV 파일 포맷 검증 필요 (8kHz mono PCM)
   - Decision: go-audio/wav v1.1.0 사용
   - Rationale: 순수 Go 구현 (CGO 불필요), SampleRate/NumChans/WavAudioFormat 필드 제공, riff 파싱 내장
   - Impact: 크로스 컴파일 용이, 8kHz mono PCM 검증 정확, 기존 프로젝트 정책 (CGO 회피) 준수

2. **SelectWAVFile에서 즉시 검증**
   - Context: 사용자가 파일을 선택한 후 언제 검증할지
   - Decision: 파일 선택 직후 SelectWAVFile 내에서 ValidateWAVFile 호출, 검증 실패 시 에러 반환
   - Rationale: 사용자에게 즉시 피드백 제공, 실행 시점까지 기다리지 않음
   - Impact: UX 향상 (선택 직후 toast 알림), 실행 시점 에러 방지, 프론트엔드 코드 간소화

3. **pb.Play() bytesPlayed 로깅**
   - Context: Play() 반환값 (int64, error)에서 bytesPlayed 활용 방법
   - Decision: 재생 완료 로그에 "Playback completed (X bytes)" 포함
   - Rationale: 디버깅 시 파일 크기 확인 가능, 재생 진행 상황 추적
   - Impact: 실행 로그에서 파일 처리량 확인 가능, 향후 진행률 표시 기반 마련

4. **executePlayAudio context 취소 체크 위치**
   - Context: Play()는 blocking이므로 StopScenario 호출 시 취소 필요
   - Decision: Play() 호출 전 `select { case <-ctx.Done(): return ctx.Err() default: }` 체크
   - Rationale: Play() 자체는 blocking이므로 호출 전 취소 확인 필요
   - Impact: 사용자가 StopScenario 호출 시 재생 시작 전 즉시 종료, 불필요한 재생 방지

## Next Phase Readiness

### Blockers
None

### Concerns
- **PlayAudio 노드 프론트엔드 미구현**: 백엔드만 완료, 프론트엔드 UI (07-02) 필요
- **WAV 파일 경로 저장 방식**: flow_data의 filePath는 절대 경로 — 시나리오 공유 시 문제 가능성 (향후 고려)

### Prerequisites for Next Plans
- ✅ 07-02 (프론트엔드 PlayAudio 노드): MediaBinding.SelectWAVFile/ValidateWAVFile 바인딩 사용 가능
- ✅ 07-03 (통합 테스트): executePlayAudio 파이프라인 테스트 가능
- ✅ 08-01 (DTMF Send): 유사한 command 노드 패턴 재사용 가능

## Lessons Learned

1. **WAV Decoder 순서 중요**: go-audio/wav는 NewDecoder → IsValidFile → ReadInfo 순서를 반드시 지켜야 SampleRate 등 필드가 채워짐
2. **Wails OpenFileDialog 사용자 취소**: 사용자가 취소하면 빈 문자열 반환 (에러 아님), 반환값 검증 필요
3. **diago PlaybackCreate는 SDP 협상 후**: dialog.Media().PlaybackCreate()는 Answer 후에만 호출 가능 (RTP 세션 초기화 순서)
4. **pb.Play는 Blocking**: Play()는 재생 완료까지 블로킹하므로 goroutine이나 context 취소 고려 필요

## Testing Notes

- 기존 Go 테스트 통과 (24.630s)
- go vet 경고 없음
- 수동 검증 필요: Wails 앱 실행 → MediaBinding.SelectWAVFile 호출 → 파일 다이얼로그 표시 확인
- 통합 테스트 필요: PlayAudio 노드 실행 → diago PlaybackCreate/Play 호출 → RTP 재생 확인 (07-03에서 수행)

## Memory-Influenced Decisions

- **Domain Knowledge:** "diago DialogMedia API가 재생/녹음/DTMF를 모두 지원 (v0.27.0)" → dialog.Media().PlaybackCreate() 사용
- **Domain Knowledge:** "SDP 협상 완료 후에만 dialog.Media() 호출 가능" → executePlayAudio에서 dialog 세션 존재 확인 필수
- **Domain Knowledge:** "SIP/RTP는 표준적으로 8kHz mono G.711 사용" → WAV 검증 기준을 8kHz mono로 설정
- **Technical Constraint:** "WAV 파일 포맷 불일치 시 재생 속도 왜곡" → ValidateWAVFile에서 엄격한 8kHz mono PCM 검증
- **Technical Constraint:** "CGO 의존성 회피를 위해 Opus 코덱 제외" → go-audio/wav 순수 Go 라이브러리 채택

## Self-Check: PASSED

All files and commits verified:
- ✅ internal/binding/media_binding.go: 126 lines, ValidateWAVFile, SelectWAVFile
- ✅ internal/engine/graph.go: FilePath 필드 (line 38), ParseScenario 파싱 (line 124)
- ✅ internal/engine/executor.go: executePlayAudio (lines 390-456), "PlayAudio" case (lines 167-168)
- ✅ app.go: mediaBinding 필드 (line 20), NewMediaBinding (line 52), SetContext (line 64)
- ✅ main.go: Bind 배열 등록 (line 33)
- ✅ go.mod/go.sum: go-audio/wav@v1.1.0
- ✅ Commit: b05b9f3
