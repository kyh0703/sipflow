# SIPFLOW Roadmap

## v1.0: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행 ✅
> 5 phases, 22 plans, 78 commits | [Archive](milestones/v1.0-ROADMAP.md)

## v1.1: 미디어 + DTMF ✅
> 4 phases, 8 plans, 36 commits | [Archive](milestones/v1.1-ROADMAP.md)

---

## v1.2: Transfer + UI 개선 ✅
> 4 phases, 7 plans, 32 commits | [Archive](milestones/v1.2-ROADMAP.md)

---

## v1.3: AttendedTransfer

**목표:** SessionStore 복합 키 리팩토링을 선행하고, Attended Transfer Command 노드를 구현하여 상담 통화 후 통화 전환 시나리오를 지원한다.

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
| 14-01 | SessionStore 복합 키 리팩토링 (백엔드) | 대기 |
| 14-02 | 모든 executor 노드 callID 파라미터 적용 | 대기 |

---

### Phase 15: AttendedTransfer 백엔드

**목표:** Transferee UA가 primaryCallID dialog를 통해 Replaces 헤더가 포함된 REFER를 전송하고, NOTIFY 수신 후 양쪽 BYE를 자동 처리한다.

**의존성:** Phase 14 완료 (복합 키 SessionStore 필요)

**요구사항:** AT-01, AT-02, AT-03, AT-04

**성공 기준:**
1. AttendedTransfer 노드 실행 시 primaryCallID dialog에서 `Refer-To: <UA3-URI>?Replaces=<consult-call-id>%3Bto-tag%3D...%3Bfrom-tag%3D...` 형식의 REFER 요청이 전송된다
2. Replaces 헤더 값이 consultCallID dialog의 SIP Call-ID, to-tag, from-tag를 자동 추출하여 올바르게 구성된다
3. REFER 전송 후 엔진이 NOTIFY(200 OK) 수신을 대기하고, 수신 완료 시 primaryCallID와 consultCallID 양쪽에 BYE를 전송한다
4. Transferee 역할 UA의 OnRefer 콜백에서 Replaces 파라미터가 포함된 REFER를 수신하면 자동으로 Transfer Target에게 INVITE with Replaces를 전송한다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 15-01 | executeAttendedTransfer 구현 (REFER+Replaces) | 대기 |
| 15-02 | OnRefer Replaces 감지 + 자동 INVITE 전송 | 대기 |

---

### Phase 16: callID UI + AttendedTransfer UI

**목표:** 모든 Command/Event 노드 Properties 패널에 callID 입력 필드가 추가되고, AttendedTransfer 노드가 팔레트에 등록되어 완전한 Attended Transfer 시나리오를 시각적으로 구성할 수 있다.

**의존성:** Phase 14 (callID 파라미터 스키마), Phase 15 (AttendedTransfer 노드 타입)

**요구사항:** UI-01, UI-02, UI-03, UI-04

**성공 기준:**
1. MakeCall, Answer, Hold, Retrieve, Release, BlindTransfer 노드 Properties 패널에 callID 입력 필드가 표시되고 값을 저장할 수 있다
2. AttendedTransfer 노드가 팔레트 Transfer 카테고리에 아이콘과 함께 표시되고, 캔버스에 드래그하여 배치할 수 있다
3. AttendedTransfer Properties 패널에서 primaryCallID와 consultCallID 값을 설정하면 시나리오 실행 시 해당 값이 엔진에 전달된다
4. callID 필드를 비워두고 v1.2 시나리오를 실행하면 기본값이 자동 적용되어 기존 시나리오가 오류 없이 동작한다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 16-01 | 기존 노드 Properties에 callID 필드 추가 | 대기 |
| 16-02 | AttendedTransfer 노드 팔레트 + Properties UI | 대기 |

---

### v1.3 진행 현황

| Phase | 제목 | 요구사항 | 상태 |
|-------|------|----------|------|
| 14 | SessionStore 멀티 다이얼로그 | SS-01~SS-07 | 대기 |
| 15 | AttendedTransfer 백엔드 | AT-01~AT-04 | 대기 |
| 16 | callID UI + AttendedTransfer UI | UI-01~UI-04 | 대기 |

**커버리지:** 15/15 요구사항 매핑됨

---

## 향후 마일스톤 (예정)

### 마일스톤 v1.4: 통화 녹음 + 미디어 확장
- StartRecording/StopRecording Command 노드
- Stereo WAV 녹음 (Local/Remote 채널 분리)
- stopOnDTMF 옵션
- 미디어 재생 진행률 이벤트
- NOTIFY Event 노드 (Transfer 진행 상태 추적)

### 마일스톤 v2.0: 고급 시나리오 + SIP 래더
- SIP 래더 다이어그램 시각화
- 조건 분기 노드 (IF/SWITCH)
- 반복 노드 (LOOP)
- 시나리오 템플릿 라이브러리

### 마일스톤 v3.0: 멀티플랫폼 + 배포
- Windows/macOS 빌드
- 자동 업데이트
- 시나리오 내보내기/공유
