# Phase 11 Context: BlindTransfer + TransferEvent Backend

> 사용자가 활성 통화를 제3자 URI로 블라인드 전환하고, 상대방의 REFER 요청을 감지할 수 있다

## 논의된 영역

1. [BlindTransfer 후 통화 종료 정책](#1-blindtransfer-후-통화-종료-정책)
2. [TransferEvent에서 새 Dialog 처리](#2-transferevent에서-새-dialog-처리)
3. [Target URI 데이터 모델](#3-target-uri-데이터-모델)

---

## 1. BlindTransfer 후 통화 종료 정책

### 결정사항

**Hold는 분리 — BlindTransfer는 REFER + BYE만 담당:**
- 사용자가 BlindTransfer 전에 Hold 노드를 별도로 배치해야 함
- BlindTransfer 노드는 REFER 전송 + BYE 전송만 처리
- 시나리오 그래프에서 플로우가 명시적으로 보임: `Hold → BlindTransfer`
- Hold 없이 BlindTransfer를 실행해도 동작하지만, 표준 플로우는 Hold 선행

**202 Accepted 후 즉시 BYE — NOTIFY 대기 없음:**
- REFER 전송 후 202 Accepted 응답을 확인하면 즉시 BYE 전송
- diago `ReferServerOptions.OnNotify` 콜백 미사용 (단순성 우선)
- NOTIFY 기반 전환 결과 추적은 v1.3 NOTIFY Event 노드에서 다룸
- diago 주석: *"It is expected that after calling this you are hanguping call to send BYE"*

**자동 종료 플로우 (RFC 3515 Blind Transfer 기반):**
```
시나리오 그래프:  Hold → BlindTransfer
실제 SIP 플로우:  re-INVITE[hold] → REFER(Refer-To: target) → 202 Accepted → BYE
```

### 참고 래더 다이어그램

```
Alice (transferor)          Bob (transferee)          Carol (target)
     │                           │                        │
     │ ── re-INVITE[hold] ────→ │                        │
     │ ←── 200 OK/ACK ──────── │                        │
     │                           │                        │
     │ ── REFER (Refer-To: Carol) → │                    │
     │ ←── 202 Accepted ──────── │                        │
     │                           │ ── INVITE ──────────→ │
     │                           │ ←── 200 OK/ACK ────── │
     │                           │ ←═══ Session #2 ═════→ │
     │ ←── NOTIFY ───────────── │                        │
     │ ── BYE ──────────────→ │                        │
     │ ←── 200 OK ─────────── │                        │
```

---

## 2. TransferEvent에서 새 Dialog 처리

### 결정사항

**SessionStore 교체 — 기존 dialog를 새 dialog로 대체:**
- OnRefer 콜백이 `*diago.DialogClientSession` (새 dialog)을 받음
- 이 새 dialog를 SessionStore에 반영하여 기존 dialog를 교체
- 후속 노드(PlayAudio, Hold, Release 등)가 새 통화를 자연스럽게 제어
- 기존 dialog는 상대방(transferor)의 BYE로 종료됨

**Refer-To URI 로그 표시 (필수 — ROADMAP 성공기준 4번):**
- TransferEvent 노드에서 수신한 REFER의 Refer-To URI를 ActionLog에 기록
- `WithSIPMessage()`를 활용하여 SIP 메시지 로그에도 포함
- 성공기준: *"TransferEvent 노드에서 수신한 REFER의 Refer-To URI 값이 실행 로그에 표시됨"*

**OnRefer 스텁 확장 (Phase 10 기반):**
- 현재 executor.go:322-328에 OnRefer 스텁이 존재 (TRANSFERRED 이벤트 발행 + ActionLog)
- Phase 11에서 이를 확장: Refer-To URI 추출 + SessionStore 교체 + 로그 강화
- executeWaitSIPEvent("TRANSFERRED")로 이벤트 대기 (Phase 10의 SIP 이벤트 버스 활용)

### SessionStore 교체 흐름

```
1. OnRefer 콜백 수신 (referDialog *diago.DialogClientSession)
2. REFER 요청에서 Refer-To URI 추출
3. ActionLog에 Refer-To URI 기록
4. emitSIPEvent(instanceID, "TRANSFERRED") 발행
5. SessionStore에서 기존 dialog를 referDialog로 교체
6. TransferEvent 노드가 "TRANSFERRED" 이벤트 수신 → 다음 노드로 진행
7. 후속 노드는 새 dialog(transferee ↔ target 통화)를 자동으로 사용
```

---

## 3. Target URI 데이터 모델

### 결정사항

**user@host 분리 입력:**
- BlindTransfer 노드 데이터에 `targetUser`와 `targetHost` 두 필드로 분리 저장
- `sip:` 접두사는 executor에서 자동 추가 (사용자 입력 불필요)
- diago `Refer()` API가 `sip.Uri` 타입을 받으므로, 런타임에 조합: `sip:{user}@{host}`

**노드 데이터 구조 (예상):**
```json
{
  "type": "BlindTransfer",
  "data": {
    "targetUser": "carol",
    "targetHost": "192.168.1.100:5060"
  }
}
```

**검증 규칙 (executor 수준):**
- targetUser와 targetHost 모두 비어있으면 에러
- SIP URI 파싱은 diago의 `sip.ParseUri()`에 위임
- Properties 패널 UI 검증은 Phase 13에서 구현

---

## 논의하지 않은 영역 (Claude 판단)

### A. 에러 처리 전략

사용자가 이 영역을 선택하지 않았으므로, Claude가 기존 패턴 기반으로 판단합니다:

- REFER 거부(403, 603 등): executor에서 에러 반환 → FailureNext 경로 진행
- dialog 미존재: 기존 "no dialog for instance" 에러 패턴 재사용
- SIP URI 파싱 실패: 실행 전 검증 → ActionLog에 에러 기록
- 기존 executeHold/executeRetrieve의 에러 처리 패턴 동일 적용

### B. MakeCall(발신자) 측 BlindTransfer 지원

- Phase 11에서는 Answer로 수신한 DialogServerSession의 `Refer()` API를 우선 구현
- MakeCall로 생성된 DialogClientSession의 `Refer()`도 동일 API 존재
- 두 세션 타입 모두 지원하되, DialogSession 인터페이스에 Refer()가 없으므로 Phase 10의 reInviter 패턴(로컬 인터페이스 어서션)을 재사용

### C. 테스트 전략

- executeBlindTransfer: diago Refer()가 구체 타입이므로 인터페이스 어서션 + 에러 경로 단위 테스트
- TransferEvent: executeWaitSIPEvent("TRANSFERRED")가 이미 Phase 10에서 구현/테스트됨, OnRefer 콜백의 SessionStore 교체 로직 테스트 추가
- 기존 integration_test.go 패턴 확장

---

## 기존 인프라 활용 (Phase 10 산출물)

| Phase 10 산출물 | Phase 11에서 활용 |
|-----------------|-------------------|
| OnRefer 스텁 (executor.go:322-328) | Refer-To URI 추출 + SessionStore 교체로 확장 |
| SIP 이벤트 버스 (emitSIPEvent/Subscribe) | "TRANSFERRED" 이벤트 대기 (executeWaitSIPEvent) |
| executeWaitSIPEvent() | TransferEvent 노드의 이벤트 대기 핸들러 |
| reInviter 로컬 인터페이스 패턴 | Refer() 메서드 접근을 위한 referrer 인터페이스 정의 |
| AnswerOptions 리팩토링 | OnRefer 콜백이 이미 등록됨 |

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| NOTIFY Event 노드 | ROADMAP v1.3 | 전환 진행 상태 추적, Phase 11에서는 NOTIFY 무시 |
| AttendedTransfer | ROADMAP v1.3 | SessionStore 복합 키 + diago Replaces 미지원 |
| Refer-To URI 조건 분기 | 논의 영역 2 | v2.0 조건 분기 노드(IF/SWITCH)와 연계 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 11` — Phase 11의 상세 실행 계획(PLAN.md) 생성
