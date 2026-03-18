# Features Research: Transfer/Hold + UI 개선 (v1.2)

**도메인:** SIP Call Flow Simulator — Transfer/Hold + UI 개선
**리서치일:** 2026-02-19
**프로젝트:** SIPFLOW v1.2 마일스톤
**신뢰도:** HIGH (diago 라이브러리 소스 직접 확인, RFC 3515/3891/5589/3264 공식 문서 교차 검증)

---

## Executive Summary

SIP Transfer(Blind/Attended)와 Hold/Retrieve는 프로토콜 관점에서 명확하게 정의된 기능이다. diago v0.26.2 소스 코드를 직접 확인한 결과, Blind Transfer(`Refer()`)와 Hold를 위한 Re-INVITE 지원이 이미 라이브러리에 구현되어 있다. Attended Transfer는 `Replaces` 헤더를 수동으로 구성해야 하며 diago에서 직접 지원하지 않는다(현재 주석 처리됨). 노드 팔레트는 v1.1에서 이미 Section 기반 그룹화를 구현했으며, v1.2에서는 Search 입력과 팔레트 노드 수 증가 대응이 핵심 UI 과제다.

---

## Transfer 기능

### Blind Transfer (블라인드 전환)

**분류: 테이블 스테이크** — SIP 테스팅 툴에서 가장 기본적인 Transfer 시나리오

#### SIP 프로토콜 흐름 (RFC 3515 / RFC 5589)

```
Transferor (A)        Transferee (B)        Transfer Target (C)
      |                     |                       |
      |<---- INVITE --------|                       |
      |------ 200 OK ------>|                       |
      |<------ ACK ---------|                       |
      |                     |                       |
      | [Optionally Hold B] |                       |
      |--- Re-INVITE(hold)->|                       |
      |<--- 200 OK(hold) ---|                       |
      |------ ACK --------->|                       |
      |                     |                       |
      |--- REFER ---------->| Refer-To: sip:C       |
      |<-- 202 Accepted ----|                       |
      |<-- NOTIFY(100) -----|                       |
      |--- 200 OK --------->|                       |
      |                     |--- INVITE ----------->|
      |                     |<-- 200 OK ------------|
      |                     |--- ACK -------------->|
      |<-- NOTIFY(200 OK) --|                       |
      |--- 200 OK --------->|                       |
      |--- BYE ------------>|                       |
      |<-- 200 OK ----------|                       |
```

**핵심 메시지:**
- `REFER` 요청에 `Refer-To: <sip:target@host>` 헤더 포함
- Transferee는 `202 Accepted` 응답 (비동기 처리 예약)
- NOTIFY 바디: `message/sipfrag;version=2.0` Content-Type으로 `SIP/2.0 100 Trying` → `SIP/2.0 200 OK` 진행
- Transfer 성공(200 OK NOTIFY 수신) 후 Transferor가 BYE 전송

#### diago 라이브러리 지원 (HIGH 신뢰도 — 소스 직접 확인)

```go
// DialogClientSession.Refer() — Blind Transfer 전용 (dialog_client_session.go:553)
func (d *DialogClientSession) Refer(ctx context.Context, referTo sip.Uri) error {
    cont := d.InviteResponse.Contact()
    return dialogRefer(ctx, d, cont.Address, referTo)
}

// DialogServerSession.Refer() — 헤더 추가 지원 (dialog_server_session.go:349)
func (d *DialogServerSession) Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error {
    cont := d.InviteRequest.Contact()
    return dialogRefer(ctx, d, cont.Address, referTo, headers...)
}

// 내부 dialogRefer — REFER 전송 및 202 Accepted 확인
func dialogRefer(ctx context.Context, d DialogSession, recipient sip.Uri, referTo sip.Uri, headers ...sip.Header) error {
    req := sip.NewRequest(sip.REFER, recipient)
    req.AppendHeader(sip.NewHeader("Refer-To", referTo.String()))
    res, err := d.Do(ctx, req)
    if res.StatusCode != sip.StatusAccepted { /* error */ }
    return nil
}
```

NOTIFY 수신은 `dialogHandleReferNotify()`가 자동 처리하며, `SIP/2.0 200` sipfrag 수신 시 `d.Hangup()` 자동 호출.

#### Command 노드 설계

```typescript
// BlindTransfer Command 노드 속성
{
  command: "BlindTransfer",
  sipInstanceId: "instance-1",
  targetUri: "sip:1002@192.168.1.100",  // Transfer 대상 URI
  timeout: 30000,                         // ms (기본 30초)
}
```

**의존성:** 활성 Dialog 필요 (MakeCall + CONNECTED 또는 INCOMING + Answer 이후)

#### 예상 사용자 시나리오

```
[SIP Instance A] → [MakeCall: sip:B] → [INCOMING on A... 미사용]
[SIP Instance B] → [INCOMING] → [Answer] → [BlindTransfer: sip:C]
```

**복잡도: 낮음** — diago `Refer()` 메서드 직접 사용, NOTIFY 자동 처리

---

### Attended Transfer (어텐디드 전환)

**분류: 차별화 요소** — Blind Transfer보다 복잡하지만 실무 PBX 테스트에 필수

#### SIP 프로토콜 흐름 (RFC 3891 + RFC 5589)

```
Transferor (A)     Transferee (B)     Consultation (C)    Transfer Target (C)
      |                 |                   |                      |
      | [통화 중: A-B] |                   |                      |
      |                 |                   |                      |
      | [상담 통화 시작]|                   |                      |
      |--- INVITE ----------------------------------------->|      |
      |<-- 200 OK ------------------------------------------|      |
      |--- ACK --------------------------------------------->|      |
      |                 |                   |                      |
      | [B를 상담통화로 Transfer]                                   |
      |--- REFER ------->|                                          |
      |   Refer-To: <sip:C?Replaces=dialog-id>                    |
      |<-- 202 Accepted--|                                          |
      |<-- NOTIFY(100) --|                                          |
      |                  |--- INVITE (Replaces: dialog-C) -------->|
      |                  |<-- 200 OK ------------------------------|
      |                  |--- ACK --------------------------------->|
      |<-- NOTIFY(200) --|                                          |
      |--- BYE --------->|  (A-B 통화 종료)                        |
      |--- BYE -------------------------------------------->|  (A-C 종료)
```

**핵심 차이점 (Blind vs Attended):**
- REFER의 `Refer-To` 헤더에 `?Replaces=call-id%3Btag%3D...` 파라미터 포함
- `Replaces` 헤더 (RFC 3891): Transferee가 기존 A-C dialog를 교체하는 새 dialog 생성

#### diago 라이브러리 지원 상태 (MEDIUM 신뢰도)

```go
// diago.go:397 — Replaces 지원은 현재 주석 처리됨
// res.AppendHeader(sip.NewHeader("Supported", "replaces, 100rel"))

// DialogServerSession.Refer()는 headers ...sip.Header 지원 — 수동으로 Replaces 전달 가능
func (d *DialogServerSession) Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
```

`sipgo` 레벨에서 Replaces 헤더를 수동으로 구성 후 DialogSIP()의 Call-ID, From-tag, To-tag를 조합해 전달하는 방식으로 구현 가능하다. diago가 직접 AttendedTransfer 메서드를 제공하지 않으므로, 구현 복잡도가 높다.

#### Command 노드 설계

```typescript
// AttendedTransfer Command 노드 속성
{
  command: "AttendedTransfer",
  sipInstanceId: "instance-1",    // Transfer를 수행하는 인스턴스 (Transferor)
  consultationCallId: "instance-2", // 상담 통화를 보유한 인스턴스 ID (Consultation Dialog)
  timeout: 30000,
}
```

**의존성:**
- 두 개의 활성 Dialog 필요 (원래 통화 + 상담 통화)
- SessionStore가 인스턴스별 복수 Dialog를 관리할 수 있어야 함
- 현재 `SessionStore`는 `instanceID -> dialog` 1:1 매핑 — 확장 필요

**복잡도: 높음**
- SessionStore 확장 (1:N dialog 지원)
- Replaces 헤더 수동 구성 (Call-ID, from-tag, to-tag 추출)
- 두 개의 dialog lifecycle 동시 관리

---

### TransferEvent (REFER 수신 이벤트)

**분류: 테이블 스테이크** — 프론트엔드에 `TRANSFERRED` 이벤트 타입 이미 존재, 백엔드 미구현

#### 동작

Transferee로 동작하는 인스턴스가 REFER를 수신하는 시나리오 대기:

```
[SIP Instance B] → [INCOMING] → [Answer] → [TRANSFERRED Event]
                                                    ↓
                                        Refer-To URI 캡처
                                                    ↓
                                        [MakeCall: capturedUri]
```

#### diago 지원

`dialogHandleRefer()` 내부에서 `onReferDialog` 콜백을 통해 새 dialog 제공. `AnswerOptions.OnRefer`로 등록:

```go
serverSession.AnswerOptions(diago.AnswerOptions{
    OnRefer: func(referDialog *diago.DialogClientSession) {
        // Transferee가 새 통화를 받아 처리
    },
})
```

**이벤트 데이터 (프론트엔드 → 백엔드):**
```typescript
{
  event: "TRANSFERRED",
  sipInstanceId: "instance-1",
  timeout: 30000,
}
```

**이벤트 결과 데이터 (백엔드 → 프론트엔드 로그):**
```
[instance-1] TRANSFERRED event received, Refer-To: sip:1003@host
[instance-1] Auto-dialing transfer target: sip:1003@host
```

**복잡도: 중간** — diago `AnswerOptions.OnRefer` 연결 + 새 dialog를 SessionStore에 저장

---

### NOTIFY Event (Transfer 진행 상태)

**분류: 차별화 요소** — Transfer 중 진행 상태 추적

프론트엔드에 `NOTIFY` 이벤트 타입이 이미 존재. REFER 이후 Transferor가 NOTIFY 수신을 대기하는 시나리오:

```
[BlindTransfer] → [NOTIFY Event] → (성공/실패 분기)
                        ↓ success: SIP/2.0 200 sipfrag
                        ↓ failure: SIP/2.0 503/603 sipfrag
```

diago의 `dialogHandleReferNotify()`는 자동으로 처리하고 `200 OK` sipfrag 수신 시 Hangup을 호출한다. 별도 NOTIFY Event 노드가 필요한 경우는 Transfer 이후 상태를 명시적으로 로깅/분기하고 싶을 때다.

**현재 판단:** NOTIFY Event 노드를 별도로 구현하는 것은 복잡도 대비 가치가 낮다. BlindTransfer Command 내부에서 NOTIFY 상태를 로그로 발행하는 것으로 충분. 프론트엔드 팔레트에는 노드 유지하되 v1.2에서는 구현하지 않는다.

**복잡도: 높음** (별도 Event 노드로 구현 시) / 낮음 (BlindTransfer 로그 내장 시)

---

## Hold/Retrieve 기능

### Hold (통화 보류)

**분류: 테이블 스테이크** — SIP 테스팅 툴의 핵심 시나리오

#### SIP 프로토콜 흐름 (RFC 3264 / RFC 6337)

```
Holding UA (A)           Held UA (B)
       |                      |
       |--- Re-INVITE -------->|
       |    a=sendonly         |
       |<-- 200 OK ------------|
       |    a=recvonly         |
       |--- ACK -------------->|
       |                      |
       | [보류 중: A는 전송만, B는 수신만]
       | [Hold Music: B에서 재생 가능]
```

**SDP 방향 속성 규칙 (RFC 3264):**

| 상태 | Holding UA SDP | Held UA 응답 |
|------|----------------|--------------|
| 활성 통화 | `a=sendrecv` | `a=sendrecv` |
| Hold 시작 | `a=sendonly` | `a=recvonly` |
| Hold 해제 | `a=sendrecv` | `a=sendrecv` |
| 완전 차단 | `a=inactive` | `a=inactive` |

#### diago 구현 방법 (HIGH 신뢰도 — 소스 직접 확인)

```go
// 1. MediaSession.Mode를 sendonly로 변경
dialog.Media().MediaSession().Mode = sdp.ModeSendonly

// 2. Re-INVITE 전송 (DialogClientSession.ReInvite 또는 DialogServerSession.ReInvite)
err := dialog.(*diago.DialogClientSession).ReInvite(ctx)

// 3. RTP 쓰기 중단 (선택적 — sendonly이므로 RTP 수신은 유지)
dialog.Media().StopRTP(2, 0) // 2 = write stop
```

`ReInvite()` 메서드는 `DialogClientSession`과 `DialogServerSession` 모두에 구현되어 있으며, 현재 `d.mediaSession.LocalSDP()`를 사용한다. `Mode`를 변경한 후 `ReInvite()`를 호출하면 `sendonly` SDP가 생성된다.

**주의:** `ReInvite()` 후 `mediaSession`이 Fork되고 내부적으로 업데이트됨 — Mode 변경은 `ReInvite()` 직전에 수행해야 함.

#### Command 노드 설계

```typescript
{
  command: "Hold",
  sipInstanceId: "instance-1",
  timeout: 10000,
}
```

**복잡도: 중간**
- `DialogClientSession` vs `DialogServerSession` 타입 분기 필요 (현재 `SessionStore`는 `DialogSession` 인터페이스로 저장)
- `SessionStore`에서 concrete type assertion 필요
- SDP Mode 조작 후 ReInvite 순서 정확히 지켜야 함

---

### Retrieve (보류 해제)

**분류: 테이블 스테이크** — Hold와 쌍으로 구현

#### SIP 프로토콜 흐름

```
Holding UA (A)           Held UA (B)
       |                      |
       |--- Re-INVITE -------->|
       |    a=sendrecv         |
       |<-- 200 OK ------------|
       |    a=sendrecv         |
       |--- ACK -------------->|
       |                      |
       | [통화 재개]
```

#### diago 구현 방법

```go
// 1. Mode를 sendrecv로 복원
dialog.Media().MediaSession().Mode = sdp.ModeSendrecv

// 2. Re-INVITE 전송
err := dialog.(*diago.DialogClientSession).ReInvite(ctx)

// 3. RTP 쓰기 재개 (Hold에서 StopRTP 사용했다면)
dialog.Media().StartRTP(2)
```

**복잡도: 낮음** — Hold와 동일한 패턴, Mode만 `sendrecv`로 변경

---

### HoldEvent (Re-INVITE 수신 이벤트)

**분류: 테이블 스테이크** — 프론트엔드에 `HELD` / `RETRIEVED` 이벤트 타입 이미 존재

#### 동작

Held UA (B)로 동작하는 인스턴스가 Re-INVITE(sendonly)를 수신하는 시나리오 대기:

```
[SIP Instance B] → [INCOMING] → [Answer] → [HELD Event]
                                                ↓
                                       Re-INVITE(sendonly) 수신 후 다음 노드
```

#### diago 지원

`AnswerOptions.OnMediaUpdate` 콜백으로 Re-INVITE 수신 감지:

```go
serverSession.AnswerOptions(diago.AnswerOptions{
    OnMediaUpdate: func(d *diago.DialogMedia) {
        mode := d.MediaSession().Mode
        if mode == sdp.ModeSendonly { // 상대방이 sendonly → 내가 recvonly → Hold됨
            // HELD 이벤트 발행
        } else if mode == sdp.ModeSendrecv {
            // RETRIEVED 이벤트 발행
        }
    },
})
```

**이벤트 노드 속성:**
```typescript
{
  event: "HELD",       // 또는 "RETRIEVED"
  sipInstanceId: "instance-1",
  timeout: 30000,
}
```

**복잡도: 중간** — `OnMediaUpdate` 콜백 등록 + goroutine channel 통신으로 Event 노드 블로킹

---

## UI 개선

### 노드 팔레트 개선

#### 테이블 스테이크: 검색 기능

**문제:** v1.2에서 Command 노드가 5개 → 9개로 증가, Event 노드도 9개 유지. 총 18-19개 팔레트 항목은 스크롤 없이 표시 불가.

**해결:** 팔레트 상단 검색 입력 추가

```
[ Search nodes... ] (input)
---
SIP Instance
  [ SIP Instance ]
Commands (5/9개)
  [ MakeCall    ]
  ...
Events (3/9개)
  [ INCOMING    ]
```

**동작:**
- 실시간 필터링 (onChange)
- 대소문자 무시 (`toLowerCase().includes()`)
- 검색 결과가 있으면 Section 자동 펼침, 없으면 Empty state ("No nodes found")
- 검색 중에는 Section 헤더 미표시 (결과만 flat 목록)

**구현:** `useState<string>("")` + `PaletteItem` 목록 filter

**복잡도: 낮음**

#### 테이블 스테이크: 노드 수 배지

각 Section 헤더에 포함된 노드 수 표시:

```
Commands (9)  ▼
```

**복잡도: 낮음** — Section 컴포넌트에 `count` prop 추가

#### 차별화: 검색 하이라이팅

검색 쿼리와 매칭되는 텍스트 부분 강조:

```
검색: "transfer"
결과: [BlindTrans[fer]] [AttendedTrans[fer]] [TRANS[fer]RED]
```

**복잡도: 중간** — 텍스트 split + span 렌더링

#### 차별화: 최근 사용 노드 (v1.2 이후)

드래그한 노드를 localStorage에 기록, 팔레트 상단에 "Recently Used" 섹션 표시.

**이 마일스톤에서는 제외 — 구현 복잡도 대비 가치 낮음**

---

### 실행 모니터 개선

#### 테이블 스테이크: 로그 Copy 버튼

현재 로그는 선택/복사가 불편함. 전체 로그를 클립보드로 복사하는 버튼:

```
[INFO] [WARN] [ERROR]           [14/22 entries] [Copy All]
```

**복잡도: 낮음** — `navigator.clipboard.writeText()`

#### 테이블 스테이크: 로그 Clear 버튼

실행 종료 후 로그 수동 클리어:

```
[Clear]  버튼 → executionStore.clearLogs() action
```

**복잡도: 낮음** — store action 추가

#### 테이블 스테이크: SIP 래더 다이어그램 개선 — from/to 정확화

현재 `execution-timeline.tsx`에서 sent/received 방향에 따라 `(fromIndex + 1) % lanes.length`로 대상 lane을 추정 — 이 로직은 3개 이상 인스턴스에서 정확하지 않음.

**개선:** `emitActionLog`의 `sipMessage`에 `fromInstanceId`, `toInstanceId` 필드 추가:

```typescript
// 현재 SIPMessage 구조
{
  direction: "sent" | "received",
  method: "INVITE" | "REFER" | ...,
  responseCode?: number,
}

// 개선 후
{
  direction: "sent" | "received",
  method: string,
  responseCode?: number,
  fromUser?: string,   // 발신자 DN/user
  toUser?: string,     // 수신자 DN/user
}
```

REFER, Re-INVITE 등 새 메시지를 SIP 래더에 표시하려면 fromUser/toUser가 있어야 화살표 방향이 정확함.

**복잡도: 중간** — 백엔드 events.go + 프론트엔드 types 수정

#### 테이블 스테이크: 새 SIP 메시지 타입 래더 지원

Transfer/Hold 구현 시 다음 메시지가 새로 추가됨:
- `REFER` (Blind Transfer 전송)
- `Re-INVITE` (Hold/Retrieve)
- `NOTIFY` (Transfer 진행 상태)

SIP 래더에서 이 메시지들이 올바른 방향/색상으로 표시되어야 함.

**색상 규칙 제안:**
- REFER → 보라색 (`#a855f7`)
- Re-INVITE → 노란색 (`#f59e0b`)
- NOTIFY → 회색 (`#6b7280`)

**복잡도: 낮음** — `execution-timeline.tsx` 색상 조건 확장

#### 차별화: 로그 검색 필터

로그 패널에 텍스트 검색 입력 추가. 키워드로 로그 필터링:

**복잡도: 낮음** — 현재 level filter 옆에 text input 추가

#### 차별화: 실행 타이밍 표시

각 노드의 실행 시작/완료 시간을 로그에 표시하여 성능 프로파일링 지원:

```
[10:30:01.234] [A] MakeCall started
[10:30:01.567] [A] MakeCall completed (333ms)
```

**복잡도: 낮음** — Executor에서 시작 시간 기록 후 완료 시 elapsed 계산

---

### 전반적 UI 폴리시

#### 테이블 스테이크: 노드 아이콘 일관성

v1.2에서 추가되는 노드 아이콘 선택 (Lucide Icons):

| 노드 | 아이콘 | 이유 |
|------|--------|------|
| Hold | `PauseCircle` | 보류 = 일시정지 |
| Retrieve | `PlayCircle` | 재개 = 재생 |
| BlindTransfer | `ArrowRightLeft` 또는 `Forward` | 전환 방향 |
| AttendedTransfer | `PhoneForwarded` | 전화 전달 |
| HELD Event | `PauseCircle` (amber) | Hold 상태 |
| RETRIEVED Event | `PlayCircle` (amber) | Retrieve 상태 |

**주의:** 현재 `RETRIEVED` Event 노드가 `Play` 아이콘을 사용 중이라 `Retrieve` Command와 충돌 가능 → `PlayCircle`로 통일하거나 Command는 `CirclePlay` 사용.

**복잡도: 낮음**

#### 테이블 스테이크: Properties Panel Hold/Transfer 전용 UI

Hold Command:
- 별도 파라미터 없음 (sipInstanceId만)
- 현재 상태 표시: "Hold this instance's active call"

BlindTransfer Command:
- `targetUri` 필드 (필수, sip: 접두사 검증)
- 현재 MakeCall의 targetUri 컴포넌트 재사용

AttendedTransfer Command:
- `consultationCallId` 드롭다운 (현재 시나리오의 다른 SIP Instance 목록)
- 복잡한 UX — v1.2 범위 내에서는 텍스트 입력으로 단순화

**복잡도: 낮음~중간**

#### 차별화: 캔버스 미니맵 토글

XYFlow의 `<MiniMap>` 컴포넌트를 조건부 표시. 노드가 많아질수록 유용.

**복잡도: 낮음** — `<MiniMap>` prop 추가 + 토글 버튼

---

## 안티 기능 (의도적 제외)

| 안티 기능 | 피하는 이유 | 대신 할 것 |
|-----------|-------------|------------|
| **3자 통화 (Conference)** | B2BUA 미디어 믹싱 필요, 완전히 다른 아키텍처 | v1.2 범위 외, v2.0 고려 |
| **Music on Hold (MoH) 자동 재생** | Hold 시 자동 WAV 재생은 별도 PlayAudio + Hold 조합으로 표현 가능 | Hold Command + PlayAudio 조합 노드 |
| **SIP Park / Pickup** | 특수 PBX 기능, 표준 SIPFLOW 시나리오 범위 외 | 지원 안 함 |
| **a=inactive Hold 모드** | `sendonly`가 표준, `inactive`는 엣지 케이스 | sendonly만 지원 |
| **NOTIFY Event 노드 완전 구현** | BlindTransfer 내부 로그로 충분, 별도 노드는 복잡도 추가 | Transfer Command 내 로그 발행 |
| **AttendedTransfer v1.2 우선구현** | SessionStore 구조 변경 + Replaces 헤더 수동 구성 필요, 높은 복잡도 | v1.2에서 BlindTransfer 우선, Attended는 v1.3 |
| **팔레트 AI 노드 추천** | SIPFLOW 규모에 불필요한 복잡도 | 검색 + 그룹화로 충분 |
| **팔레트 드래그 재정렬** | 사용자가 팔레트 순서를 바꿀 필요 없음 (고정 그룹화로 충분) | 고정 그룹 순서 유지 |
| **로그 실시간 Export (파일 저장)** | Wails의 파일 저장 다이얼로그 추가 필요, v1.2 범위 외 | 클립보드 복사로 충분 |

---

## 기능 의존성

```
[SIP Instance]
       ↓
[MakeCall 또는 INCOMING+Answer]
       ↓
   [활성 Dialog]
       ├──→ [Hold] ──→ [Retrieve]
       ├──→ [BlindTransfer] ──→ [NOTIFY 자동처리(내부)]
       └──→ [AttendedTransfer] (두 번째 Dialog 필요)
                    ↓
            [다른 Dialog (상담 통화)]
```

**SessionStore 확장 필요성:**

현재: `instanceID → 단일 DialogSession`

Attended Transfer를 위해서는: `instanceID → []DialogSession` (복수 dialog 지원)

이 변경은 Hold/BlindTransfer에 영향 없음 (단일 dialog 사용). AttendedTransfer가 v1.2 범위에 포함된다면 SessionStore 리팩토링이 필요하다.

**판단: v1.2는 BlindTransfer + Hold/Retrieve에 집중. AttendedTransfer는 SessionStore 리팩토링 후 v1.3에서 구현.**

---

## MVP (v1.2) 우선순위

### Phase 1 — 백엔드 Transfer/Hold 구현

1. **Hold Command** — `Mode=sendonly` + `ReInvite()` (복잡도: 중간)
2. **Retrieve Command** — `Mode=sendrecv` + `ReInvite()` (복잡도: 낮음)
3. **BlindTransfer Command** — `Refer()` 메서드 직접 사용 (복잡도: 낮음)
4. **HELD/RETRIEVED Event** — `OnMediaUpdate` 콜백 (복잡도: 중간)
5. **TRANSFERRED Event** — `OnRefer` 콜백 (복잡도: 중간)

### Phase 2 — 노드 팔레트 + UI 개선

6. **팔레트 검색 기능** (복잡도: 낮음)
7. **새 노드 등록** (Hold, Retrieve, BlindTransfer) (복잡도: 낮음)
8. **SIP 래더 다이어그램 개선** (REFER/Re-INVITE 표시) (복잡도: 중간)
9. **로그 Copy/Clear 버튼** (복잡도: 낮음)
10. **Properties Panel UI** (새 Command 설정) (복잡도: 낮음~중간)

### v1.2 이후로 연기

- **AttendedTransfer Command** — SessionStore 리팩토링 필요, v1.3
- **NOTIFY Event 노드** — BlindTransfer 내부 로그로 v1.2 대체
- **팔레트 검색 하이라이팅** — v1.3 폴리시
- **로그 파일 Export** — v1.3

---

## 신뢰도 평가

| 영역 | 신뢰도 | 근거 |
|------|--------|------|
| Blind Transfer 프로토콜 흐름 | **HIGH** | RFC 3515 + RFC 5589 공식 문서 + diago 소스 직접 확인 |
| diago `Refer()` API | **HIGH** | `dialog_client_session.go:553`, `dialog_server_session.go:349` 직접 확인 |
| Hold SDP 방향 속성 | **HIGH** | RFC 3264 + RFC 6337 공식 문서 확인 |
| diago `ReInvite()` + Mode 변경 | **HIGH** | `dialog_client_session.go:426`, `dialog_server_session.go:321`, `media_session.go:101` 직접 확인 |
| Attended Transfer 구현 | **MEDIUM** | RFC 3891 문서 확인, diago Replaces 미지원(주석) 확인, 수동 구현 방법은 검증 안 됨 |
| OnMediaUpdate Hold 감지 | **MEDIUM** | `dialog_server_session.go:148-165` AnswerOptions 확인, Mode 변경 감지 패턴은 검증 필요 |
| 팔레트 검색 UX | **HIGH** | 기존 XYFlow 기반 코드 구조 직접 확인, 표준 React 패턴 |
| SIP 래더 REFER/Re-INVITE | **HIGH** | 기존 `execution-timeline.tsx` 코드 직접 확인, 확장 경로 명확 |

---

## Sources

### SIP Transfer
- [RFC 3515 — The SIP REFER Method](https://datatracker.ietf.org/doc/html/rfc3515)
- [RFC 5589 — SIP Call Control Transfer](https://datatracker.ietf.org/doc/html/rfc5589)
- [RFC 3891 — The SIP Replaces Header](https://www.rfc-editor.org/rfc/rfc3891)
- [RFC 3892 — Referred-By Header](https://datatracker.ietf.org/doc/html/rfc3892)

### SIP Hold
- [RFC 3264 — Offer/Answer Model](https://www.ietf.org/rfc/rfc3264.txt)
- [RFC 6337 — SIP Usage of Offer/Answer](https://www.rfc-editor.org/rfc/rfc6337.html)
- [SIP Hold with RFC 6337 — Nick vs Networking](https://nickvsnetworking.com/sip-hold-with-rfc6337/)

### diago 라이브러리 (직접 확인)
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/dialog_session.go` — `dialogRefer()`, `dialogHandleReferNotify()`
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/dialog_client_session.go` — `Refer()`, `ReInvite()`
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/dialog_server_session.go` — `Refer()`, `ReInvite()`, `AnswerOptions`
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/dialog_media.go` — `StopRTP()`, `StartRTP()`
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/media/sdp/utils.go` — `ModeSendonly`, `ModeSendrecv`, `ModeRecvonly`
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.26.2/diago.go` — Replaces 주석 확인 (`:397`)

### UI/UX 참조
- [Node-RED Palette Management](https://nodered.org/docs/user-guide/editor/palette/)
- [FlowFuse Enhanced Palette Integration](https://flowfuse.com/changelog/2026/01/ff-expert-manage-palette/)
- [xyflow awesome-node-based-uis](https://github.com/xyflow/awesome-node-based-uis)
- [SIP Call Hold and Transfer (sipsorcery)](https://sipsorcery-org.github.io/sipsorcery/articles/callholdtransfer.html)
