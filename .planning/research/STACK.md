# Stack Research: Transfer/Hold + UI 개선 (v1.2)

**프로젝트:** SIPFLOW v1.2
**도메인:** SIP Transfer (Blind/Attended), Hold/Retrieve, UI 개선
**리서치일:** 2026-02-19
**전체 신뢰도:** HIGH (diago v0.27.0 소스코드 직접 확인)

---

## Executive Summary

diago v0.27.0은 **BlindTransfer(Refer), AttendedTransfer(ReferOptions + OnRefer), Hold/Retrieve(ReInvite + Mode 변경)를 이미 완전 구현**하고 있다. 새로운 라이브러리 추가는 불필요하다. 단, Hold 기능에는 **미수정 버그(#110, #125)가 존재**하며 로컬 패치 없이는 Hold SDP가 올바르게 처리되지 않는다. REFER 수신은 `AnswerOptions.OnRefer` 콜백으로, Re-INVITE 수신은 `AnswerOptions.OnMediaUpdate` 콜백으로 각각 감지한다. UI 개선에는 기존 shadcn/ui로 충분하며 새 라이브러리는 필요 없다.

---

## diago Transfer API

### BlindTransfer

**목적:** A가 B에게 C로 전달 — A가 REFER를 B에게 전송하고 B가 C에게 직접 INVITE. A는 BYE로 통화 종료.

**API (DialogClientSession — MakeCall 후 획득한 dialog):**

```go
// 시그니처 (dialog_client_session.go:562)
func (d *DialogClientSession) Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error

// 내부적으로 ReferOptions를 호출:
func (d *DialogClientSession) ReferOptions(ctx context.Context, referTo sip.Uri, opts ReferClientOptions) error

type ReferClientOptions struct {
    Headers  []sip.Header
    OnNotify func(statusCode int)  // NOTIFY 수신 콜백
}
```

**API (DialogServerSession — Answer 후 획득한 dialog):**

```go
// 시그니처 (dialog_server_session.go:481)
func (d *DialogServerSession) Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error

func (d *DialogServerSession) ReferOptions(ctx context.Context, referTo sip.Uri, opts ReferServerOptions) error

type ReferServerOptions struct {
    Headers  []sip.Header
    OnNotify func(statusCode int)  // NOTIFY 수신 콜백
}
```

**사용 예시 (executor.go에 추가할 executeBlindTransfer):**

```go
func (ex *Executor) executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for BlindTransfer")
    }

    var referTo sip.Uri
    if err := sip.ParseUri(node.TargetURI, &referTo); err != nil {
        return fmt.Errorf("invalid refer-to URI: %w", err)
    }

    // NOTIFY 상태 추적 (선택적)
    var notifyStatus int
    opts := diago.ReferClientOptions{
        OnNotify: func(statusCode int) {
            notifyStatus = statusCode
            ex.engine.emitActionLog(node.ID, instanceID,
                fmt.Sprintf("Transfer NOTIFY: %d", statusCode), "info")
        },
    }

    // DialogClientSession 타입 단언 필요
    clientDialog, ok := dialog.(*diago.DialogClientSession)
    if !ok {
        // DialogServerSession의 경우
        serverDialog, ok := dialog.(*diago.DialogServerSession)
        if !ok {
            return fmt.Errorf("dialog type assertion failed")
        }
        return serverDialog.ReferOptions(ctx, referTo, diago.ReferServerOptions{
            OnNotify: opts.OnNotify,
        })
    }

    if err := clientDialog.ReferOptions(ctx, referTo, opts); err != nil {
        return fmt.Errorf("BlindTransfer REFER failed: %w", err)
    }

    // RFC 3515: Refer 후 BYE로 통화 종료 (호출자 책임)
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer sent to %s (NOTIFY: %d)", node.TargetURI, notifyStatus), "info")
    return nil
}
```

**SIP 프로토콜 흐름 (BlindTransfer):**
```
A ──REFER (Refer-To: C)──> B
A <──202 Accepted────────── B
A <──NOTIFY (100 Trying)─── B    (B가 C에게 INVITE 시도 중)
A <──NOTIFY (200 OK)──────── B    (C가 응답 완료)
A ──BYE──────────────────> B    (통화 종료)
```

**주의사항:**
- `Refer()`는 응답이 202 Accepted가 아니면 `sipgo.ErrDialogResponse` 반환
- NOTIFY 콜백은 async — 별도 goroutine에서 호출됨
- REFER 전송 후 BYE는 **호출자가 직접 수행** (diago가 자동으로 BYE 보내지 않음)
- `OnNotify` 없이 `Refer()` 호출 시에도 정상 동작 (NOTIFY 무시)

**신뢰도:** HIGH — dialog_session.go:31, dialog_client_session.go:562-583, dialog_server_session.go:481-502 직접 확인

---

### AttendedTransfer

**목적:** A가 B와 통화 중, C에게 먼저 전화(새 dialog)를 걸어 확인 후 B를 C에게 연결. A가 두 개의 dialog를 동시에 관리.

**핵심 개념:** diago는 Attended Transfer를 위한 별도 API를 제공하지 않는다. 대신 두 가지 메커니즘으로 구현한다:

**방법 1: REFER with Replaces 헤더 (표준 Attended Transfer)**

```go
// 1. A가 C에게 별도 INVITE (새 dialog)
dialogC, err := instance.UA.Invite(ctx, recipientC, diago.InviteOptions{})

// 2. C의 dialog 정보로 Replaces 헤더 생성
// Replaces: <C의 Call-ID>;to-tag=<C의 to-tag>;from-tag=<C의 from-tag>
replacesValue := fmt.Sprintf("%s;to-tag=%s;from-tag=%s",
    dialogC.DialogSIP().InviteRequest.CallID().Value(),
    dialogC.DialogSIP().InviteRequest.To().Params.Get("tag"),
    dialogC.DialogSIP().InviteRequest.From().Params.Get("tag"),
)
replacesHeader := sip.NewHeader("Replaces", replacesValue)

// 3. B에게 REFER 전송 (Refer-To에 C의 Contact + Replaces 포함)
referToURI := dialogC.RemoteContact().Address  // C의 Contact URI
err = dialogB.ReferOptions(ctx, referToURI, diago.ReferClientOptions{
    Headers: []sip.Header{replacesHeader},
    OnNotify: func(statusCode int) {
        // Transfer 상태 추적
    },
})
```

**방법 2: OnRefer 콜백 (수신측 처리)**

```go
// B가 incoming REFER를 처리하는 방법 (B 입장)
// Answer 시 OnRefer 콜백 등록
session.AnswerOptions(diago.AnswerOptions{
    OnRefer: func(referDialog *diago.DialogClientSession) error {
        // referDialog는 이미 생성된 client dialog
        // INVITE를 직접 수행
        if err := referDialog.Invite(referDialog.Context(), diago.InviteClientOptions{}); err != nil {
            return err
        }
        if err := referDialog.Ack(ctx); err != nil {
            return err
        }
        return referDialog.Hangup(referDialog.Context())
    },
})
```

**다중 Dialog 관리 (SessionStore 확장 필요):**

```go
// 현재 SessionStore는 instanceID당 1개 dialog만 저장
// Attended Transfer를 위해 "secondary dialog" 지원이 필요

type SessionStore struct {
    mu              sync.RWMutex
    dialogs         map[string]diago.DialogSession           // instanceID -> primary dialog
    secondaryDialogs map[string]diago.DialogSession          // instanceID -> secondary (attended 전화용)
    serverSessions  map[string]*diago.DialogServerSession
}
```

**OnReferDialogFunc 타입 (dialog_server_session.go:21):**

```go
type OnReferDialogFunc func(referDialog *DialogClientSession) error
```

**신뢰도:** HIGH — dialog_server_session.go:150-277 (dialogHandleRefer/dialogReferInvite 내부 로직), 테스트 파일 TestIntegrationDialogClientRefer, TestIntegrationDialogServerRefer 직접 확인

---

### Transfer NOTIFY 추적

**SIP NOTIFY 흐름:**

NOTIFY는 SIP REFER 완료 상태를 Transferor(전달자)에게 알리는 메커니즘.

```
흐름:
Transferee(B) ──NOTIFY (sipfrag: SIP/2.0 100 Trying)──> Transferor(A)
Transferee(B) ──NOTIFY (sipfrag: SIP/2.0 200 OK)──────> Transferor(A)
```

**diago NOTIFY 지원:**

diago는 NOTIFY를 자동으로 처리한다. `Diago.NewDiago()` 내부에서 `server.OnNotify()`로 핸들러가 이미 등록됨 (diago.go:426).

수신측: `OnNotify` 콜백이 파싱된 상태 코드를 전달

```go
// NOTIFY body: "message/sipfrag;version=2.0"
// body 예시: "SIP/2.0 200 OK"

// dialog_session.go:68-108
func dialogHandleReferNotify(d DialogSession, req *sip.Request, tx sip.ServerTransaction) {
    // content-type 검증: "message/sipfrag;version=2.0"
    // body에서 상태코드 파싱 (3자리 숫자)
    // onReferNotify 콜백 호출
}
```

**주의사항:**
- NOTIFY body는 `message/sipfrag;version=2.0` Content-Type
- body는 `"SIP/2.0 100 Trying"` 또는 `"SIP/2.0 200 OK"` 형식
- 현재 diago 구현은 content-type 체크 시 `"message/sipfrag;version=2.0"` 정확 매칭 필요
- 상태코드 100 → Transferee가 Referee에게 INVITE 시도 중
- 상태코드 200 → Transfer 완료 (C가 응답함)
- `OnNotify` 미설정 시 NOTIFY는 수신되지만 무시됨

**신뢰도:** HIGH — dialog_session.go:68-108, diago.go:426-438 직접 확인

---

## diago Hold/Retrieve API

### Hold (Re-INVITE)

**목적:** 통화를 일시 중단. SDP의 direction을 `sendonly`로 변경하여 Re-INVITE 전송.

**현재 API:**

diago v0.27.0에는 `Hold()` 전용 API가 없다. `ReInvite()`가 유일한 Re-INVITE 전송 수단이다.

```go
// DialogClientSession.ReInvite() — dialog_client_session.go:433
func (d *DialogClientSession) ReInvite(ctx context.Context) error

// DialogServerSession.ReInvite() — dialog_server_session.go:332
func (d *DialogServerSession) ReInvite(ctx context.Context) error
```

**동작 원리:**
- `ReInvite()`는 현재 `d.mediaSession.LocalSDP()`를 그대로 전송
- Hold를 위해서는 SDP를 전송 **전에** `MediaSession.Mode`를 변경해야 함

**Hold 구현 방법 (버그 패치 적용 전제):**

```go
func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for Hold")
    }

    clientDialog, ok := dialog.(*diago.DialogClientSession)
    if !ok {
        return fmt.Errorf("Hold only supported on client dialogs currently")
    }

    // 핵심: MediaSession.Mode를 sendonly로 변경
    // MediaSession() 메서드로 직접 접근
    ms := clientDialog.Media().MediaSession()
    ms.Mode = sdp.ModeSendonly  // "sendonly" — 원격 측은 recvonly로 응답해야 함

    // 변경된 SDP로 Re-INVITE 전송
    if err := clientDialog.ReInvite(ctx); err != nil {
        // Hold 실패 시 Mode 복원
        ms.Mode = sdp.ModeSendrecv
        return fmt.Errorf("Hold ReInvite failed: %w", err)
    }

    ex.engine.emitActionLog(node.ID, instanceID, "Hold succeeded", "info")
    return nil
}
```

**SDP Hold 프로토콜 (RFC 3264):**

```
Holder(A) ──INVITE (a=sendonly)──> Holdee(B)
Holder(A) <──200 OK (a=recvonly)── Holdee(B)   ← 버그 #125: 현재 잘못 sendrecv 반환
Holder(A) ──ACK──────────────────> Holdee(B)
```

**sdp.Mode 상수 (media/sdp/utils.go:27-32):**

```go
const (
    ModeRecvonly string = "recvonly"
    ModeSendrecv string = "sendrecv"
    ModeSendonly string = "sendonly"
    // "inactive" 상수는 없음 — 직접 문자열 사용
)
```

**주의:** `MediaSession()` 메서드는 `*media.MediaSession`을 반환하며, Mode 필드는 exported이지만 mutex 보호 없이 직접 변경 시 race condition 가능. `ReInvite()` 호출 전 변경 필요.

**신뢰도:** HIGH — dialog_client_session.go:433-456, dialog_server_session.go:332-357, media/media_session.go:90-144 직접 확인

---

### Retrieve (Re-INVITE)

**목적:** Hold 상태 해제. SDP direction을 `sendrecv`로 복원하여 Re-INVITE 전송.

```go
func (ex *Executor) executeRetrieve(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("no active dialog for Retrieve")
    }

    clientDialog, ok := dialog.(*diago.DialogClientSession)
    if !ok {
        return fmt.Errorf("Retrieve only supported on client dialogs currently")
    }

    // Mode를 sendrecv로 복원
    ms := clientDialog.Media().MediaSession()
    ms.Mode = sdp.ModeSendrecv

    if err := clientDialog.ReInvite(ctx); err != nil {
        return fmt.Errorf("Retrieve ReInvite failed: %w", err)
    }

    ex.engine.emitActionLog(node.ID, instanceID, "Retrieve (unhold) succeeded", "info")
    return nil
}
```

**신뢰도:** HIGH — ReInvite 소스 직접 확인

---

### Known Issues — Hold/Unhold

#### Issue #110: 빈 SDP(nil body) 처리 오류

**상태:** OPEN (diago-stable-release 마일스톤에 포함, 아직 미수정)

**증상:** Hold Re-INVITE 수신 시 body가 nil인 경우 `sdpUpdateUnsafe()`에서 panic 또는 오류 발생

**근본 원인:**

```go
// dialog_media.go:222 — 버그 위치
func (d *DialogMedia) sdpReInviteUnsafe(sdp []byte) error {
    if d.mediaSession == nil {
        return fmt.Errorf("no media session present")
    }
    if err := d.sdpUpdateUnsafe(sdp); err != nil { // sdp가 nil이면 문제
        return err
    }
    // ...
}

// 그리고 handleMediaUpdate:207
func (d *DialogMedia) handleMediaUpdate(req *sip.Request, tx sip.ServerTransaction, contactHDR sip.Header) error {
    // ...
    if req.Body() != nil {          // ← 이 nil 체크는 있음
        if err := d.sdpReInviteUnsafe(req.Body()); err != nil {
            // ...
        }
    }
    // ...
}
```

실제로 `handleMediaUpdate`에 nil 체크가 이미 있다. 그러나 `sdpUpdateUnsafe` 내부에서 nil SDP 파싱 시 에러가 발생한다.

**PR #126 워크어라운드 (LOCAL PATCH 필요):**

```go
// 워크어라운드 1: sdpUpdateUnsafe에 nil 체크 추가
func (d *DialogMedia) sdpUpdateUnsafe(sdp []byte) error {
    if sdp == nil {
        return nil  // nil SDP = keep-alive, 무시
    }
    // ... 기존 코드
}
```

**적용 방법:** Go `replace` 디렉티브로 로컬 패치된 diago 사용:

```go
// go.mod
replace github.com/emiago/diago v0.27.0 => ./vendor/diago-patched
```

또는 `go.mod`의 `toolchain` 없이 소스 패치 후 `go mod vendor` 사용.

#### Issue #125: Hold Re-INVITE SDP direction 오류

**상태:** CLOSED (duplicate of #110), 수정 미완료

**증상 3가지:**
1. Hold 수신 시 응답 SDP가 `a=recvonly` 대신 `a=sendrecv` 반환 → Resume 후 미디어 방향 오작동
2. SDP 마지막 줄 trailing newline 없을 시 direction 속성 무시됨
3. 응답 SDP에 `c=IN IP6 ::` 또는 `c=IN IP4 0.0.0.0` 반환 → 원격 측 미디어 드롭

**PR #126이 제안하는 수정:**
- `handleMediaUpdate`에서 수신 SDP direction 파싱 후 반전(reverse) 로직 추가
- SDP 파서에 trailing newline 없는 경우 처리
- `handleMediaUpdate` 응답 시 ExternalIP 우선 사용

**로드맵 함의:**

Hold/Retrieve 기능은 **로컬 diago 패치 없이 구현 불가**. 두 가지 선택지:

1. **PR #126 패치 적용** — hold 수신(HoldEvent) 쪽에서 올바른 SDP direction 보장
2. **Hold 발신만 구현** — 자신이 Hold를 개시하는 경우만 (diago 버그 우회 가능)

SIPFLOW 시뮬레이터 특성상 **Hold 발신(ReInvite + sendonly)은 버그 영향 없음**. 상대방이 Hold를 보내오는 이벤트 감지(HoldEvent)는 버그 #125의 영향을 받는다.

**신뢰도:** HIGH — GitHub issue #110, #125, PR #126 직접 확인 (2026-02-19 기준 #110 OPEN, #125 CLOSED-duplicate)

---

## diago Event 수신 API

### REFER 수신 (TransferEvent)

**목적:** 원격 측이 SIPFLOW 인스턴스에게 REFER를 보내올 때 감지.

**diago 처리 방식:**

diago는 REFER를 `Diago.OnRefer()` 핸들러에서 자동으로 수신한다 (diago.go:411). 개발자는 dialog별로 `OnRefer` 콜백을 등록하는 방식으로 처리한다.

**DialogServerSession에서 등록 (AnswerOptions):**

```go
// dialog_server_session.go:150-167
type AnswerOptions struct {
    OnMediaUpdate func(d *DialogMedia)
    OnRefer       func(referDialog *DialogClientSession) error  // REFER 수신 콜백
    Codecs        []media.Codec
    RTPNAT        int
}

// 사용 예시
session.AnswerOptions(diago.AnswerOptions{
    OnRefer: func(referDialog *diago.DialogClientSession) error {
        // referDialog는 Refer-To URI로 생성된 새 client dialog
        // 여기서 새 INVITE를 직접 수행해야 함
        if err := referDialog.Invite(referDialog.Context(), diago.InviteClientOptions{}); err != nil {
            return err
        }
        if err := referDialog.Ack(ctx); err != nil {
            return err
        }
        return referDialog.Hangup(referDialog.Context())
    },
})
```

**DialogClientSession에서 등록 (InviteClientOptions):**

```go
// dialog_client_session.go:86-100
type InviteClientOptions struct {
    OnRefer OnReferDialogFunc  // REFER 수신 콜백
    // ...
}

// 사용 예시 (NewDialog 후 Invite 시)
err = dialog.Invite(ctx, diago.InviteClientOptions{
    OnRefer: func(referDialog *diago.DialogClientSession) error {
        // 동일한 처리
        return referDialog.Invite(referDialog.Context(), diago.InviteClientOptions{})
    },
})
```

**OnReferDialogFunc 타입:**

```go
// dialog_server_session.go:21
type OnReferDialogFunc func(referDialog *DialogClientSession) error
```

**SIPFLOW executor 통합 방법:**

현재 SIPFLOW의 Serve 핸들러는 incoming call을 `incomingCh` 채널로 전달한다. REFER 수신 이벤트를 지원하려면 **별도 채널**이 필요하다:

```go
// instance_manager.go 확장
type ManagedInstance struct {
    Config     SipInstanceConfig
    UA         *diago.Diago
    Port       int
    incomingCh chan *diago.DialogServerSession
    referCh    chan *diago.DialogClientSession  // 신규: REFER 수신용
    cancel     context.CancelFunc
}

// StartServing에서 AnswerOptions에 OnRefer 등록
_ = i.UA.Serve(c, func(inDialog *diago.DialogServerSession) {
    i.incomingCh <- inDialog
    // 내부에서 OnRefer 등록이 필요하므로 Answer 전에 설정
    // → executor의 INCOMING 이벤트 처리 시 AnswerOptions 사용 필요
})
```

**중요:** REFER 수신 감지는 `Answer()` 대신 `AnswerOptions()`를 사용해야 한다. 현재 executor의 `executeAnswer()`는 `serverSession.Answer()`를 직접 호출하므로, TransferEvent 지원을 위해 `AnswerOptions` 사용으로 변경이 필요하다.

**신뢰도:** HIGH — dialog_server_session.go:150-195, dialog_client_session.go:86-101, diago.go:411-424 직접 확인

---

### Re-INVITE 수신 (HoldEvent)

**목적:** 원격 측이 Hold Re-INVITE를 보내올 때 감지.

**diago 처리 방식:**

diago는 Re-INVITE를 `handleReInvite()`에서 자동으로 수신한다 (diago.go:254). `AnswerOptions.OnMediaUpdate` 콜백으로 감지한다.

```go
// dialog_server_session.go:150-167
type AnswerOptions struct {
    OnMediaUpdate func(d *DialogMedia)  // Re-INVITE 수신 시 호출
    OnRefer       func(referDialog *DialogClientSession) error
    // ...
}
```

**OnMediaUpdate 콜백에서 Hold 감지:**

```go
session.AnswerOptions(diago.AnswerOptions{
    OnMediaUpdate: func(dm *diago.DialogMedia) {
        ms := dm.MediaSession()
        // Hold는 원격 측이 sendonly로 보내고 우리가 recvonly로 응답한 상태
        // ms.Mode는 현재 협상된 local mode
        // 버그 #125로 인해 현재 항상 sendrecv가 반환됨 (패치 없이는 신뢰 불가)
        if ms.Mode == sdp.ModeRecvonly {
            // Hold 이벤트 감지
            ex.engine.emitHoldEvent(instanceID)
        } else if ms.Mode == sdp.ModeSendrecv {
            // Resume 이벤트 감지 (Hold 해제)
            ex.engine.emitResumeEvent(instanceID)
        }
    },
})
```

**버그 #125 영향:**

현재(패치 없음) 상황에서는 OnMediaUpdate가 호출되더라도 `ms.Mode`가 항상 `sendrecv`를 반환할 수 있다. Hold 감지에는 **PR #126 패치 적용이 필수**이다.

**대안 — SDP 직접 파싱:**

패치 없이 Hold를 감지하려면 SDP를 직접 파싱하여 direction 속성을 확인하는 방법을 사용할 수 있다:

```go
OnMediaUpdate: func(dm *diago.DialogMedia) {
    // dm.MediaSession().Mode가 신뢰 불가한 경우
    // 직접 SDP를 파싱하여 확인 — 그러나 원본 SDP 접근 API 없음
    // 이 경우 패치 적용이 더 현실적
},
```

**신뢰도:** HIGH (API 확인), MEDIUM (버그 영향 평가)

---

## UI 개선용 추가 라이브러리

**결론: 신규 라이브러리 불필요**

기존 스택(shadcn/ui + XYFlow + Zustand + Tailwind)으로 Transfer/Hold UI를 완전히 구현할 수 있다.

**필요한 UI 컴포넌트 (shadcn/ui 기존 컴포넌트 활용):**

| UI 요소 | 구현 방법 | 신규 라이브러리 |
|---------|-----------|----------------|
| BlindTransfer 노드 | 기존 command 노드 확장 | 불필요 |
| AttendedTransfer 노드 | 기존 command 노드 확장 | 불필요 |
| Hold/Retrieve 노드 | 기존 command 노드 확장 | 불필요 |
| TransferEvent 노드 | 기존 event 노드 확장 | 불필요 |
| HoldEvent 노드 | 기존 event 노드 확장 | 불필요 |
| Hold 상태 표시 | shadcn/ui Badge (이미 있음) | 불필요 |
| Transfer 상태 표시 | shadcn/ui Progress (이미 있음) | 불필요 |

**기존 XYFlow 노드 타입 확장 패턴:**

```typescript
// 기존 노드 타입에 새 커맨드 추가 (graph.go와 동기화)
const COMMAND_TYPES = [
  "MakeCall", "Answer", "Release", "PlayAudio", "SendDTMF",
  // 신규
  "BlindTransfer", "AttendedTransfer", "Hold", "Retrieve",
] as const;

const EVENT_TYPES = [
  "INCOMING", "DISCONNECTED", "RINGING", "TIMEOUT", "DTMFReceived",
  // 신규
  "TransferEvent", "HoldEvent",
] as const;
```

**신뢰도:** HIGH — 기존 프론트엔드 아키텍처 직접 확인

---

## Integration Points

### executor.go 통합 포인트

**1. executeCommand() 확장 (기존 switch문):**

```go
func (ex *Executor) executeCommand(ctx context.Context, instanceID string, node *GraphNode) error {
    switch node.Command {
    case "MakeCall":    return ex.executeMakeCall(ctx, instanceID, node)
    case "Answer":      return ex.executeAnswer(ctx, instanceID, node)
    case "Release":     return ex.executeRelease(ctx, instanceID, node)
    case "PlayAudio":   return ex.executePlayAudio(ctx, instanceID, node)
    case "SendDTMF":    return ex.executeSendDTMF(ctx, instanceID, node)
    // 신규 추가
    case "BlindTransfer":    return ex.executeBlindTransfer(ctx, instanceID, node)
    case "AttendedTransfer": return ex.executeAttendedTransfer(ctx, instanceID, node)
    case "Hold":             return ex.executeHold(ctx, instanceID, node)
    case "Retrieve":         return ex.executeRetrieve(ctx, instanceID, node)
    default:
        return fmt.Errorf("unknown command: %s", node.Command)
    }
}
```

**2. executeEvent() 확장:**

```go
func (ex *Executor) executeEvent(ctx context.Context, instanceID string, node *GraphNode) error {
    switch node.Event {
    case "INCOMING":       return ex.executeIncoming(...)
    case "DISCONNECTED":   return ex.executeDisconnected(...)
    case "RINGING":        return ex.executeRinging(...)
    case "TIMEOUT":        return ex.executeTimeout(...)
    case "DTMFReceived":   return ex.executeDTMFReceived(...)
    // 신규 추가
    case "TransferEvent":  return ex.executeTransferEvent(...)
    case "HoldEvent":      return ex.executeHoldEvent(...)
    default:
        return fmt.Errorf("event type %s is not supported", node.Event)
    }
}
```

**3. executeAnswer() 변경:**

TransferEvent/HoldEvent 지원을 위해 `serverSession.Answer()` → `serverSession.AnswerOptions()` 변경 필요:

```go
// 변경 전
if err := serverSession.Answer(); err != nil { ... }

// 변경 후
if err := serverSession.AnswerOptions(diago.AnswerOptions{
    OnRefer: func(referDialog *diago.DialogClientSession) error {
        // instance의 referCh로 전달
        instance.referCh <- referDialog
        return nil
    },
    OnMediaUpdate: func(dm *diago.DialogMedia) {
        // Hold 상태 변화 감지 → holdEventCh로 전달
        instance.holdEventCh <- dm.MediaSession().Mode
    },
}); err != nil { ... }
```

### instance_manager.go 통합 포인트

**ManagedInstance 확장:**

```go
type ManagedInstance struct {
    Config          SipInstanceConfig
    UA              *diago.Diago
    Port            int
    incomingCh      chan *diago.DialogServerSession  // 기존
    referCh         chan *diago.DialogClientSession  // 신규: incoming REFER
    holdEventCh     chan string                      // 신규: Hold 상태 변화 ("sendonly"/"sendrecv")
    cancel          context.CancelFunc
}
```

### graph.go 통합 포인트

**GraphNode 필드 추가:**

```go
type GraphNode struct {
    // ... 기존 필드 ...
    // BlindTransfer/AttendedTransfer용
    TargetURI     string  // 이미 있음 (재사용)
    // AttendedTransfer용 secondary dialog 식별자
    SecondaryInstanceID string  // 신규 (optional)
}
```

### SessionStore 통합 포인트

**Attended Transfer를 위한 secondary dialog 관리:**

```go
type SessionStore struct {
    mu               sync.RWMutex
    dialogs          map[string]diago.DialogSession         // 기존
    serverSessions   map[string]*diago.DialogServerSession  // 기존
    secondaryDialogs map[string]diago.DialogSession         // 신규: Attended Transfer용
}
```

---

## Sources

**소스코드 직접 확인 (HIGH 신뢰도):**

- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session.go` — `Refer()`, `ReferOptions()`, `ReferClientOptions`, `ReInvite()` 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go` — `Refer()`, `ReferOptions()`, `ReferServerOptions`, `AnswerOptions`, `ReInvite()` 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go` — `dialogRefer()`, `dialogHandleReferNotify()`, `dialogHandleRefer()` 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_media.go` — `handleMediaUpdate()`, `sdpUpdateUnsafe()`, `OnMediaUpdate` 콜백 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/diago.go` — `server.OnRefer()`, `server.OnNotify()`, `handleReInvite()` 등록 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/media_session.go` — `MediaSession.Mode`, `ReInvite` SDP 생성 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/sdp/utils.go` — `ModeSendonly`, `ModeRecvonly`, `ModeSendrecv` 상수 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session_test.go` — `TestIntegrationDialogClientRefer` 테스트 패턴 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session_test.go` — `TestIntegrationDialogServerRefer`, `TestIntegrationDialogServerReinvite` 확인

**GitHub Issues (MEDIUM 신뢰도 — 2026-02-19 확인):**

- [diago Issue #110](https://github.com/emiago/diago/issues/110) — Hold/Unhold 빈 SDP 이슈, OPEN (diago-stable-release 마일스톤)
- [diago Issue #125](https://github.com/emiago/diago/issues/125) — Hold SDP direction/IP 버그 3개, CLOSED (duplicate of #110)
- [diago PR #126](https://github.com/emiago/diago/pull/126) — #125 수정 PR, 리뷰 대기

**RFC 표준 (참고):**

- [RFC 3515](https://datatracker.ietf.org/doc/html/rfc3515) — SIP REFER 메서드
- [RFC 3892](https://datatracker.ietf.org/doc/html/rfc3892) — Referred-By 메커니즘 (Attended Transfer)
- [RFC 3264](https://datatracker.ietf.org/doc/html/rfc3264) — SDP Offer/Answer (Hold direction)
- [RFC 3261 §14](https://datatracker.ietf.org/doc/html/rfc3261#section-14) — Re-INVITE 처리

---

## 신뢰도 평가

| 영역 | 수준 | 근거 |
|------|------|------|
| BlindTransfer API | HIGH | `Refer()`, `ReferOptions()` 소스 직접 확인, 테스트 코드 존재 |
| AttendedTransfer API | HIGH | `OnRefer` 콜백, `dialogHandleRefer` 내부 로직 확인 |
| Transfer NOTIFY | HIGH | `dialogHandleReferNotify()` 직접 확인, `OnNotify` 콜백 확인 |
| Hold/Retrieve API | HIGH | `ReInvite()` 직접 확인, `MediaSession.Mode` 확인 |
| Hold 버그 상태 | HIGH | GitHub issues #110, #125 직접 확인 (2026-02-19) |
| PR #126 워크어라운드 | MEDIUM | PR 내용 확인, 미병합 상태 (적용 전 테스트 필요) |
| UI 개선 | HIGH | 기존 shadcn/ui 컴포넌트 패턴 확인 |

---

## 로드맵 함의

1. **Hold/Retrieve 구현 전 diago 로컬 패치 필수** — PR #126 또는 `sdpUpdateUnsafe` nil 체크 패치 적용
2. **BlindTransfer는 즉시 구현 가능** — 버그 없음, API 완전
3. **AttendedTransfer는 SessionStore 확장 필요** — secondary dialog 관리
4. **executeAnswer() 리팩토링 필요** — `Answer()` → `AnswerOptions()` (TransferEvent/HoldEvent 지원)
5. **UI 라이브러리 추가 불필요** — 기존 스택으로 완전 구현 가능
6. **ManagedInstance에 채널 추가 필요** — `referCh`, `holdEventCh`
