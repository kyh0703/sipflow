# SIPFLOW v1.1 Requirements — 미디어 + 녹음

**마일스톤:** v1.1
**상태:** 정의 완료
**생성일:** 2026-02-11

---

## v1.1 요구사항

### 미디어 재생

- [ ] **MEDIA-01**: 사용자가 PlayAudio Command 노드를 캔버스에 배치하여 통화 중 WAV 파일을 RTP로 재생할 수 있음
- [ ] **MEDIA-02**: 사용자가 Wails 네이티브 파일 다이얼로그를 통해 WAV 오디오 파일을 선택할 수 있음
- [ ] **MEDIA-03**: 시스템이 WAV 파일을 검증하여 8kHz mono PCM 포맷이 아닌 경우 사용자에게 오류를 표시함

### DTMF

- [ ] **DTMF-01**: 사용자가 SendDTMF Command 노드를 배치하여 RFC 2833 RTP telephone-event로 DTMF digits를 전송할 수 있음
- [ ] **DTMF-02**: 사용자가 DTMFReceived Event 노드에서 수신된 digit 값을 캡처하고, 선택적으로 특정 digit를 대기(expectedDigit)할 수 있음

### 코덱 선택

- [ ] **CODEC-01**: 사용자가 SIP Instance 노드에서 선호 코덱 목록(PCMU/PCMA)과 우선순위를 설정하여 SDP 협상에 반영할 수 있음

### 비기능 요구사항

- [ ] **NF-01**: 새 Command/Event 노드가 기존 노드 팔레트의 드래그앤드롭 패턴과 일관되게 동작함
- [ ] **NF-02**: 미디어 관련 Go 코드에 단위 테스트가 포함됨
- [ ] **NF-03**: 기존 시나리오(MakeCall→Answer→Release)가 미디어 기능 추가 후에도 정상 동작함 (회귀 방지)

---

## 향후 요구사항 (다음 마일스톤으로 연기)

### 미디어 재생 확장
- stopOnDTMF 옵션 (DTMF 수신 시 재생 중단)
- 미디어 재생 진행률 이벤트 (프론트엔드 프로그레스 바)
- loop 재생 옵션

### 통화 녹음
- StartRecording/StopRecording Command 노드
- 인스턴스별 고유 파일명 자동 생성
- Stereo WAV 저장 (Local/Remote 채널 분리)
- 부분 녹음 제어 (특정 구간만)

### DTMF 확장
- DTMF 패턴 검증 (정규식 매칭)
- SIP INFO 방식 폴백

### 코덱 확장
- 코덱 호환성 사전 검증 (양측 인스턴스 교집합 확인)
- Opus 코덱 지원 (CGO 빌드)

---

## 범위 밖 (이유와 함께)

| 기능 | 제외 이유 |
|------|-----------|
| 실시간 오디오 입력 (마이크) | 테스팅 자동화 도구에 불필요, 크로스 플랫폼 오디오 캡처 복잡도 |
| TTS (Text-to-Speech) | 외부 의존성 (Google TTS 등), 오프라인 사용 불가, MVP 과도 |
| Video (RTP video) | SIP 오디오 통화 테스트 중심, 비디오는 도메인 밖 |
| In-band DTMF | 압축 코덱에서 신뢰성 낮음, RFC 2833이 표준 |
| FAX over IP (T.38) | 니치 기능, 복잡도 매우 높음 |
| 실시간 코덱 transcoding | 복잡도 높고 성능 이슈, diago Bridge 미지원 |
| Opus 코덱 | CGO 의존성으로 크로스 컴파일 복잡화, v1.2+로 연기 |

---

## 추적성

| REQ-ID | 페이즈 | 계획 | 상태 |
|--------|--------|------|------|
| MEDIA-01 | — | — | 미배정 |
| MEDIA-02 | — | — | 미배정 |
| MEDIA-03 | — | — | 미배정 |
| DTMF-01 | — | — | 미배정 |
| DTMF-02 | — | — | 미배정 |
| CODEC-01 | — | — | 미배정 |
| NF-01 | — | — | 미배정 |
| NF-02 | — | — | 미배정 |
| NF-03 | — | — | 미배정 |
