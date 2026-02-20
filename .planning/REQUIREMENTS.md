# SIPFLOW v1.3 Requirements — AttendedTransfer

**Milestone:** v1.3 — AttendedTransfer
**Created:** 2026-02-20
**Status:** Active

---

## SessionStore 멀티 다이얼로그 (SS)

- [ ] **SS-01**: 사용자가 하나의 SIP 인스턴스에서 복수의 통화를 동시에 관리할 수 있음 (instanceID + callID 복합 키)
- [ ] **SS-02**: 사용자가 MakeCall 노드에서 callID를 지정하여 생성되는 dialog를 식별할 수 있음
- [ ] **SS-03**: 사용자가 Answer 노드에서 callID를 지정하여 수신 dialog를 식별할 수 있음
- [ ] **SS-04**: 사용자가 Hold, Retrieve, Release, BlindTransfer 노드에서 callID로 특정 dialog를 참조할 수 있음
- [ ] **SS-05**: 사용자가 Event 노드(CallConnected, CallReleased, HoldEvent, TransferEvent 등)에서 callID로 특정 dialog의 이벤트를 대기할 수 있음
- [ ] **SS-06**: callID 미지정 시 기본값으로 동작하여 v1.2 시나리오가 변경 없이 실행됨
- [ ] **SS-07**: 동일 인스턴스에 다중 INVITE 수신을 지원함 (incomingCh 버퍼 확장)

## AttendedTransfer (AT)

- [ ] **AT-01**: 사용자가 AttendedTransfer 노드를 배치하여 primaryCallID의 dialog에서 Refer-To + Replaces 헤더를 포함한 REFER를 전송할 수 있음
- [ ] **AT-02**: Replaces 헤더가 consultCallID의 dialog에서 SIP Call-ID/to-tag/from-tag를 자동 추출하여 구성됨
- [ ] **AT-03**: REFER 전송 후 NOTIFY(200 OK) 수신까지 대기하고, 성공 시 양쪽 dialog BYE 자동 전송
- [ ] **AT-04**: Transferee의 OnRefer 콜백에서 Replaces 파라미터가 감지되면 자동으로 INVITE+Replaces를 Transfer Target에 전송 (엔진 자동 처리)

## 프론트엔드 UI (UI)

- [ ] **UI-01**: AttendedTransfer 노드가 노드 팔레트 Transfer 카테고리에 등록됨 (아이콘 포함)
- [ ] **UI-02**: AttendedTransfer Properties 패널에서 primaryCallID, consultCallID를 설정할 수 있음
- [ ] **UI-03**: 기존 Command/Event 노드 Properties에 callID 입력 필드가 추가됨
- [ ] **UI-04**: callID 미입력 시 기본값이 자동 적용되어 v1.2 시나리오가 그대로 동작함

---

## 향후 요구사항 (v1.4+로 연기)

- 통화 녹음 (StartRecording/StopRecording Command)
- NOTIFY Event 노드 (별도 구현)
- Conference/3자 통화 (B2BUA 미디어 믹싱)
- 시나리오 템플릿 라이브러리

## 범위 밖 (명시적 제외)

| 제외 기능 | 이유 |
|-----------|------|
| Music on Hold 자동 재생 | Hold + PlayAudio 조합으로 표현 가능 |
| a=inactive Hold 모드 | sendonly가 표준, 엣지 케이스 |
| 팔레트 검색 하이라이팅 | v1.4 폴리시 |
| 로그 파일 Export | v1.4 |

## 추적성

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| SS-01 | — | — | Pending |
| SS-02 | — | — | Pending |
| SS-03 | — | — | Pending |
| SS-04 | — | — | Pending |
| SS-05 | — | — | Pending |
| SS-06 | — | — | Pending |
| SS-07 | — | — | Pending |
| AT-01 | — | — | Pending |
| AT-02 | — | — | Pending |
| AT-03 | — | — | Pending |
| AT-04 | — | — | Pending |
| UI-01 | — | — | Pending |
| UI-02 | — | — | Pending |
| UI-03 | — | — | Pending |
| UI-04 | — | — | Pending |
