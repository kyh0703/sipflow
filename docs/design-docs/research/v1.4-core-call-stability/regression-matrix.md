# v1.4 Phase 17 Core Call Regression Matrix

**Status:** Active baseline for Phase 17 outputs

## Scope

이 문서는 v1.4 Phase 17의 source of truth 역할을 하는 시나리오 단위 회귀 매트릭스다. `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02`를 기능 목록이 아니라 실제 실행 순서, dialog 주소 지정, 성공/실패 신호 기준으로 고정한다.

이 문서의 목적은 두 가지다.

1. zero-context 실행자도 "무엇을 어떤 dialog key로 실행해야 하는지" 바로 알 수 있게 만든다.
2. Phase 18에서 기존 테스트/빌드/수동 검증 경로를 각 시나리오에 매핑할 때 바로 사용할 baseline을 제공한다.

## Source Of Truth

- [v1.4 requirements](../../../product-specs/active/v1.4-core-call-stability.md)
- [project state](../../../project/state.md)
- [project roadmap](../../../project/roadmap.md)
- [v1.2 transfer/hold research summary](../v1.2-transfer-hold-ui/summary.md)
- [Phase 18 verification hardening](./verification-hardening.md)

## Scenario Conventions

- Canonical dialog address는 항상 `instanceId + callId` 조합으로 표현한다.
- Phase 17 fixture에서는 암묵 기본값 대신 명시적인 `callId`를 사용한다.
- 기본 fixture key:
  - `ua-a + primary`: 발신 또는 transferor가 들고 있는 주 통화
  - `ua-b + primary`: 상대방이 같은 통화를 자기 인스턴스에서 참조하는 key
  - `ua-b + inbound`: 수신 대기 시나리오에서 수신측이 저장하는 key
  - `ua-a + consult`: transferor가 따로 만든 상담 통화
- `Success signal`은 pass 판정 근거이고, `Failure signal`은 회귀로 간주할 증상이다.
- `Likely Phase 18 verification surface`는 다음 명령 셋으로 수렴해야 한다.
  - `go test ./internal/engine/...`
  - `go test ./internal/binding/... ./internal/pkg/eventhandler/...`
  - `npm --prefix frontend run build`
  - live/manual scenario check

## Must-Have Happy Paths

### CORE-01: Outbound Basic Call

**Requirement**
`MakeCall -> Answer -> Release` 2자 통화 시나리오가 실제 실행 모드와 시뮬레이션 모드에서 모두 정상 완료됨

| Field | Baseline |
|------|----------|
| Node sequence | `ua-a: MakeCall(callId="primary")` -> `ua-b: INCOMING(callId="primary")` -> `ua-b: Answer(callId="primary")` -> `ua-a or ua-b: Release(callId="primary")` |
| Participating SIP instances | `ua-a` caller, `ua-b` callee |
| Target dialog key | `ua-a + primary`, `ua-b + primary` |
| Expected event chain | INVITE 생성 -> `INCOMING` 감지 -> 200 OK/ACK로 연결 -> 통화 유지 -> BYE/200 OK -> 상대편 `DISCONNECTED` |
| Success signal | 두 인스턴스가 같은 통화를 각자 `primary` key로 유지하고, Release가 같은 key를 닫으며 orphan dialog가 남지 않는다 |
| Failure signal | `INCOMING` 미도착, Answer/Release가 다른 key를 건드림, BYE 후 `DISCONNECTED` 누락, 통화 종료 뒤 dialog가 남음 |
| Likely Phase 18 verification surface | engine test, live/manual scenario check |

### CORE-02: Inbound Basic Call

**Requirement**
`INCOMING -> Answer -> Release` 수신 통화 시나리오가 정상 완료되고, 통화 종료 시 `DISCONNECTED` 흐름이 유지됨

| Field | Baseline |
|------|----------|
| Node sequence | `ua-b: INCOMING(callId="inbound")` -> `ua-a: MakeCall(callId="primary")` -> `ua-b: Answer(callId="inbound")` -> `ua-a or ua-b: Release(callId="inbound" or "primary")` -> opposite-side `DISCONNECTED` |
| Participating SIP instances | `ua-a` caller, `ua-b` callee |
| Target dialog key | `ua-b + inbound` is the addressed receiving leg, paired with caller-side `ua-a + primary` |
| Expected event chain | `ua-b`가 INVITE를 `INCOMING`으로 수신 -> Answer로 dialog 저장 -> 연결 후 종료 -> 종료된 반대편에 `DISCONNECTED` 전달 |
| Success signal | 수신측이 자기 key(`ua-b + inbound`)로 Answer/Release를 완료하고 종료 시 `DISCONNECTED` 흐름이 유지된다 |
| Failure signal | INCOMING 대기와 실제 Answer key가 어긋남, 종료 후 `DISCONNECTED` 미전파, 수신측이 다른 dialog key를 사용해 응답 |
| Likely Phase 18 verification surface | engine test, binding/eventhandler test, live/manual scenario check |

### CORE-03: Hold And Retrieve On Addressed Dialog

**Requirement**
`Hold`와 `Retrieve`가 지정한 `callId` dialog에만 적용되고, HELD/RETRIEVED 이벤트 흐름이 유지됨

| Field | Baseline |
|------|----------|
| Node sequence | `CORE-01`로 통화 연결 -> `ua-a: Hold(callId="primary")` -> `ua-b: HELD(callId="primary")` -> `ua-a: Retrieve(callId="primary")` -> `ua-b: RETRIEVED(callId="primary")` -> cleanup `Release(callId="primary")` |
| Participating SIP instances | `ua-a` active controller, `ua-b` remote peer |
| Target dialog key | `ua-a + primary`, `ua-b + primary` |
| Expected event chain | sendonly Re-INVITE -> remote `HELD` 감지 -> sendrecv Re-INVITE -> remote `RETRIEVED` 감지 -> 최종 종료 |
| Success signal | Hold/Retrieve가 `primary` leg에만 적용되고, 이벤트 노드가 같은 key를 기준으로 unblock된다 |
| Failure signal | `consult` 등 다른 dialog가 영향을 받음, `HELD`/`RETRIEVED` 타임아웃, Hold 실패 후 mode 복원이 안 됨 |
| Likely Phase 18 verification surface | engine test, binding/eventhandler test, live/manual scenario check |

### CORE-04: BlindTransfer On Active Dialog

**Requirement**
`BlindTransfer`가 활성 dialog 기준으로 정상 수행되고, `TRANSFERRED` 이벤트 대기 흐름이 유지됨

| Field | Baseline |
|------|----------|
| Node sequence | `CORE-01`로 `ua-a + primary` / `ua-b + primary` 연결 -> `ua-a: BlindTransfer(callId="primary", targetUri="<ua-c>")` -> `ua-b: TRANSFERRED(callId="primary")` -> transfer follow-up 또는 cleanup |
| Participating SIP instances | `ua-a` transferor, `ua-b` transferee, `ua-c` transfer target |
| Target dialog key | command target은 `ua-a + primary`, event wait target은 `ua-b + primary` |
| Expected event chain | 활성 dialog에서 REFER 전송 -> remote OnRefer/`TRANSFERRED` 경로 활성화 -> 기존 addressed leg 정리 |
| Success signal | REFER가 활성 `primary` dialog에서만 나가고, 대기 중인 `TRANSFERRED` 이벤트가 같은 dialog key로 해소된다 |
| Failure signal | REFER가 잘못된 dialog에서 전송됨, `TRANSFERRED`가 다른 leg에 귀속됨, wrong `callId`인데 다른 통화가 닫힘 |
| Likely Phase 18 verification surface | engine test, binding/eventhandler test, live/manual scenario check |

### CORE-05: MuteTransfer With Dual Dialog Keys

**Requirement**
`MuteTransfer`가 `primaryCallId`와 `consultCallId`를 사용해 정상 수행되고, final NOTIFY 이후 정리 흐름이 유지됨

| Field | Baseline |
|------|----------|
| Node sequence | `ua-a`가 `ua-b`와 `primary`, `ua-c`와 `consult` 통화를 각각 확보 -> `ua-a: MuteTransfer(primaryCallId="primary", consultCallId="consult")` -> final NOTIFY 대기 -> `ua-a`가 두 dialog cleanup |
| Participating SIP instances | `ua-a` transferor, `ua-b` original peer, `ua-c` consult target |
| Target dialog key | `ua-a + primary` is REFER sender, `ua-a + consult` provides Replaces source, remote peers keep their paired keys |
| Expected event chain | primary leg에서 Replaces REFER 전송 -> consult leg metadata 참조 -> final NOTIFY 수신 -> primary/consult 양쪽 BYE 정리 |
| Success signal | `primaryCallId`와 `consultCallId`가 동시에 필요하며 final NOTIFY 뒤에만 양쪽 dialog cleanup이 일어난다 |
| Failure signal | wrong consult key로 Replaces 구성이 실패함, final NOTIFY 전에 dialog가 닫힘, 두 leg 중 하나만 정리됨 |
| Likely Phase 18 verification surface | engine test, binding/eventhandler test, frontend build, live/manual scenario check |

## Failure Matrix And Mis-Target Cases

이 섹션은 happy path와 분리된 negative baseline이다. `DIALOG-02`의 핵심은 "잘못된 dialog를 건드리지 않는 것"이므로, 실패 자체보다 side effect 부재가 더 중요하다.

| Negative ID | Command / Wait | Wrong reference | Expected symptom | Must remain true |
|-------------|----------------|-----------------|------------------|------------------|
| NEG-01 | Hold | `ua-a`에 `primary`와 `consult`가 공존할 때 `Hold(callId="missing")` 또는 잘못된 key 사용 | addressed node는 명시적 에러 또는 timeout으로 끝나고, `ua-a + primary` / `ua-a + consult` 기존 상태는 변하지 않음 | `DIALOG-02`: 다른 dialog 비간섭 |
| NEG-02 | Retrieve | 보류된 `primary` 대신 존재하지 않는 `callId` 사용 | `RETRIEVED`가 오지 않거나 명시적 lookup 실패가 발생하고, 실제 held leg는 그대로 유지됨 | `DIALOG-02` |
| NEG-03 | Release | 다중 dialog 상태에서 잘못된 `callId`로 종료 시도 | 잘못된 key만 실패하고, 활성 `primary`/`consult` leg가 우발적으로 끊기지 않음 | `DIALOG-02` |
| NEG-04 | BlindTransfer | 활성 통화가 아닌 `callId`로 REFER 시도 | REFER 전송이 일어나지 않거나 실패로 기록되고, 다른 active leg의 `TRANSFERRED` 대기가 풀리지 않음 | `DIALOG-02` |
| NEG-05 | MuteTransfer | `primaryCallId`가 잘못됨 | REFER sender lookup이 실패하고 consult leg는 살아 있어야 함 | `DIALOG-02` |
| NEG-06 | MuteTransfer | `consultCallId`가 잘못됨 | Replaces source lookup이 실패하고 primary leg가 premature cleanup 되지 않아야 함 | `DIALOG-02` |
| NEG-07 | Event wait (`HELD`, `RETRIEVED`, `TRANSFERRED`, `DISCONNECTED`) | 실제 이벤트가 다른 `callId`에서 발생 | addressed wait node는 자기 timeout/실패 규칙을 따르고, 다른 dialog의 이벤트로 false positive 해소되면 안 됨 | `DIALOG-02` |

## Multi-Dialog Invariants

### DIALOG-01: Coexistence

- 하나의 SIP 인스턴스는 동시에 둘 이상의 dialog를 보유할 수 있어야 한다.
- 최소 baseline은 `ua-a + primary` 와 `ua-a + consult`의 동시 공존이다.
- `CORE-05`는 이 공존성을 전제로 한다. 하나라도 덮어쓰기 되면 Phase 17 실패다.

### DIALOG-02: Non-Interference

- `Hold`, `Retrieve`, `Release`, `BlindTransfer`, `MuteTransfer`, 그리고 wait 계열 event 노드는 항상 exact key(`instanceId + callId`)로 dialog를 찾아야 한다.
- 잘못된 `callId`는 "다른 dialog를 건드리지 않은 채 실패"해야 한다.
- Phase 17 fixture에서는 다중 dialog 시나리오에서 explicit `callId`를 사용한다. legacy default-path 하위 호환성(`DIALOG-03`)은 이 문서의 범위 밖이며 Phase 18에서 별도 검증한다.

## Handoff To Phase 18

Phase 18은 아래 매핑을 기준으로 기존 검증 경로를 formalize 해야 한다.

Exact proof map: [verification-hardening.md](./verification-hardening.md)

| Scenario / Cluster | Primary requirement(s) | Likely verification surface | Why this surface is first |
|--------------------|------------------------|-----------------------------|---------------------------|
| CORE-01 | `CORE-01` | `go test ./internal/engine/...`, live/manual scenario check | 기본 발신/종료 흐름은 engine path가 1차 검증면이다 |
| CORE-02 | `CORE-02` | `go test ./internal/engine/...`, `go test ./internal/binding/... ./internal/pkg/eventhandler/...`, live/manual scenario check | `INCOMING`와 `DISCONNECTED` 흐름이 event/binding 계층과 맞물린다 |
| CORE-03 | `CORE-03` | `go test ./internal/engine/...`, `go test ./internal/binding/... ./internal/pkg/eventhandler/...`, live/manual scenario check | Hold/Retrieve는 command와 event wait가 모두 맞아야 한다 |
| CORE-04 | `CORE-04` | `go test ./internal/engine/...`, `go test ./internal/binding/... ./internal/pkg/eventhandler/...`, live/manual scenario check | REFER 전송과 `TRANSFERRED` 이벤트 라우팅을 같이 확인해야 한다 |
| CORE-05 | `CORE-05`, `DIALOG-01` | `go test ./internal/engine/...`, `go test ./internal/binding/... ./internal/pkg/eventhandler/...`, `npm --prefix frontend run build`, live/manual scenario check | dual call-id 입력, Replaces 경로, UI 계약이 모두 얽혀 있다 |
| Failure matrix | `DIALOG-02` | `go test ./internal/engine/...`, `go test ./internal/binding/... ./internal/pkg/eventhandler/...` | 잘못된 key에서 side effect가 없는지 자동 판정하기 가장 쉽다 |

## Exit Criteria For Phase 17

- `CORE-01`~`CORE-05`, `DIALOG-01`, `DIALOG-02`가 모두 이 문서에서 explicit scenario 또는 invariant로 보인다.
- happy path와 negative path가 분리되어 있다.
- 각 시나리오가 target dialog key, expected event chain, success signal, failure signal을 포함한다.
- Phase 18이 사용할 verification surface가 각 시나리오 cluster마다 적혀 있다.
