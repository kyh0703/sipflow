# SIPFLOW Roadmap

## v1.0: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행 ✅
> 5 phases, 22 plans, 78 commits | [Archive](../product-specs/archive/milestones/v1.0/roadmap.md)

## v1.1: 미디어 + DTMF ✅
> 4 phases, 8 plans, 36 commits | [Archive](../product-specs/archive/milestones/v1.1/roadmap.md)

---

## v1.2: Transfer + UI 개선 ✅
> 4 phases, 7 plans, 32 commits | [Archive](../product-specs/archive/milestones/v1.2/roadmap.md)

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

## v1.4: 기본 콜 기능 안정화

**목표:** 신규 미디어 기능을 추가하지 않고 기존 기본 콜 기능의 안정성, 하위 호환성, 검증 품질을 우선 강화한다. 이 결과는 추후 성능 측정의 기준 시나리오로 재사용할 수 있어야 한다.

**요구사항:** 16개 (CORE: 5, DIALOG: 4, UX: 3, READY: 4)
**페이즈:** 3 (Phase 17 → 18 → 19)

---

### Phase 17: Core Call Regression Matrix

**목표:** 지금까지 만든 기본 콜 기능을 기능 단위가 아니라 시나리오 단위로 다시 묶어 must-have 회귀 매트릭스를 확정한다.

**요구사항:** CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, DIALOG-01, DIALOG-02

**성공 기준:**
1. `MakeCall -> Answer -> Release` 기본 2자 통화 시나리오가 must-have로 명시된다
2. `INCOMING -> Answer -> Release` 수신 통화 시나리오가 must-have로 명시된다
3. `Hold -> Retrieve`, `BlindTransfer`, `MuteTransfer`가 각각 독립 회귀 시나리오로 정리된다
4. 각 시나리오에 대해 대상 dialog, 기대 이벤트, 성공/실패 판정 기준이 문서로 고정된다
5. 멀티 다이얼로그와 `callId` 오지정 케이스가 실패 케이스로 분리 정리된다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 17-01 | 기본 콜 must-have 시나리오 매트릭스 정리 | 다음 |
| 17-02 | 실패 케이스 / callId 오지정 케이스 정리 | 대기 |

---

### Phase 18: Regression Verification Hardening

**목표:** 문서화한 회귀 시나리오를 현재 테스트/빌드/검증 경로에 정확히 매핑하고, 자동 판정 가능한 기준으로 강화한다.

**요구사항:** DIALOG-03, DIALOG-04, UX-01, UX-02, UX-03, READY-01, READY-02, READY-04

**성공 기준:**
1. 회귀 시나리오별로 대응되는 Go 테스트 또는 빌드 검증 경로가 명시된다
2. `StartScenario`, `StopScenario`, cleanup, 재실행 방지 항목이 회귀 체크 목록에 포함된다
3. v1.0~v1.3 하위 호환 시나리오가 계속 파싱/실행 가능함을 확인하는 기준이 유지된다
4. 백엔드 지원 명세와 프론트엔드 팔레트/Properties/validation 간 계약 체크 포인트가 고정된다
5. 검증 명령이 반복 실행 가능한 baseline 명령 셋으로 정리된다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 18-01 | 기존 테스트/빌드 경로를 회귀 시나리오에 매핑 | 대기 |
| 18-02 | cleanup / restart / contract 검증 기준 보강 | 대기 |

---

### Phase 19: Performance-Ready Baseline

**목표:** 아직 성능 테스트를 구현하지 않되, 나중에 성능 측정으로 전환할 수 있도록 반복 실행 기준과 로그 판독 기준을 고정한다.

**요구사항:** READY-03

**성공 기준:**
1. 기본 콜 기준 시나리오와 검증 명령이 “반복 실행 가능한 baseline”으로 문서화된다
2. ActionLog / SIP 로그에서 어떤 필드로 성공/실패/지연을 판독할지 기준이 정리된다
3. 성능 테스트로 확장할 때 재사용할 수 있는 시나리오 목록과 제외 범위가 정리된다

**진행 추적:**

| Plan | 제목 | 상태 |
|------|------|------|
| 19-01 | baseline 시나리오/명령/판정 기준 정리 | 대기 |
| 19-02 | 성능 전환용 로그/아티팩트 기준 정리 | 대기 |

### v1.4 진행 현황

| Phase | 제목 | 요구사항 | 상태 |
|-------|------|----------|------|
| 17 | Core Call Regression Matrix | CORE-01~05, DIALOG-01~02 | 다음 |
| 18 | Regression Verification Hardening | DIALOG-03~04, UX-01~03, READY-01~02, READY-04 | 대기 |
| 19 | Performance-Ready Baseline | READY-03 | 대기 |

**커버리지:** 16/16 요구사항 매핑됨

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
