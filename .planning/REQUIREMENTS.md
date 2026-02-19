# SIPFLOW v1.2 Requirements — Transfer + UI 개선

**마일스톤:** v1.2
**상태:** 정의 완료
**생성일:** 2026-02-19

---

## 이 마일스톤 요구사항

### Transfer (통화 전환)

- [ ] **XFER-01**: 사용자가 BlindTransfer Command 노드를 캔버스에 배치하여 활성 통화를 제3자 URI로 전환(REFER)할 수 있음
- [ ] **XFER-02**: 사용자가 TransferEvent 노드로 상대방이 보낸 REFER 요청을 감지하고 대기할 수 있음

### Hold/Retrieve (통화 보류/해제)

- [ ] **HOLD-01**: 사용자가 Hold Command 노드를 배치하여 활성 통화를 보류(Re-INVITE sendonly)할 수 있음
- [ ] **HOLD-02**: 사용자가 Retrieve Command 노드를 배치하여 보류된 통화를 재개(Re-INVITE sendrecv)할 수 있음
- [ ] **HOLD-03**: 사용자가 HeldEvent 노드로 상대방의 Hold Re-INVITE를 감지할 수 있음
- [ ] **HOLD-04**: 사용자가 RetrievedEvent 노드로 상대방의 Retrieve Re-INVITE를 감지할 수 있음

### UI 개선 (레이아웃 리디자인)

- [ ] **UI-01**: 좌측에 아이콘 네비게이션 바(Activity Bar)를 두고, 아이콘 클릭 시 해당 사이드바 패널(시나리오 트리, 노드 팔레트)이 토글됨
- [ ] **UI-02**: 사이드바가 shadcn Resizable 컴포넌트로 너비 조절 가능함
- [ ] **UI-03**: 새 Command/Event 노드(Hold, Retrieve, BlindTransfer, TransferEvent, HeldEvent, RetrievedEvent)에 맞는 Properties 패널, 아이콘, 팔레트 항목이 추가됨

### 비기능 요구사항

- [ ] **NF-01**: 새 Command/Event 핸들러에 대한 Go 단위 테스트가 포함됨
- [ ] **NF-02**: 기존 v1.1 시나리오가 깨지지 않음 (하위 호환성 유지)
- [ ] **NF-03**: 새 노드가 기존 노드 팔레트의 드래그앤드롭 패턴과 일관되게 동작함

---

## 향후 마일스톤으로 연기

- **AttendedTransfer**: SessionStore 복합 키 리팩토링 + diago Replaces 미지원 → v1.3
- **NOTIFY Event 노드**: Transfer 진행 상태 추적 → v1.3 (AttendedTransfer와 함께)
- **통화 녹음 (StartRecording/StopRecording)**: v1.3+
- **노드 팔레트 검색 기능**: v1.3+ (현재 수준에서 관리 가능)

## 범위 밖 (명시적 제외)

- **Attended Transfer**: 복잡도 매우 높음 (SessionStore 1:N 리팩토링, diago Replaces 미지원)
- **Hold Music 자동 재생**: Hold 시 자동 미디어 재생은 사용자가 PlayAudio 노드로 직접 구성
- **SIP INFO 기반 Hold**: Re-INVITE 방식만 지원 (RFC 6337 표준)
- **실시간 미디어 모니터링**: RTP 스트림 시각화는 범위 밖

---

## 추적성

| 요구사항 | 페이즈 | 계획 | 상태 |
|----------|--------|------|------|
| XFER-01  | Phase 11 | — | 미시작 |
| XFER-02  | Phase 11 | — | 미시작 |
| HOLD-01  | Phase 10 | — | 미시작 |
| HOLD-02  | Phase 10 | — | 미시작 |
| HOLD-03  | Phase 10 | — | 미시작 |
| HOLD-04  | Phase 10 | — | 미시작 |
| UI-01    | Phase 12 | — | 미시작 |
| UI-02    | Phase 12 | — | 미시작 |
| UI-03    | Phase 13 | — | 미시작 |
| NF-01    | Phase 13 | — | 미시작 |
| NF-02    | Phase 13 | — | 미시작 |
| NF-03    | Phase 13 | — | 미시작 |
