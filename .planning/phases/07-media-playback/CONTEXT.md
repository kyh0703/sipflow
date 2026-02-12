# Phase 07 Context: Media Playback

> 사용자가 통화 중 WAV 오디오 파일을 RTP로 재생하여 IVR 프롬프트 시뮬레이션을 수행할 수 있다

## 논의된 영역

1. [WAV 파일 경로 전략](#1-wav-파일-경로-전략)

---

## 1. WAV 파일 경로 전략

### 결정사항

**파일 저장 방식:** 원본 절대 경로 참조
- Wails 파일 다이얼로그에서 선택한 WAV 파일의 절대 경로를 시나리오 flow_data에 저장
- 프로젝트 디렉토리로 파일 복사하지 않음 (가볍고 단순)
- flow_data JSON의 `node.data.filePath`에 문자열로 저장
- 기존 `getStringField` 패턴으로 Go 백엔드에서 파싱

**파일 부재 시 처리:** 실행 시 오류 + 시나리오 중단
- PlayAudio 노드 실행 시점에 파일 존재 여부 확인
- 파일이 없으면 해당 노드에서 error 상태 발생
- failure 브랜치가 있으면 failure로 진행, 없으면 시나리오 중단
- 기존 executeCommand 에러 파이프라인 활용 (emitNodeState → NodeStateFailed)

**WAV 포맷 검증:** 파일 선택 즉시
- Wails 파일 다이얼로그에서 파일 선택 직후 백엔드에서 WAV 헤더 검증
- 8kHz mono PCM이 아니면 오류 메시지 반환, 프론트엔드에서 toast 표시
- 검증 실패 시 경로를 노드 데이터에 저장하지 않음 (잘못된 파일 차단)
- 검증 성공 시에만 filePath를 노드에 반영

**Properties 패널 경로 표시:** 파일명만 표시
- Properties 패널에 파일명만 표시 (e.g., "prompt.wav")
- 툴팁(title 속성)으로 전체 절대 경로 확인 가능
- 파일 미선택 시 "파일 선택" 버튼만 표시

### 현재 상태 (Phase 7 시작 전)

- diago `DialogMedia.PlaybackCreate()` → `AudioPlayback.PlayFile(filename)` API로 RTP 재생 지원
- flow_data는 JSON TEXT로 SQLite 저장 → DB 스키마 변경 없이 `filePath` 필드 추가 가능
- Wails `runtime.OpenFileDialog()` API로 네이티브 파일 다이얼로그 구현 가능
- Command 노드는 polymorphic 패턴 사용 (하나의 CommandNode 컴포넌트, `data.command`로 분기)
- executor의 `executeCommand` switch-case에 `"PlayAudio"` 케이스 추가 패턴

---

## 논의하지 않은 영역 (Claude 판단)

### PlayAudio 노드 UX

사용자가 이 영역을 선택하지 않았으므로, Claude가 기존 패턴 기반으로 판단합니다:

- **팔레트 등록:** `COMMAND_TYPES`에 `"PlayAudio"` 추가, node-palette에 PaletteItem 추가
- **아이콘:** Lucide `Volume2` 아이콘 사용 (미디어 재생을 직관적으로 표현)
- **색상:** 기존 Command 노드와 동일한 blue 계열 (`bg-blue-50 border-blue-400 text-blue-900`)
- **캔버스 노드 표시:** 노드 하단에 선택된 파일명을 작은 배지로 표시 (코덱 배지 패턴 활용)
- **파일 미선택 노드:** "No file selected" 배지 또는 배지 없음 — 실행 시 검증에서 처리
- **Properties 패널 구성:** "파일 선택" 버튼 + 선택된 파일명 표시 + "변경" 버튼

### 시뮬레이션 모드 동작

- **시뮬레이션 모드:** WAV 파일 헤더에서 재생 길이를 계산하여 해당 시간만큼 딜레이 후 완료
- **재생 길이 계산:** WAV 데이터 크기 / (sample_rate × channels × bytes_per_sample) = 초 단위 길이
- **딜레이 중 상태:** 노드 running 상태 유지, 프로그레스 이벤트 발행
- **실제 모드:** diago `PlayFile()` API 호출로 실제 RTP 전송
- **파일 검증:** 시뮬레이션 모드에서도 파일 선택 시 WAV 헤더 검증 동일하게 적용

### 재생 진행 피드백 UX

- **프로그레스 표시 위치:** 로그 패널의 ActionLog에 진행률 이벤트 발행
- **이벤트 형식:** `media:progress` 이벤트로 현재 재생 바이트/총 바이트 전달
- **노드 상태:** 재생 중 running 상태, 완료 시 completed 상태 (기존 패턴)
- **프로그레스 바:** 성공기준 5번 충족을 위해 로그 패널에 인라인 프로그레스 표시
- **시간 정보:** "재생 중: 3.2s / 10.0s" 형태로 로그에 표시

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| WAV 파일 프로젝트 번들링 (내보내기 시 복사) | Phase 07 논의 | v3.0 시나리오 내보내기/공유에서 고려 |
| 오디오 미리듣기 기능 | Phase 07 분석 | Properties 패널에서 WAV 재생, UX 개선이나 현재 불필요 |
| 다중 포맷 자동 변환 (44.1kHz → 8kHz) | Phase 07 분석 | ffmpeg/sox 의존성 필요, 복잡도 대비 가치 낮음 |
| 녹음 기능 (StartRecording/StopRecording) | v1.1 요구사항 정의 | v1.2로 연기 확정 |
| 재생 중단(StopPlayback) 명령 | Phase 07 분석 | 현재 PlayAudio는 완료까지 실행, 향후 필요 시 추가 |
| 재생 진행 프로그레스 바 | ROADMAP 성공기준 5번 | Phase 9 (Integration & Polish)로 연기. diago Play()가 blocking이라 정확한 진행률 추정 복잡 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 7` — Phase 7의 상세 실행 계획(PLAN.md) 생성
