# SIPFLOW Roadmap

## v1.0: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행 ✅
> 5 phases, 22 plans, 78 commits | [Archive](milestones/v1.0-ROADMAP.md)

## v1.1: 미디어 + DTMF ✅
> 4 phases, 8 plans, 36 commits | [Archive](milestones/v1.1-ROADMAP.md)

---

## v1.2: Transfer + UI 개선

**목표:** SIP 통화 보류(Hold/Retrieve)와 블라인드 전환(BlindTransfer)을 구현하고, Activity Bar + Resizable 사이드바로 UI를 리디자인하여 노드 에디터 완성도를 높인다.

**기간:** 2026-02-19 ~

---

### Phase 10: Hold/Retrieve Backend ✅

**목표:** 사용자가 활성 통화를 보류하고 해제하며, 상대방의 보류/해제를 감지할 수 있다

**의존성:**
- v1.1 완료 (Answer 노드 존재, DialogSession 추상화)
- AnswerOptions 리팩토링이 이 페이즈에서 선행됨 (HeldEvent/RetrievedEvent 수신 전제조건)

**요구사항:**
- HOLD-01: 사용자가 Hold Command 노드를 배치하여 활성 통화를 보류(Re-INVITE sendonly)할 수 있음
- HOLD-02: 사용자가 Retrieve Command 노드를 배치하여 보류된 통화를 재개(Re-INVITE sendrecv)할 수 있음
- HOLD-03: 사용자가 HeldEvent 노드로 상대방의 Hold Re-INVITE를 감지할 수 있음
- HOLD-04: 사용자가 RetrievedEvent 노드로 상대방의 Retrieve Re-INVITE를 감지할 수 있음

**성공 기준:**
1. 시나리오에 Hold Command 노드를 배치하고 실행하면 통화가 Re-INVITE sendonly로 보류되고 실행 로그에 Hold 이벤트가 기록됨
2. Retrieve Command 노드 실행 시 보류된 통화가 Re-INVITE sendrecv로 재개되고 미디어가 복원됨
3. 상대방이 Hold를 전송한 경우 HeldEvent 노드가 이를 감지하고 다음 노드로 진행됨
4. 상대방이 Retrieve를 전송한 경우 RetrievedEvent 노드가 이를 감지하고 다음 노드로 진행됨
5. executeAnswer()가 AnswerOptions 기반으로 리팩토링되어 OnMediaUpdate 콜백이 동작함

**Plans:** 2 plans

Plans:
- [x] 10-01-PLAN.md — AnswerOptions 리팩토링 + SIP 이벤트 버스 인프라
- [x] 10-02-PLAN.md — Hold/Retrieve Command + HeldEvent/RetrievedEvent 핸들러

---

### Phase 11: BlindTransfer + TransferEvent Backend

**목표:** 사용자가 활성 통화를 제3자 URI로 블라인드 전환하고, 상대방의 REFER 요청을 감지할 수 있다

**의존성:**
- Phase 10 완료 (AnswerOptions 리팩토링 포함)

**요구사항:**
- XFER-01: 사용자가 BlindTransfer Command 노드를 캔버스에 배치하여 활성 통화를 제3자 URI로 전환(REFER)할 수 있음
- XFER-02: 사용자가 TransferEvent 노드로 상대방이 보낸 REFER 요청을 감지하고 대기할 수 있음

**성공 기준:**
1. 시나리오에 BlindTransfer Command 노드를 배치하고 Target URI를 설정하면 통화 중 REFER 메시지가 전송됨
2. REFER 전송 후 실행 로그에 전환 대상 URI와 함께 BlindTransfer 이벤트가 기록됨
3. TransferEvent 노드가 상대방의 REFER 요청을 수신하고 다음 노드로 진행됨
4. TransferEvent 노드에서 수신한 REFER의 Refer-To URI 값이 실행 로그에 표시됨

**Plans:** (계획 예정)

---

### Phase 12: UI 리디자인 (Activity Bar + Resizable)

**목표:** 사용자가 Activity Bar의 아이콘 클릭으로 사이드바 패널을 토글하고, 사이드바 너비를 자유롭게 조절할 수 있다

**의존성:**
- 백엔드와 독립적 (프론트엔드 전용 작업)

**요구사항:**
- UI-01: 좌측에 아이콘 네비게이션 바(Activity Bar)를 두고, 아이콘 클릭 시 해당 사이드바 패널(시나리오 트리, 노드 팔레트)이 토글됨
- UI-02: 사이드바가 shadcn Resizable 컴포넌트로 너비 조절 가능함

**성공 기준:**
1. 좌측 Activity Bar에 시나리오 트리와 노드 팔레트 아이콘이 표시되고, 아이콘 클릭 시 해당 패널이 열리거나 닫힘
2. 동일 아이콘을 다시 클릭하면 사이드바가 닫혀 캔버스가 전체 너비를 사용함
3. 사이드바 경계를 드래그하여 너비를 조절할 수 있으며 조절된 너비가 세션 내 유지됨
4. 기존 시나리오 트리와 노드 팔레트 기능이 리디자인 후에도 동일하게 동작함

**Plans:** (계획 예정)

---

### Phase 13: 새 노드 UI + 통합 & 품질

**목표:** 새 Command/Event 노드(Hold, Retrieve, BlindTransfer, TransferEvent, HeldEvent, RetrievedEvent)가 완전한 UI로 동작하고 기존 시나리오와의 하위 호환성이 보장된다

**의존성:**
- Phase 10, 11 완료 (백엔드 구현)
- Phase 12 완료 (UI 구조)

**요구사항:**
- UI-03: 새 Command/Event 노드에 맞는 Properties 패널, 아이콘, 팔레트 항목이 추가됨
- NF-01: 새 Command/Event 핸들러에 대한 Go 단위 테스트가 포함됨
- NF-02: 기존 v1.1 시나리오가 깨지지 않음 (하위 호환성 유지)
- NF-03: 새 노드가 기존 노드 팔레트의 드래그앤드롭 패턴과 일관되게 동작함

**성공 기준:**
1. 6개 새 노드(Hold, Retrieve, BlindTransfer, TransferEvent, HeldEvent, RetrievedEvent)가 노드 팔레트에 표시되고 캔버스로 드래그앤드롭 가능함
2. 각 새 노드의 Properties 패널이 노드 선택 시 표시되고 필요한 파라미터를 입력할 수 있음
3. BlindTransfer, Hold, Retrieve, TransferEvent, HeldEvent, RetrievedEvent의 Go 단위 테스트가 포함됨
4. v1.1 시나리오 파일(PlayAudio, SendDTMF, DTMFReceived 포함)이 v1.2 에서 정상 로드되고 실행됨
5. 새 노드의 드래그앤드롭 동작이 기존 MakeCall, Answer, Release 노드와 동일한 UX 패턴으로 동작함

**Plans:** (계획 예정)

---

## 진행 현황

| Phase | 목표 | 요구사항 | 계획 | 상태 |
|-------|------|----------|------|------|
| 10 - Hold/Retrieve Backend | Hold/Retrieve 백엔드 구현 | HOLD-01, HOLD-02, HOLD-03, HOLD-04 | 2 plans | ✅ 완료 |
| 11 - BlindTransfer Backend | BlindTransfer/TransferEvent 백엔드 | XFER-01, XFER-02 | — | 대기 |
| 12 - UI 리디자인 | Activity Bar + Resizable 사이드바 | UI-01, UI-02 | — | 대기 |
| 13 - 새 노드 UI + 통합 | 새 노드 UI 완성 + 품질 | UI-03, NF-01, NF-02, NF-03 | — | 대기 |

**전체:** 1/4 페이즈 완료

---

## 향후 마일스톤 (예정)

### 마일스톤 v1.3: 통화 녹음 + 미디어 확장
- StartRecording/StopRecording Command 노드
- Stereo WAV 녹음 (Local/Remote 채널 분리)
- stopOnDTMF 옵션
- 미디어 재생 진행률 이벤트
- AttendedTransfer (SessionStore 복합 키 리팩토링 선결)
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
