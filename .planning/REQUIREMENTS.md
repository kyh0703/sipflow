# SIPFLOW v1.4 Requirements — 기본 콜 기능 안정화

**Milestone:** v1.4 — 기본 콜 기능 안정화
**Created:** 2026-03-09
**Updated:** 2026-03-13
**Status:** Active

---

## 기본 콜 회귀 (CORE)

- [ ] **CORE-01**: `MakeCall -> Answer -> Release` 2자 통화 시나리오가 실제 실행 모드와 시뮬레이션 모드에서 모두 정상 완료됨
- [ ] **CORE-02**: `INCOMING -> Answer -> Release` 수신 통화 시나리오가 정상 완료되고, 통화 종료 시 `DISCONNECTED` 흐름이 유지됨
- [ ] **CORE-03**: `Hold`와 `Retrieve`가 지정한 `callId` dialog에만 적용되고, HELD/RETRIEVED 이벤트 흐름이 유지됨
- [ ] **CORE-04**: `BlindTransfer`가 활성 dialog 기준으로 정상 수행되고, `TRANSFERRED` 이벤트 대기 흐름이 유지됨
- [ ] **CORE-05**: `MuteTransfer`가 `primaryCallId`와 `consultCallId`를 사용해 정상 수행되고, final NOTIFY 이후 정리 흐름이 유지됨

## 멀티 다이얼로그 / 하위 호환성 (DIALOG)

- [ ] **DIALOG-01**: 하나의 SIP 인스턴스에서 복수 dialog가 `instanceId + callId` 기준으로 동시에 공존할 수 있음
- [ ] **DIALOG-02**: `Hold`, `Retrieve`, `Release`, `BlindTransfer`, `MuteTransfer`, Event 노드가 잘못된 dialog를 건드리지 않고 지정 `callId`만 참조함
- [ ] **DIALOG-03**: `callId`가 비어 있는 기존 v1.2/v1.3 시나리오가 기본값 적용으로 계속 정상 파싱/실행됨
- [ ] **DIALOG-04**: 동일 인스턴스에 연속 또는 동시 수신 INVITE가 들어와도 `INCOMING` 이벤트가 FIFO로 처리됨

## UI / Validation / 계약 일치성 (UX)

- [ ] **UX-01**: 백엔드 `SupportedCommands` / `SupportedEvents`와 프론트엔드 팔레트/Properties 패널 표시가 어긋나지 않음
- [ ] **UX-02**: 기본 콜 시나리오에서 필수 입력 누락이 validation으로 사전에 드러남
- [ ] **UX-03**: `callId`, transfer 대상, timeout 등 핵심 필드가 시나리오 저장/로드 후에도 유지됨

## 자동 검증 / 성능 전환 준비 (READY)

- [ ] **READY-01**: 기본 콜 검증 시나리오가 고정된 명령으로 반복 실행 가능하여 회귀 체크에 재사용될 수 있음
- [ ] **READY-02**: 성공/실패/중단/cleanup 여부가 테스트 또는 이벤트 로그 기준으로 기계적으로 판정 가능함
- [ ] **READY-03**: ActionLog / SIP 로그에 `nodeId`, `instanceId`, `timestamp`, `callId` 등 후속 성능 분석에 필요한 식별 정보가 일관되게 남음
- [ ] **READY-04**: `StartScenario`, `StopScenario`, cleanup, 재실행 방지 동작이 안정적으로 유지되어 후속 반복 실행 기반이 됨

---

## 범위 밖 (v1.4)

| 제외 기능 | 이유 |
|-----------|------|
| 신규 미디어 확장 | 현재 우선순위는 기본 콜 기능 안정화 |
| 고급 분석/시각화 | 기본 시나리오 품질 확보 후 검토 |
| 성능 최적화 구현 | 지금은 측정 대상이 될 기본 시나리오와 판정 기준부터 고정 |

## 검증 기준

1. `go test ./internal/engine/...` 기준으로 기본 콜 회귀 테스트가 통과한다
2. `go test ./internal/binding/... ./internal/pkg/eventhandler/...` 기준으로 계약/이벤트 계층 검증이 통과한다
3. `npm --prefix frontend run build` 기준으로 UI 계약 변경이 빌드 수준에서 깨지지 않는다
4. 기존 하위 호환 테스트와 통합 테스트가 유지되어 새 범위 정의가 실제 실행 가능성을 해치지 않는다

## 다음 작업

1. must-have 기본 콜 시나리오를 시퀀스 단위로 쓴다
2. 회귀 시나리오와 실패 케이스를 우선순위화한다
3. 기존 테스트/빌드 경로를 각 시나리오에 매핑한다
