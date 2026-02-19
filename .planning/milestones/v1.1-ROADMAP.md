# SIPFLOW v1.1 Roadmap Archive — 미디어 + DTMF

**Released:** 2026-02-19
**Duration:** 2026-02-11 ~ 2026-02-19 (9일)
**Stats:** 4 phases, 8 plans, 36 commits, 74 files changed (+14,375 / -213)
**Audit:** PASS (9/9 requirements, 49/49 must-haves, 24/24 integrations)

---

## 목표

SIP 통화 시나리오에 미디어 재생, DTMF 송수신, 코덱 선택 기능을 추가하여 실제 SIP 미디어 워크플로우를 시뮬레이션/실행할 수 있도록 확장

## 주요 성과

1. **코덱 설정 시스템** — SIP Instance별 PCMU/PCMA 코덱 선택 + 드래그 우선순위 변경 + SDP 반영
2. **WAV 미디어 재생** — 8kHz mono PCM 검증 + Wails 네이티브 파일 다이얼로그 + diago RTP 재생 파이프라인
3. **RFC 2833 DTMF 송수신** — SendDTMF Command + DTMFReceived Event + expectedDigit 필터링
4. **telephone-event 자동 추가** — 코덱 설정과 무관하게 DTMF 동작 보장
5. **포괄적 테스트 스위트** — 44개 테스트, 순수 함수 100% 커버리지, v1.0 호환성 검증
6. **프로젝트 문서화** — README.md 전체 재작성 (WAV 요구사항, 코덱 가이드, DTMF 예시)

---

## Phase 6: Codec Configuration ✅

**목표:** 사용자가 SIP 인스턴스별 코덱을 선택하고 우선순위를 설정하여 SDP 협상에 반영할 수 있다

**의존성:**
- v1.0 시나리오 빌더 (SIP Instance 노드)

**요구사항:**
- CODEC-01: 사용자가 SIP Instance 노드에서 선호 코덱 목록(PCMU/PCMA)과 우선순위를 설정하여 SDP 협상에 반영할 수 있음

**성공 기준:**
1. 사용자가 SIP Instance 노드 패널에서 PCMU/PCMA 코덱을 선택하고 드래그로 우선순위를 변경할 수 있음
2. 선택된 코덱 목록이 시나리오 저장 시 유지되고 로드 시 복원됨
3. 시나리오 실행 시 SDP INVITE에 사용자가 선택한 코덱 순서대로 m= 라인이 포함됨
4. 양측 인스턴스에 공통 코덱이 없으면 488 Not Acceptable 응답으로 협상 실패가 명확히 표시됨

**Plans:**
- [x] 06-01-PLAN.md — Backend 코덱 데이터 모델 + diago 통합
- [x] 06-02-PLAN.md — Frontend 코덱 선택 UI + 노드 표시

---

## Phase 7: Media Playback ✅

**목표:** 사용자가 통화 중 WAV 오디오 파일을 RTP로 재생하여 IVR 프롬프트 시뮬레이션을 수행할 수 있다

**의존성:**
- Phase 6 (코덱 협상 필수)

**요구사항:**
- MEDIA-01: 사용자가 PlayAudio Command 노드를 캔버스에 배치하여 통화 중 WAV 파일을 RTP로 재생할 수 있음
- MEDIA-02: 사용자가 Wails 네이티브 파일 다이얼로그를 통해 WAV 오디오 파일을 선택할 수 있음
- MEDIA-03: 시스템이 WAV 파일을 검증하여 8kHz mono PCM 포맷이 아닌 경우 사용자에게 오류를 표시함

**성공 기준:**
1. 사용자가 노드 팔레트에서 PlayAudio Command 노드를 드래그하여 캔버스에 배치할 수 있음
2. 사용자가 PlayAudio 노드 패널에서 "파일 선택" 버튼을 클릭하면 Wails 파일 다이얼로그가 열리고 WAV 파일을 선택할 수 있음
3. 잘못된 포맷(44.1kHz stereo 등)의 WAV 파일 선택 시 즉시 오류 메시지가 표시되고 8kHz mono PCM 요구사항이 안내됨
4. 통화 연결 상태에서 PlayAudio 노드 실행 시 선택한 WAV 파일이 RTP로 재생되고 재생 완료 후 다음 노드로 진행됨
5. 실행 패널에서 미디어 재생 진행 상황이 프로그레스 바로 표시됨

**Plans:**
- [x] 07-01-PLAN.md — Backend WAV 검증 바인딩 + 실행 엔진 PlayAudio
- [x] 07-02-PLAN.md — Frontend PlayAudio 노드 UI + 파일 선택 연동

---

## Phase 8: DTMF Send & Receive ✅

**목표:** 사용자가 RFC 2833 RTP telephone-event로 DTMF digits를 송수신하여 IVR 자동 탐색 시나리오를 구성할 수 있다

**의존성:**
- Phase 6 (코덱 협상 필수)

**요구사항:**
- DTMF-01: 사용자가 SendDTMF Command 노드를 배치하여 RFC 2833 RTP telephone-event로 DTMF digits를 전송할 수 있음
- DTMF-02: 사용자가 DTMFReceived Event 노드에서 수신된 digit 값을 캡처하고, 선택적으로 특정 digit를 대기(expectedDigit)할 수 있음

**성공 기준:**
1. 사용자가 노드 팔레트에서 SendDTMF Command 노드와 DTMFReceived Event 노드를 배치할 수 있음
2. 사용자가 SendDTMF 노드 패널에서 DTMF digits (0-9, *, #)를 입력하고 전송 간격을 설정할 수 있음
3. 통화 연결 상태에서 SendDTMF 노드 실행 시 설정한 digits가 RFC 2833 형식으로 RTP 전송됨
4. DTMFReceived Event 노드에서 expectedDigit를 설정하면 특정 digit 수신까지 대기하고, 일치하는 digit 수신 시 다음 노드로 진행됨
5. DTMFReceived 노드에서 수신된 digit 값이 로그 패널에 표시됨

**Plans:**
- [x] 08-01-PLAN.md — Backend DTMF executor (SendDTMF + DTMFReceived 실행 로직)
- [x] 08-02-PLAN.md — Frontend DTMF UI (노드 팔레트 + 캔버스 + Properties 패널)

---

## Phase 9: Integration & Polish ✅

**목표:** 새 미디어 기능이 기존 시나리오와 통합되어 안정적으로 동작하고, 프로덕션 사용을 위한 품질 기준을 충족한다

**의존성:**
- Phase 6, 7, 8 (모든 기능 완성)

**요구사항:**
- NF-01: 새 Command/Event 노드가 기존 노드 팔레트의 드래그앤드롭 패턴과 일관되게 동작함
- NF-02: 미디어 관련 Go 코드에 단위 테스트가 포함됨
- NF-03: 기존 시나리오(MakeCall→Answer→Release)가 미디어 기능 추가 후에도 정상 동작함 (회귀 방지)

**성공 기준:**
1. PlayAudio, SendDTMF, DTMFReceived 노드가 기존 Command/Event 노드와 동일한 드래그앤드롭 UX로 동작함
2. 미디어/DTMF 핵심 함수 테스트 커버리지 70% 이상
3. v1.0 시나리오 파일이 미디어 기능 추가 후에도 정상 동작함
4. 실제 SIP 서버 E2E 테스트 (시뮬레이션 통합 테스트로 대체)
5. 사용자 문서에 WAV 파일 요구사항, 코덱 선택 가이드, DTMF 사용 예시 포함

**Plans:**
- [x] 09-01-PLAN.md — Backend 테스트 스위트 (단위 테스트 + 통합 테스트 + NF 검증)
- [x] 09-02-PLAN.md — README.md 프로젝트 문서화

---

## 진행 현황

| Phase | 목표 | 요구사항 | 계획 | 상태 |
|-------|------|----------|------|------|
| 6 - Codec Configuration | 코덱 선택 및 SDP 협상 | CODEC-01 | 2/2 | ✅ 완료 |
| 7 - Media Playback | WAV 재생 | MEDIA-01, MEDIA-02, MEDIA-03 | 2/2 | ✅ 완료 |
| 8 - DTMF Send & Receive | DTMF 송수신 | DTMF-01, DTMF-02 | 2/2 | ✅ 완료 |
| 9 - Integration & Polish | 통합 테스트 및 품질 | NF-01, NF-02, NF-03 | 2/2 | ✅ 완료 |

**전체:** 4/4 페이즈 완료

---

## 기술적 결정 (v1.1)

| Phase | 결정 | 이유 |
|-------|------|------|
| 6 | stringToCodecs + telephone-event 자동 추가 | DTMF RFC 2833 보장 |
| 6 | HTML5 DnD 코덱 순서 변경 | nodrag 클래스로 ReactFlow 충돌 방지 |
| 7 | go-audio/wav 라이브러리 채택 | 순수 Go, CGO 불필요 |
| 7 | SelectWAVFile에서 즉시 검증 | UX 향상, 실행 시점 에러 방지 |
| 8 | diago Media API 패턴 | dialog.Media().AudioWriterDTMF/AudioReaderDTMF |
| 8 | goroutine + OnDTMF callback | context 취소/timeout 동시 처리 |
| 8 | Ear 아이콘 (DTMFReceived) | PhoneIncoming은 Answer에 사용 중 |
| 9 | validateWAVFormat 순수 함수 추출 | Wails runtime 없이 테스트 가능 |

## 기술 부채 (다음 마일스톤으로 이월)

| 항목 | 심각도 | 설명 |
|------|--------|------|
| Frontend validation.ts | 낮음 | PlayAudio.filePath, SendDTMF.digits 사전 검증 누락 |
| Executor 성공 경로 커버리지 | 낮음 | 실 SIP 서버 필요로 35% 이하 |
| Flaky 통합 테스트 | 낮음 | diago localhost 포트 환경 이슈 |
