# SIPFLOW Roadmap

## v1.0: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행 ✅
> 5 phases, 22 plans, 78 commits | [Archive](milestones/v1.0-ROADMAP.md)

## v1.1: 미디어 + DTMF ✅
> 4 phases, 8 plans, 36 commits | [Archive](milestones/v1.1-ROADMAP.md)

---

## v1.2: Transfer + UI 개선 ✅
> 4 phases, 7 plans, 32 commits | [Archive](milestones/v1.2-ROADMAP.md)

---

## v1.3: MuteTransfer + callID UI ✅

**목표:** SessionStore 복합 키 리팩토링을 선행하고, MuteTransfer Command 노드와 callID 기반 UI를 완성하여 상담 통화 후 통화 전환 시나리오를 지원한다.

**요구사항:** 15개 (SS: 7, AT: 4, UI: 4)
**페이즈:** 3 (Phase 14 → 15 → 16)

---

### Phase 14: SessionStore 멀티 다이얼로그

**목표:** 하나의 SIP 인스턴스에서 복수의 통화를 동시에 관리할 수 있다. instanceID + callID 복합 키로 모든 Command/Event 노드가 특정 dialog를 참조한다.

**의존성:** 없음 (v1.2 엔진 기반)

**요구사항:** SS-01, SS-02, SS-03, SS-04, SS-05, SS-06, SS-07

**성공 기준:**
1. 동일 인스턴스에서 MakeCall(callID="primary")과 MakeCall(callID="consult")를 실행하면 두 개의 독립적인 dialog가 SessionStore에 공존한다
2. Hold(callID="primary")를 실행하면 "consult" dialog에 영향 없이 "primary" dialog만 Hold 상태가 된다
3. Answer(callID="incoming")를 실행하면 지정된 callID로 수신 dialog가 저장되어 후속 노드에서 참조할 수 있다
4. callID를 지정하지 않은 v1.2 시나리오를 그대로 실행하면 기본값이 적용되어 오류 없이 동일하게 동작한다
5. 동일 인스턴스에서 두 개의 INVITE가 동시에 수신될 때 둘 다 처리된다 (incomingCh 버퍼 확장)

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 14-01 | SessionStore 복합 키 리팩토링 (백엔드) | 완료 |
| 14-02 | 모든 executor 노드 callID 파라미터 적용 | 완료 |

---

### Phase 15: MuteTransfer 백엔드

**목표:** Transferor가 primaryCallID dialog를 통해 Replaces 헤더가 포함된 REFER를 전송하고, final NOTIFY 수신 후 양쪽 dialog를 정리한다.

**의존성:** Phase 14 완료 (복합 키 SessionStore 필요)

**요구사항:** AT-01, AT-02, AT-03, AT-04

**성공 기준:**
1. MuteTransfer 노드 실행 시 primaryCallID dialog에서 `Refer-To: <UA3-URI>?Replaces=<consult-call-id>%3Bto-tag%3D...%3Bfrom-tag%3D...` 형식의 REFER 요청이 전송된다
2. Replaces 헤더 값이 consultCallID dialog의 SIP Call-ID, to-tag, from-tag를 자동 추출하여 올바르게 구성된다
3. REFER 전송 후 엔진이 NOTIFY(200 OK) 수신을 대기하고, 수신 완료 시 primaryCallID와 consultCallID 양쪽에 BYE를 전송한다
4. Transferee 역할 UA의 OnRefer 콜백에서 Replaces 파라미터가 포함된 REFER를 수신하면 자동으로 Transfer Target에게 INVITE with Replaces를 전송한다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 15-01 | executeMuteTransfer 구현 (REFER+Replaces+NOTIFY) | 완료 |
| 15-02 | OnRefer Replaces 감지 + dialog 교체 처리 | 완료 |

---

### Phase 16: callID UI + MuteTransfer UI

**목표:** 모든 Command/Event 노드 Properties 패널에 callID 입력 필드가 추가되고, MuteTransfer 노드가 팔레트와 Properties 패널에 반영되어 시나리오를 시각적으로 구성할 수 있다.

**의존성:** Phase 14 (callID 파라미터 스키마), Phase 15 (MuteTransfer 노드 타입)

**요구사항:** UI-01, UI-02, UI-03, UI-04

**성공 기준:**
1. MakeCall, Answer, Hold, Retrieve, Release, BlindTransfer 노드 Properties 패널에 callID 입력 필드가 표시되고 값을 저장할 수 있다
2. MuteTransfer 노드가 팔레트 Transfer 카테고리에 표시되고, 캔버스에 드래그하여 배치할 수 있다
3. MuteTransfer Properties 패널에서 primaryCallID와 consultCallID 값을 설정하면 시나리오 실행 시 해당 값이 엔진에 전달된다
4. callID 필드를 비워두고 v1.2 시나리오를 실행하면 기본값이 자동 적용되어 기존 시나리오가 오류 없이 동작한다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 16-01 | 기존 노드 Properties에 callID 필드 추가 | 완료 |
| 16-02 | MuteTransfer 노드 팔레트 + Properties UI | 완료 |

---

### v1.3 진행 현황

| Phase | 제목 | 요구사항 | 상태 |
|-------|------|----------|------|
| 14 | SessionStore 멀티 다이얼로그 | SS-01~SS-07 | 완료 |
| 15 | MuteTransfer 백엔드 | AT-01~AT-04 | 완료 |
| 16 | callID UI + MuteTransfer UI | UI-01~UI-04 | 완료 |

**커버리지:** 15/15 요구사항 매핑됨

---

## v1.4: 통화 녹음 + 미디어 확장

**목표:** 통화 녹음 제어와 재생 상태 추적을 추가해 실제 QA 시나리오에서 통화 내용을 수집·분석할 수 있게 한다.

**요구사항:** 11개 (REC: 5, MED: 3, UI: 3)
**페이즈:** 3 (Phase 17 → 18 → 19)

---

### Phase 17: Recording Backend Foundation

**목표:** StartRecording/StopRecording 노드와 recorder 생명주기 관리 기반을 구현한다.

**요구사항:** REC-01, REC-02, REC-03, REC-04, REC-05

**성공 기준:**
1. StartRecording(callID="primary") 실행 시 해당 dialog의 녹음이 시작되고 파일이 생성된다
2. StopRecording(callID="primary") 실행 시 녹음이 정상 종료되고 파일이 flush/close 된다
3. 파일명에 인스턴스 ID, logical callId, timestamp가 포함되어 충돌이 발생하지 않는다
4. Stereo WAV로 Local/Remote 채널이 분리 저장된다
5. 시나리오 중단/통화 종료 시 열린 recorder가 자동 정리된다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 17-01 | recorder 저장소 + executor 생명주기 추가 | 대기 |
| 17-02 | StartRecording/StopRecording 구현 + 정리 경로 보강 | 대기 |

---

### Phase 18: Playback Progress + stopOnDTMF

**목표:** PlayAudio에 재생 중단 조건과 진행 상태 추적을 추가한다.

**요구사항:** MED-01, MED-02, MED-03

**성공 기준:**
1. PlayAudio(stopOnDTMF=true) 실행 중 DTMF가 수신되면 재생이 중단된다
2. 재생 시작/진행/완료/중단이 실행 로그 또는 이벤트로 구분되어 표시된다
3. 진행률이 주기적으로 계산되어 모니터링 UI에서 사용할 수 있다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 18-01 | DTMF 연동 재생 중단 처리 | 대기 |
| 18-02 | 진행률 이벤트/로그 발행 | 대기 |

---

### Phase 19: Recording/Playback UI + Validation

**목표:** 새 노드와 옵션을 팔레트/Properties/Validation/UI 모니터에 연결한다.

**요구사항:** UI-01, UI-02, UI-03

**성공 기준:**
1. StartRecording/StopRecording 노드가 팔레트에 나타나고 `callId` 기반 설정이 가능하다
2. PlayAudio Properties 패널에서 `stopOnDTMF`를 설정할 수 있다
3. 필수 입력 누락 시 Validation이 실행 전에 오류를 보여준다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 19-01 | 녹음 노드 팔레트 + Properties UI | 대기 |
| 19-02 | stopOnDTMF/진행 상태 UI + validation 반영 | 대기 |

---

### v1.4 진행 현황

| Phase | 제목 | 요구사항 | 상태 |
|-------|------|----------|------|
| 17 | Recording Backend Foundation | REC-01~REC-05 | 대기 |
| 18 | Playback Progress + stopOnDTMF | MED-01~MED-03 | 대기 |
| 19 | Recording/Playback UI + Validation | UI-01~UI-03 | 대기 |

**커버리지:** 11/11 요구사항 매핑됨

---

## 향후 마일스톤 (예정)

### 마일스톤 v2.0: 고급 시나리오 + SIP 래더
- SIP 래더 다이어그램 시각화
- 조건 분기 노드 (IF/SWITCH)
- 반복 노드 (LOOP)
- 시나리오 템플릿 라이브러리

### 마일스톤 v3.0: 멀티플랫폼 + 배포
- Windows/macOS 빌드
- 자동 업데이트
- 시나리오 내보내기/공유
