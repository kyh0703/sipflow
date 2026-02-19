# Phase 11: BlindTransfer + TransferEvent Backend - Research

**Researched:** 2026-02-19
**Domain:** diago v0.27.0 REFER / Blind Transfer / OnRefer 콜백 — Go SIP Transfer 구현
**Confidence:** HIGH (diago 소스 직접 확인)

---

## Summary

Phase 11의 구현 범위는 두 가지다: BlindTransfer Command (REFER 전송 + BYE)와 TransferEvent (상대방 REFER 수신 + Refer-To URI 추출 + SessionStore 교체). Phase 10에서 이미 `OnRefer` 스텁(executor.go:322-328), SIP 이벤트 버스(`emitSIPEvent`), `executeWaitSIPEvent()`, `reInviter` 인터페이스 패턴이 모두 구현 완료되어 있다.

`DialogServerSession.Refer(ctx, referTo, headers...)` API가 존재하며 즉시 사용 가능하다. 내부적으로 `dialogRefer()`가 REFER 메시지를 전송하고 202 Accepted를 확인한 후 반환한다. NOTIFY 대기는 없다. diago 소스 주석에 "It is expected that after calling this you are hanguping call to send BYE"가 명시되어 있다.

**BlindTransfer 핵심 패턴:** 타입 어서션으로 `referrer` 인터페이스를 로컬 정의, `sip.ParseUri()`로 URI 조합 검증, `Refer()` 호출 후 즉시 `Hangup()` 호출.

**TransferEvent 핵심 패턴:** `OnRefer` 콜백(executor.go:322-328)에서 Refer-To URI를 REFER 요청에서 추출, ActionLog에 기록, `emitSIPEvent(instanceID, "TRANSFERRED")` 발행, `sessions.StoreDialog(instanceID, referDialog)`로 SessionStore 교체. `executeWaitSIPEvent("TRANSFERRED")`는 Phase 10에서 이미 구현되어 있으나 `executeEvent()` 스위치에 `"TRANSFERRED"` 케이스만 추가하면 된다.

**주요 권장사항:** `OnRefer` 콜백 확장(Refer-To URI 추출 + SessionStore 교체) + `executeEvent()` 스위치에 `"TRANSFERRED"` 케이스 추가 + `executeBlindTransfer()` 신규 구현. 그래프 파싱에서 `targetUser`/`targetHost` 분리 필드 추출.

---

## Standard Stack

이 페이즈에서 새 라이브러리 추가는 없다. 기존 스택으로 모두 구현 가능하다.

### Core
| 라이브러리 | 버전 | 목적 | 표준인 이유 |
|-----------|------|------|------------|
| `github.com/emiago/diago` | v0.27.0 | SIP UA, REFER, AnswerOptions.OnRefer | 프로젝트 전체 SIP 스택 |
| `github.com/emiago/sipgo/sip` | v0.27.0 | sip.Uri 파싱 (ParseUri) | diago 내장 의존성 |
| Go standard library | 1.21+ | `context`, `fmt`, `strings` | 표준 라이브러리 |

### 확인된 API (소스 직접 검증)
| API | 파일 | 역할 |
|-----|------|------|
| `DialogServerSession.Refer(ctx, referTo sip.Uri, headers ...sip.Header) error` | `dialog_server_session.go:481` | 발신측 BlindTransfer: REFER 전송 |
| `DialogClientSession.Refer(ctx, referTo sip.Uri, headers ...sip.Header) error` | `dialog_client_session.go:562` | 수신측에서 발신한 경우 BlindTransfer |
| `dialogRefer()` (내부) | `dialog_session.go:31-66` | 실제 REFER 전송 + 202 Accepted 검증 |
| `AnswerOptions.OnRefer func(referDialog *DialogClientSession) error` | `dialog_server_session.go:160` | REFER 수신 콜백 (Phase 10 스텁 확장) |
| `dialogHandleRefer()` (내부) | `dialog_session.go:110-146` | REFER 수신 처리: Refer-To URI 파싱 + 202 응답 |
| `dialogReferInvite()` (내부) | `dialog_session.go:148-277` | REFER 수신 후 새 dialog(referDialog) 생성 |
| `sip.ParseUri(uri string, u *sip.Uri) error` | sipgo 라이브러리 | SIP URI 파싱 검증 |
| `sip.ParseAddressValue()` (내부) | diago `dialog_session.go:125` | Refer-To 헤더 파싱 (diago 내부 사용) |

**설치:** 기존 `go.mod`에 이미 포함됨. 추가 `go get` 불필요.

---

## Architecture Patterns

### 권장 수정 파일 구조
```
internal/engine/
├── executor.go     # 주요 수정: executeBlindTransfer() 신규,
│                   #   OnRefer 스텁 확장(Refer-To URI + SessionStore 교체),
│                   #   executeEvent() TRANSFERRED 케이스 추가
└── graph.go        # 수정: GraphNode targetUser/targetHost 필드 추가,
                    #   ParseScenario에서 BlindTransfer 필드 파싱
```

### 패턴 1: executeBlindTransfer 구현

**설명:** `DialogSession`을 로컬 `referrer` 인터페이스로 어서션하여 `Refer()` 메서드 접근. Phase 10의 `reInviter` 패턴과 동일. Refer 후 즉시 Hangup(BYE 전송).

**사용 시점:** BlindTransfer Command 노드 실행 시

```go
// executor.go
func (ex *Executor) executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    // targetUser/targetHost 검증
    if node.TargetUser == "" || node.TargetHost == "" {
        return fmt.Errorf("BlindTransfer: targetUser and targetHost are required")
    }

    // Dialog 조회
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("BlindTransfer: no active dialog for instance %s", instanceID)
    }

    // SIP URI 조합 및 파싱
    rawURI := fmt.Sprintf("sip:%s@%s", node.TargetUser, node.TargetHost)
    var referTo sip.Uri
    if err := sip.ParseUri(rawURI, &referTo); err != nil {
        return fmt.Errorf("BlindTransfer: invalid target URI %q: %w", rawURI, err)
    }

    // 로컬 referrer 인터페이스 어서션 (Phase 10 reInviter 패턴과 동일)
    type referrer interface {
        Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
    }
    r, ok := dialog.(referrer)
    if !ok {
        return fmt.Errorf("BlindTransfer: dialog type %T does not support Refer", dialog)
    }

    // ActionLog 발행
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer: sending REFER to %s", rawURI), "info")

    // REFER 전송 (내부적으로 202 Accepted 검증 후 반환)
    if err := r.Refer(ctx, referTo); err != nil {
        return fmt.Errorf("BlindTransfer: REFER failed: %w", err)
    }

    // 성공 로그 (ROADMAP 성공기준 2번)
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer succeeded (REFER to %s)", rawURI), "info",
        WithSIPMessage("sent", "REFER", 202, "", "", rawURI))

    // 202 Accepted 수신 후 즉시 BYE (CONTEXT.md 결정사항)
    hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    if err := dialog.Hangup(hangupCtx); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("BlindTransfer: BYE warning: %v", err), "warn")
    }

    ex.engine.emitActionLog(node.ID, instanceID, "BlindTransfer: BYE sent", "info",
        WithSIPMessage("sent", "BYE", 200, "", "", ""))
    return nil
}
```

### 패턴 2: OnRefer 콜백 확장 (Phase 10 스텁 → Phase 11 실제 구현)

**설명:** 현재 executor.go:322-328의 스텁을 확장. Refer-To URI 추출은 diago가 이미 파싱하여 `referDialog.Context()`의 연결된 target에 반영되어 있으나, 원본 REFER 요청 헤더에서 직접 추출해야 한다.

**중요 발견:** `dialogHandleRefer()`가 Refer-To 헤더를 파싱하여 `dialogReferInvite()`로 새 dialog를 생성한다. `OnRefer` 콜백이 받는 `referDialog *diago.DialogClientSession`은 이미 `INVITE`가 완성된 새 dialog가 아니라, **새 INVITE를 아직 전송하지 않은 초기 dialog**다. 콜백 내부에서 `referDialog.Invite()` + `referDialog.Ack()`를 호출해야 새 통화가 성립한다.

그러나 CONTEXT.md 결정사항에 따르면 Phase 11에서는 우리가 REFER를 받는 쪽(TransferEvent)을 구현하고, SessionStore를 새 dialog로 교체한다. 즉, 우리가 수신자(transferee)로서 상대방(transferor)이 보낸 REFER를 처리하는 것이다.

**diago 소스 분석 (dialog_session.go:148-277):**
- `dialogReferInvite()`가 `onReferDialog(referDialog)` 콜백 호출
- `referDialog`는 `dg.NewDialog(referToUri, ...)`로 생성된 초기 dialog — **INVITE 미전송 상태**
- 콜백에서 `referDialog.Invite()` + `referDialog.Ack()`를 호출해야 함
- 콜백이 반환하면 referDialog를 기존 dialog context에서 BYE로 종료

**결론:** CONTEXT.md에서 "SessionStore에서 기존 dialog를 referDialog로 교체"라고 했는데, `referDialog`는 INVITE를 아직 보내지 않은 초기 상태다. 우리 시나리오 그래프에서는 TransferEvent 이후 노드(PlayAudio, Hold 등)가 새 통화를 제어하기 위해, OnRefer 콜백 내에서 `referDialog.Invite()` + `referDialog.Ack()`까지 완료한 후 SessionStore를 교체해야 한다.

```go
// executor.go - executeAnswer()의 OnRefer 콜백 확장
OnRefer: func(referDialog *diago.DialogClientSession) error {
    // 1. REFER-To URI 추출 (referDialog의 InviteRequest에서)
    //    referDialog는 dialogReferInvite()가 생성한 새 ClientSession
    //    Refer-To URI는 referDialog의 목적지 URI (dg.NewDialog(referToUri,...))에 반영됨
    //    실제 URI 문자열은 referDialog의 remote target에서 추출
    referToURIStr := ""
    if referDialog.InviteRequest != nil {
        if toHdr := referDialog.InviteRequest.To(); toHdr != nil {
            referToURIStr = toHdr.Address.String()
        }
    }

    // 2. ActionLog에 Refer-To URI 기록 (ROADMAP 성공기준 4번)
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("REFER received: Refer-To=%s", referToURIStr), "info",
        WithSIPMessage("received", "REFER", 202, "", "", referToURIStr))

    // 3. 새 dialog (referDialog)로 INVITE 전송 및 ACK
    inviteCtx := referDialog.Context()
    if err := referDialog.Invite(inviteCtx, diago.InviteClientOptions{}); err != nil {
        return fmt.Errorf("TransferEvent: referDialog Invite failed: %w", err)
    }
    if err := referDialog.Ack(inviteCtx); err != nil {
        return fmt.Errorf("TransferEvent: referDialog Ack failed: %w", err)
    }

    // 4. SessionStore 교체 (기존 dialog → referDialog)
    ex.sessions.StoreDialog(instanceID, referDialog)

    // 5. TRANSFERRED 이벤트 발행 (TransferEvent 노드가 대기 중)
    ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")

    ex.engine.emitActionLog(node.ID, instanceID,
        "TransferEvent: session updated to new dialog", "info")
    return nil
},
```

### 패턴 3: executeEvent() TRANSFERRED 케이스 추가

**설명:** `executeWaitSIPEvent()`는 Phase 10에서 이미 구현 완료. `executeEvent()` 스위치에 `"TRANSFERRED"` 케이스만 추가하면 된다.

```go
// executor.go - executeEvent() 스위치 확장
case "HELD":
    return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "HELD", timeout)
case "RETRIEVED":
    return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "RETRIEVED", timeout)
case "TRANSFERRED":  // Phase 11 신규 추가
    return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "TRANSFERRED", timeout)
```

### 패턴 4: executeCommand() BlindTransfer 케이스 추가

```go
// executor.go - executeCommand() 스위치 확장
case "Hold":
    return ex.executeHold(ctx, instanceID, node)
case "Retrieve":
    return ex.executeRetrieve(ctx, instanceID, node)
case "BlindTransfer":  // Phase 11 신규 추가
    return ex.executeBlindTransfer(ctx, instanceID, node)
```

### 패턴 5: GraphNode 필드 추가 및 파싱

**설명:** CONTEXT.md 결정사항에 따라 `targetUser`/`targetHost` 분리 필드 사용. 기존 `TransferTarget string` 필드는 이미 `graph.go`에 존재하나, Phase 11에서는 별도 `TargetUser`/`TargetHost` 필드를 사용한다.

```go
// graph.go - GraphNode 구조체 확장
type GraphNode struct {
    ID             string
    Type           string
    InstanceID     string
    Command        string
    TargetURI      string
    FilePath       string
    Digits         string
    IntervalMs     float64
    Event          string
    ExpectedDigit  string
    Timeout        time.Duration
    TransferTarget string        // 레거시 (Phase 10 대비)
    TargetUser     string        // BlindTransfer 대상 user 부분 (Phase 11)
    TargetHost     string        // BlindTransfer 대상 host:port (Phase 11)
    SuccessNext    *GraphNode
    FailureNext    *GraphNode
    Data           map[string]interface{}
}

// ParseScenario() 내 command 노드 파싱에서 추가:
gnode.TargetUser = getStringField(node.Data, "targetUser", "")
gnode.TargetHost = getStringField(node.Data, "targetHost", "")
```

### 피해야 할 안티패턴

- **OnRefer 콜백에서 referDialog.Invite() 미호출:** referDialog는 INVITE 미전송 초기 상태. 콜백에서 Invite() + Ack()를 완료해야 세션이 성립한다.
- **SessionStore 교체 전 TRANSFERRED 이벤트 발행:** StoreDialog 완료 후 emitSIPEvent 호출 순서를 유지해야 후속 노드가 올바른 dialog를 사용한다.
- **sip.Uri 없이 문자열로 Refer 호출:** `Refer()` API는 `sip.Uri` 타입 요구. `sip.ParseUri()`로 반드시 파싱 후 전달.
- **BYE 없이 REFER만 전송:** diago 주석 대로 Refer() 후 반드시 Hangup() 호출.

---

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|-------------|----------|------|
| REFER 메시지 직접 빌드 | 수동 SIP 요청 생성 | `dialog.Refer(ctx, referTo)` | diago가 헤더/트랜잭션 처리 |
| Refer-To URI 파싱 | 정규식 파싱 | `sip.ParseUri()` | sipgo 표준 파서 |
| 202 Accepted 대기 | 수동 타임아웃 루프 | `dialogRefer()` 내부 처리 | diago가 응답 검증 |
| NOTIFY 결과 추적 | 별도 상태 머신 | v1.3으로 연기 | CONTEXT.md 결정사항 |
| new dialog 생성 | 직접 Invite 호출 | `dialogReferInvite()` + `OnRefer` 콜백 | diago 내부에서 새 dialog 생성 |

---

## Common Pitfalls

### 함정 1: OnRefer 콜백 내 referDialog 상태 이해

**발생하는 문제:** `OnRefer` 콜백이 받는 `referDialog *diago.DialogClientSession`을 이미 연결된 세션으로 오해하여 Invite() 없이 SessionStore에 저장하면, 후속 노드가 비활성 dialog를 사용하게 됨.

**발생 이유:** `dialogReferInvite()`에서 `dg.NewDialog(referToUri, NewDialogOptions{})` 후 `onReferDialog(referDialog)`를 호출한다. 이 시점의 `referDialog`는 `NewDialog()`로 생성된 초기 상태 — INVITE를 아직 전송하지 않았다.

```go
// dialog_session.go:227-276 - diago 소스
referDialog, err := dg.NewDialog(referToUri, NewDialogOptions{})
// ...
if err := onReferDialog(referDialog); err != nil {  // 콜백 호출 시점
    // referDialog는 INVITE 미전송
}
```

**피하는 방법:** OnRefer 콜백 내에서 반드시 `referDialog.Invite()` + `referDialog.Ack()` 완료 후 SessionStore에 저장.

```go
OnRefer: func(referDialog *diago.DialogClientSession) error {
    if err := referDialog.Invite(referDialog.Context(), diago.InviteClientOptions{}); err != nil {
        return err
    }
    if err := referDialog.Ack(referDialog.Context()); err != nil {
        return err
    }
    ex.sessions.StoreDialog(instanceID, referDialog) // Invite+Ack 완료 후 저장
    ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")
    return nil
},
```

**경고 신호:** TransferEvent 노드 이후의 PlayAudio/Hold 노드가 "no active dialog" 에러를 반환하는 경우.

**신뢰도:** HIGH — diago 소스 `dialog_session.go:148-277` 직접 확인.

---

### 함정 2: referDialog Invite 실패 시 OnRefer 콜백 에러 처리

**발생하는 문제:** OnRefer 콜백에서 에러를 반환하면 diago가 NOTIFY를 전송하고 referDialog를 종료한다. `emitSIPEvent("TRANSFERRED")`가 발행되지 않아 TransferEvent 노드가 타임아웃된다.

**발생 이유:** `dialogReferInvite()`에서:
```go
if err := onReferDialog(referDialog); err != nil {
    // 에러 처리 및 NOTIFY 전송
    return sendNotify(ctx, 400, "Bad Request", ...)
}
```

**피하는 방법:** Invite 실패 시 에러를 반환하기 전에 ActionLog에 기록. TransferEvent 노드는 타임아웃으로 FailureNext 경로 진행.

```go
OnRefer: func(referDialog *diago.DialogClientSession) error {
    if err := referDialog.Invite(...); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("TransferEvent: referDialog Invite failed: %v", err), "error")
        return err  // 에러 반환 → diago가 NOTIFY 처리 → TransferEvent 타임아웃
    }
    // ...
},
```

**경고 신호:** TransferEvent 노드가 타임아웃 후 FailureNext로 진행되는 경우 (Invite 실패 시 정상 동작).

**신뢰도:** HIGH — diago `dialog_session.go:253-272` 직접 확인.

---

### 함정 3: Refer() 호출 후 BYE 타이밍

**발생하는 문제:** `Refer()` 반환 후 즉시 `Hangup()` 없이 다음 노드로 진행하면, 상대방(transferee)이 Hold 상태에서 전환 대상(Carol)에 연결되지 않은 채 hanging 상태가 됨.

**발생 이유:** diago 주석: "It is expected that after calling this you are hanguping call to send BYE" (`dialog_server_session.go:480`).

**피하는 방법:** `executeBlindTransfer()`에서 `r.Refer(ctx, referTo)` 성공 후 반드시 `dialog.Hangup(hangupCtx)` 호출.

**신뢰도:** HIGH — diago 소스 주석 직접 확인.

---

### 함정 4: referrer 인터페이스 어서션 실패

**발생하는 문제:** `DialogSession` 인터페이스에 `Refer()` 메서드가 없으므로, `dialog.(referrer)` 어서션이 MakeCall로 생성된 `*diago.DialogClientSession`에서도 성공하는지 확인 필요.

**발생 이유:** diago `dialog_session.go:17-25`의 `DialogSession` 인터페이스:
```go
type DialogSession interface {
    Id() string
    Context() context.Context
    Hangup(ctx context.Context) error
    Media() *DialogMedia
    DialogSIP() *sipgo.Dialog
    Do(ctx context.Context, req *sip.Request) (*sip.Response, error)
    Close() error
}
```
`Refer()`는 미포함.

**확인 결과:**
- `*diago.DialogServerSession`은 `Refer(ctx, referTo, headers...)` 구현 → 어서션 성공
- `*diago.DialogClientSession`은 `Refer(ctx, referTo, headers...)` 구현 → 어서션 성공
- 두 타입 모두 동일한 API 시그니처 → Phase 11 모두 지원 가능

**피하는 방법:** Phase 10의 `reInviter` 패턴과 동일하게 로컬 인터페이스 어서션. 어서션 실패 시 에러 반환.

**신뢰도:** HIGH — `dialog_client_session.go:562`, `dialog_server_session.go:481` 직접 확인.

---

### 함정 5: Refer-To URI 추출 방법

**발생하는 문제:** OnRefer 콜백이 받는 `referDialog`에서 원래 REFER 요청의 Refer-To 헤더를 어떻게 추출하는가?

**분석:** `dialogReferInvite()`는 `referToUri sip.Uri`를 파라미터로 받아 `dg.NewDialog(referToUri, NewDialogOptions{})` 호출. `referDialog.InviteRequest`에는 대상 URI가 포함되어 있다.

```go
// dialog_session.go:227
referDialog, err := dg.NewDialog(referToUri, NewDialogOptions{})
```

`referDialog.InviteRequest`가 아직 전송되지 않은 초기 상태이므로, URI 추출 방법:
1. `referDialog.InviteRequest.RequestURI()` — Request-URI (가장 신뢰)
2. `referDialog.InviteRequest.To().Address.String()` — To 헤더

**권장:** `referDialog.InviteRequest.RequestURI().String()`으로 Refer-To URI 추출.

**신뢰도:** MEDIUM — `NewDialog()` 소스 확인 필요, 그러나 `dialogReferInvite()` 소스에서 `referToUri`를 target으로 전달하는 것은 확인됨.

---

## Code Examples

### 예시 1: 완전한 executeBlindTransfer 구현

```go
// executor.go
// 소스: diago v0.27.0/dialog_server_session.go:481, dialog_client_session.go:562
import (
    "context"
    "fmt"
    "time"
    "github.com/emiago/sipgo/sip"
)

func (ex *Executor) executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    // targetUser/targetHost 검증
    if node.TargetUser == "" {
        return fmt.Errorf("BlindTransfer: targetUser is required")
    }
    if node.TargetHost == "" {
        return fmt.Errorf("BlindTransfer: targetHost is required")
    }

    // Dialog 조회
    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("BlindTransfer: no active dialog for instance %s", instanceID)
    }

    // SIP URI 조합 및 파싱
    rawURI := fmt.Sprintf("sip:%s@%s", node.TargetUser, node.TargetHost)
    var referTo sip.Uri
    if err := sip.ParseUri(rawURI, &referTo); err != nil {
        return fmt.Errorf("BlindTransfer: invalid target URI %q: %w", rawURI, err)
    }

    // 로컬 referrer 인터페이스 어서션 (Phase 10 reInviter 패턴과 동일)
    type referrer interface {
        Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
    }
    r, ok := dialog.(referrer)
    if !ok {
        return fmt.Errorf("BlindTransfer: dialog type %T does not support Refer", dialog)
    }

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer: sending REFER to %s", rawURI), "info")

    // REFER 전송 (202 Accepted 확인 후 반환)
    if err := r.Refer(ctx, referTo); err != nil {
        return fmt.Errorf("BlindTransfer: REFER failed: %w", err)
    }

    // ROADMAP 성공기준 2번: 전환 대상 URI와 함께 BlindTransfer 이벤트 기록
    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer succeeded (Refer-To: %s)", rawURI), "info",
        WithSIPMessage("sent", "REFER", 202, "", "", rawURI))

    // 202 Accepted 후 즉시 BYE (diago 주석 대로)
    hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    if err := dialog.Hangup(hangupCtx); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("BlindTransfer: BYE warning: %v", err), "warn")
    }

    ex.engine.emitActionLog(node.ID, instanceID, "BlindTransfer: BYE sent", "info",
        WithSIPMessage("sent", "BYE", 200, "", "", ""))
    return nil
}
```

### 예시 2: OnRefer 콜백 완전한 구현 (Phase 10 스텁 교체)

```go
// executor.go - executeAnswer()의 OnRefer 콜백
OnRefer: func(referDialog *diago.DialogClientSession) error {
    // 1. Refer-To URI 추출 (ROADMAP 성공기준 4번)
    referToURIStr := ""
    if referDialog.InviteRequest != nil {
        referToURIStr = referDialog.InviteRequest.RequestURI().String()
    }

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("REFER received: Refer-To=%s", referToURIStr), "info",
        WithSIPMessage("received", "REFER", 202, "", "", referToURIStr))

    // 2. 새 dialog로 INVITE 전송 (Carol에게 연결)
    inviteCtx := referDialog.Context()
    if err := referDialog.Invite(inviteCtx, diago.InviteClientOptions{}); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("TransferEvent: Invite to Refer-To failed: %v", err), "error")
        return fmt.Errorf("TransferEvent: referDialog Invite failed: %w", err)
    }
    if err := referDialog.Ack(inviteCtx); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("TransferEvent: Ack failed: %v", err), "error")
        return fmt.Errorf("TransferEvent: referDialog Ack failed: %w", err)
    }

    // 3. SessionStore 교체 (기존 dialog → referDialog)
    ex.sessions.StoreDialog(instanceID, referDialog)

    // 4. TRANSFERRED 이벤트 발행 (executeWaitSIPEvent 대기 해제)
    ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("TransferEvent: session replaced with new dialog (Refer-To: %s)", referToURIStr), "info")
    return nil
},
```

### 예시 3: graph.go GraphNode 확장 및 파싱

```go
// graph.go - GraphNode 구조체
type GraphNode struct {
    // ... 기존 필드 ...
    TransferTarget string        // 레거시 필드 (Phase 10 대비)
    TargetUser     string        // BlindTransfer 대상 user (Phase 11)
    TargetHost     string        // BlindTransfer 대상 host:port (Phase 11)
    // ...
}

// ParseScenario() 내 command 파싱:
if node.Type == "command" {
    // ... 기존 필드 파싱 ...
    gnode.TargetUser = getStringField(node.Data, "targetUser", "")
    gnode.TargetHost = getStringField(node.Data, "targetHost", "")
}
```

### 예시 4: executeEvent() + executeCommand() 스위치 확장

```go
// executor.go - executeCommand()
case "BlindTransfer":
    return ex.executeBlindTransfer(ctx, instanceID, node)

// executor.go - executeEvent()
case "TRANSFERRED":
    return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "TRANSFERRED", timeout)
```

---

## Test Strategy

### 단위 테스트: executeBlindTransfer 에러 경로

Phase 10의 `executeHold` 테스트 패턴 재사용. diago `Refer()` 메서드는 구체 타입이므로 mock 불가 — 에러 경로(dialog 미존재, 빈 targetUser/targetHost, 어서션 실패)를 단위 테스트.

```go
// executor_test.go
func TestExecuteBlindTransfer_NoDialog(t *testing.T) {
    // dialog 없이 호출 → "no active dialog" 에러
}

func TestExecuteBlindTransfer_EmptyTargetUser(t *testing.T) {
    // targetUser 빈 값 → "targetUser is required" 에러
}

func TestExecuteBlindTransfer_EmptyTargetHost(t *testing.T) {
    // targetHost 빈 값 → "targetHost is required" 에러
}
```

### 단위 테스트: TransferEvent executeWaitSIPEvent

`executeWaitSIPEvent("TRANSFERRED")`는 Phase 10에서 이미 검증됨. 추가로 "TRANSFERRED" 케이스에 대해 타임아웃 경로만 테스트.

### 통합 테스트: OnRefer 콜백 SessionStore 교체

diago 로컬 포트 충돌 이슈로 완전한 SIP 통합 테스트는 어렵다. 다음 방법으로 우회:

1. `sessions.StoreDialog()` 호출 여부 확인 (SessionStore 직접 검사)
2. `emitSIPEvent("TRANSFERRED")` 후 채널 수신 확인
3. 기존 `TestIntegration_SingleInstance` 패턴으로 TRANSFERRED 이벤트 타임아웃 테스트

---

## State of the Art

| 이전 접근법 | 현재 접근법 | 변경 시점 | 영향 |
|------------|-----------|----------|------|
| 없음 (BlindTransfer 미구현) | `dialog.Refer()` + 즉시 Hangup | Phase 11 | RFC 3515 표준 준수 |
| OnRefer 스텁 (TRANSFERRED만 발행) | OnRefer 완전 구현 (URI 추출 + 교체) | Phase 11 | TransferEvent 실제 동작 |
| TransferTarget 단일 필드 | TargetUser + TargetHost 분리 필드 | Phase 11 | CONTEXT.md 결정사항 |

**폐기됨/구식:**
- OnRefer 스텁에서 `TRANSFERRED` 이벤트만 발행하는 로직 → 완전한 구현으로 교체.

---

## 현재 코드베이스 상태 (Phase 10 완료 기준)

### 이미 구현 완료된 것 (Phase 11에서 재사용)
| 항목 | 위치 | Phase 11 활용 |
|------|------|--------------|
| `executeWaitSIPEvent()` | executor.go:797-812 | "TRANSFERRED" 케이스에 그대로 사용 |
| `SessionStore.emitSIPEvent()` | executor.go:89-102 | OnRefer 콜백에서 호출 |
| `Engine.emitSIPEvent()` | engine.go:223-230 | 그대로 사용 |
| `OnRefer` 스텁 | executor.go:322-328 | 확장 (완전 구현으로 교체) |
| `reInviter` 인터페이스 패턴 | executor.go:735-742 | `referrer` 인터페이스도 동일 패턴 |
| `GraphNode.TransferTarget` | graph.go:44 | 레거시로 유지, TargetUser/TargetHost 추가 |
| SIP 이벤트 버스 인프라 | executor.go:18-130 | TRANSFERRED 이벤트 그대로 사용 |

### Phase 11에서 신규 구현
| 항목 | 위치 | 세부 내용 |
|------|------|---------|
| `executeBlindTransfer()` | executor.go | REFER 전송 + BYE |
| `executeCommand()` BlindTransfer 케이스 | executor.go:206-225 | switch 확장 |
| `executeEvent()` TRANSFERRED 케이스 | executor.go:403-421 | switch 확장 |
| `OnRefer` 완전 구현 | executor.go:322-328 | URI 추출 + 교체 |
| `GraphNode.TargetUser/TargetHost` | graph.go | 필드 추가 + ParseScenario 파싱 |

---

## Open Questions

### Q1: referDialog.InviteRequest.RequestURI() 접근 가능 여부

**아는 것:** `dialogReferInvite()`에서 `dg.NewDialog(referToUri, ...)` 호출 후 `onReferDialog(referDialog)` 실행. `referToUri`가 target으로 전달됨.

**불명확한 것:** `referDialog.InviteRequest`가 `NewDialog()` 시점에 초기화되는지, 아니면 `Invite()` 호출 후에 설정되는지.

**대안:** `referDialog.InviteRequest`가 nil이면 `referDialog.Context()` 연관 값이나 로컬 변수로 URI 전달.

**권장사항:** 구현 시 `referDialog.InviteRequest != nil` 체크 후 접근. nil이면 `"<unknown>"` 폴백.

### Q2: 기존 dialog BYE 수신 처리

**아는 것:** TransferEvent 수신 후 transferor(상대방)가 BYE를 보내 기존 세션을 종료함. SessionStore에서 기존 dialog는 이미 referDialog로 교체되었으므로, BYE 수신 시 기존 dialog context가 Done됨.

**불명확한 것:** `DISCONNECTED` 이벤트 노드가 기존 dialog를 참조하는 시나리오에서 BYE 수신 처리가 자동으로 되는지.

**권장사항:** Phase 11에서는 CONTEXT.md 결정사항대로 SessionStore 교체에만 집중. 기존 dialog의 BYE 처리는 diago 내부에서 자동 처리됨.

---

## Sources

### Primary (HIGH 신뢰도 — 소스 직접 확인)
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go:478-502` — `DialogServerSession.Refer()`, `ReferOptions()` 구현
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session.go:559-583` — `DialogClientSession.Refer()`, `ReferOptions()` 구현
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go:31-66` — `dialogRefer()` 구현 (202 Accepted 검증)
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go:110-146` — `dialogHandleRefer()` 구현 (Refer-To 파싱)
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go:148-277` — `dialogReferInvite()` 구현 (새 dialog 생성 + 콜백 호출)
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go:17-25` — `DialogSession` 인터페이스 (`Refer()` 미포함 확인)
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go:154-175` — `AnswerOptions.OnRefer` 필드, `AnswerOptions()` 콜백 등록
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session_test.go:172-333` — `TestIntegrationDialogServerRefer` 테스트 패턴
- `/Users/kyh0703/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session_test.go:584-719` — `TestIntegrationDialogClientRefer` 테스트 패턴
- `/Users/kyh0703/Project/sipflow/internal/engine/executor.go` — Phase 10 완료 코드 (OnRefer 스텁, SIP 이벤트 버스, executeWaitSIPEvent)
- `/Users/kyh0703/Project/sipflow/internal/engine/engine.go` — executor 필드, emitSIPEvent 메서드
- `/Users/kyh0703/Project/sipflow/internal/engine/graph.go` — GraphNode 구조체, ParseScenario

### Secondary (MEDIUM 신뢰도)
- `.planning/phases/11-blindtransfer-backend/CONTEXT.md` — 사용자 결정사항 (결정 섹션)
- `.planning/phases/10-hold-retrieve-backend/10-RESEARCH.md` — Phase 10 연구 (reInviter 패턴)
- `.planning/STATE.md` — 프로젝트 설계 결정 누적

---

## Metadata

**신뢰도 세분화:**
- `Refer()` API 존재 및 시그니처: HIGH — diago 소스 직접 확인
- `OnRefer` 콜백 등록 패턴: HIGH — AnswerOptions 구조체 직접 확인
- `dialogReferInvite()` 내 referDialog 상태: HIGH — 소스 코드 경로 추적
- referDialog에서 Refer-To URI 추출 방법: MEDIUM — InviteRequest 초기화 시점 추가 확인 필요
- SessionStore 교체 후 후속 노드 동작: HIGH — StoreDialog 패턴 이미 검증됨 (Phase 10)
- 테스트 전략: HIGH — Phase 10 패턴 재사용

**연구 날짜:** 2026-02-19
**유효 기한:** 30일 (diago v0.27.0 고정, 안정적)
