# Architecture Research: Transfer/Hold + UI 개선 (v1.2)

**Project:** SIPFLOW v1.2
**Research Date:** 2026-02-19
**Confidence:** HIGH (diago v0.27.0 소스 직접 확인)

---

## Executive Summary

Transfer(Blind/Attended) 및 Hold/Retrieve는 기존 executor + SessionStore 아키텍처와 자연스럽게 통합된다. 핵심 과제는 두 가지다. 첫째, SessionStore가 현재 instanceID 당 dialog 1개를 가정하는 구조를 다중 dialog(특히 Attended Transfer의 consultation leg)를 지원하도록 확장해야 한다. 둘째, Hold는 Re-INVITE(SDP sendonly/inactive)로 구현되는데 diago의 `MediaSession.Mode` 필드와 `ReInvite()` 메서드를 통해 직접 제어 가능하다. BlindTransfer는 diago의 `Refer()` / `ReferOptions()` API를 사용하고, AttendedTransfer는 Attended Consultation Leg(두 번째 Invite)를 별도 키로 SessionStore에 저장한 뒤 Replaces 헤더 포함 REFER를 보내는 패턴으로 구현한다.

---

## Backend 확장

### 1. GraphNode 확장 (graph.go)

기존 `GraphNode` 구조체에 다음 필드를 추가한다.

```go
// graph.go — GraphNode 구조체 확장
type GraphNode struct {
    // --- 기존 필드 (변경 없음) ---
    ID            string
    Type          string
    InstanceID    string
    Command       string
    TargetURI     string
    FilePath      string
    Digits        string
    IntervalMs    float64
    Event         string
    ExpectedDigit string
    Timeout       time.Duration
    SuccessNext   *GraphNode
    FailureNext   *GraphNode
    Data          map[string]interface{}

    // --- v1.2 신규 필드 ---
    // BlindTransfer: 전달 대상 SIP URI (Refer-To)
    // AttendedTransfer: consultation leg 발신 대상
    TransferTarget string

    // AttendedTransfer 전용: consultation leg가 연결된 후
    // 원래 dialog에 보낼 Refer-To에 포함할 Replaces 파라미터를
    // 어느 세션에서 가져올지 식별하는 레이블 (ConsultSessionKey)
    // 예: "consult" → SessionStore에서 키 "{instanceID}:consult" 조회
    ConsultSessionKey string
}
```

`ParseScenario()`의 command 파싱 블록에 다음을 추가한다.

```go
// graph.go — ParseScenario() command 파싱 블록
if node.Type == "command" {
    // ... 기존 필드 파싱 ...
    gnode.TransferTarget    = getStringField(node.Data, "transferTarget", "")
    gnode.ConsultSessionKey = getStringField(node.Data, "consultSessionKey", "consult")
}
```

### 2. SessionStore 확장 (executor.go)

현재 구조의 문제: `dialogs map[string]diago.DialogSession`이 `instanceID → dialog` 1:1 매핑이라 Attended Transfer에서 같은 인스턴스가 두 dialog를 동시에 보유하는 상황을 수용하지 못한다.

**해결 전략: 복합 키 (instanceID:role)**

```go
// executor.go — 확장된 SessionStore
type SessionStore struct {
    mu             sync.RWMutex
    // 키 형식:
    //   "{instanceID}"         — primary dialog (기존 동작 유지)
    //   "{instanceID}:consult" — Attended Transfer consultation leg
    dialogs        map[string]diago.DialogSession
    serverSessions map[string]*diago.DialogServerSession
}

// 기존 메서드는 변경 없음 — instanceID만 넘기면 primary dialog 조회

// 신규: 명시적 키로 저장/조회 (consultation leg 전용)
func (ss *SessionStore) StoreDialogWithKey(key string, dialog diago.DialogSession) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    ss.dialogs[key] = dialog
}

func (ss *SessionStore) GetDialogWithKey(key string) (diago.DialogSession, bool) {
    ss.mu.RLock()
    defer ss.mu.RUnlock()
    dialog, exists := ss.dialogs[key]
    return dialog, exists
}

func (ss *SessionStore) DeleteDialogWithKey(key string) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    delete(ss.dialogs, key)
}

// consultKey 헬퍼
func consultKey(instanceID, role string) string {
    return instanceID + ":" + role
}
```

`HangupAll()`과 `CloseAll()`은 기존대로 모든 키를 순회하므로 consultation leg도 자동으로 정리된다. 추가 수정 불필요.

### 3. executor.go 새 핸들러

#### 3.1 executeCommand() 스위치 확장

```go
// executor.go — executeCommand()
func (ex *Executor) executeCommand(ctx context.Context, instanceID string, node *GraphNode) error {
    switch node.Command {
    case "MakeCall":   return ex.executeMakeCall(ctx, instanceID, node)
    case "Answer":     return ex.executeAnswer(ctx, instanceID, node)
    case "Release":    return ex.executeRelease(ctx, instanceID, node)
    case "PlayAudio":  return ex.executePlayAudio(ctx, instanceID, node)
    case "SendDTMF":   return ex.executeSendDTMF(ctx, instanceID, node)
    // --- v1.2 신규 ---
    case "Hold":             return ex.executeHold(ctx, instanceID, node)
    case "Retrieve":         return ex.executeRetrieve(ctx, instanceID, node)
    case "BlindTransfer":    return ex.executeBlindTransfer(ctx, instanceID, node)
    case "AttendedTransfer": return ex.executeAttendedTransfer(ctx, instanceID, node)
    default:
        return fmt.Errorf("unknown command: %s", node.Command)
    }
}
```

#### 3.2 executeHold

Hold는 SIP Re-INVITE로 구현된다. 발신 측(UAC)이 SDP `a=sendonly`로 Re-INVITE를 보내면 원격은 `a=recvonly`로 응답한다. diago의 `DialogMedia`는 `MediaSession.Mode` 필드를 직접 노출하고, `ReInvite(ctx)`가 현재 `mediaSession.LocalSDP()`를 사용해 Re-INVITE를 보낸다.

```go
// executor.go
func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Hold: sending Re-INVITE (sendonly)", "info")

    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("Hold: no active dialog for instance %s", instanceID)
    }

    // MediaSession.Mode를 sendonly로 변경하면 LocalSDP()에 반영됨
    mediaSess := dialog.Media().MediaSession()
    if mediaSess == nil {
        return fmt.Errorf("Hold: no media session available")
    }

    mediaSess.Mode = "sendonly" // sdp.ModeSendonly

    // Re-INVITE 전송 — dialog 타입에 따라 분기
    // diago.DialogSession 인터페이스는 ReInvite를 직접 노출하지 않으므로
    // 타입 어서션으로 구체 타입에 접근
    type reInviter interface {
        ReInvite(ctx context.Context) error
    }
    ri, ok := dialog.(reInviter)
    if !ok {
        return fmt.Errorf("Hold: dialog does not support ReInvite")
    }

    if err := ri.ReInvite(ctx); err != nil {
        return fmt.Errorf("Hold Re-INVITE failed: %w", err)
    }

    ex.engine.emitActionLog(node.ID, instanceID, "Hold succeeded", "info",
        WithSIPMessage("sent", "INVITE", 200, "", "", ""))
    return nil
}
```

**신뢰도 노트:** `diago.DialogClientSession.ReInvite()`와 `diago.DialogServerSession.ReInvite()` 모두 v0.27.0 소스에서 확인됨. `MediaSession.Mode` 필드도 `media_session.go:102`에서 확인됨. `LocalSDP()`가 Mode를 SDP에 포함(`media_session.go:403`)함도 확인됨.

#### 3.3 executeRetrieve

Retrieve는 Hold 해제 — Mode를 sendrecv로 복원하고 Re-INVITE 전송.

```go
// executor.go
func (ex *Executor) executeRetrieve(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Retrieve: sending Re-INVITE (sendrecv)", "info")

    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("Retrieve: no active dialog for instance %s", instanceID)
    }

    mediaSess := dialog.Media().MediaSession()
    if mediaSess == nil {
        return fmt.Errorf("Retrieve: no media session available")
    }

    mediaSess.Mode = "sendrecv" // sdp.ModeSendrecv

    type reInviter interface {
        ReInvite(ctx context.Context) error
    }
    ri, ok := dialog.(reInviter)
    if !ok {
        return fmt.Errorf("Retrieve: dialog does not support ReInvite")
    }

    if err := ri.ReInvite(ctx); err != nil {
        return fmt.Errorf("Retrieve Re-INVITE failed: %w", err)
    }

    ex.engine.emitActionLog(node.ID, instanceID, "Retrieve succeeded", "info",
        WithSIPMessage("sent", "INVITE", 200, "", "", ""))
    return nil
}
```

#### 3.4 executeBlindTransfer

Blind Transfer: 기존 dialog에 REFER를 보내고 즉시 BYE. diago의 `Refer()` / `ReferOptions()` API가 이를 처리한다.

```go
// executor.go
func (ex *Executor) executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    if node.TransferTarget == "" {
        return fmt.Errorf("BlindTransfer requires transferTarget")
    }
    if !strings.HasPrefix(node.TransferTarget, "sip:") {
        return fmt.Errorf("transferTarget must start with sip: scheme")
    }

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("BlindTransfer to %s", node.TransferTarget), "info")

    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("BlindTransfer: no active dialog for instance %s", instanceID)
    }

    var referTo sip.Uri
    if err := sip.ParseUri(node.TransferTarget, &referTo); err != nil {
        return fmt.Errorf("BlindTransfer: invalid transferTarget %q: %w", node.TransferTarget, err)
    }

    // diago DialogSession 인터페이스는 Refer를 직접 노출하지 않으므로 타입 어서션
    type referer interface {
        Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
    }
    ref, ok := dialog.(referer)
    if !ok {
        return fmt.Errorf("BlindTransfer: dialog does not support Refer")
    }

    timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()

    if err := ref.Refer(timeoutCtx, referTo); err != nil {
        return fmt.Errorf("BlindTransfer REFER failed: %w", err)
    }

    // RFC 3515: REFER 후 BYE 전송 권장
    hangupCtx, hangupCancel := context.WithTimeout(ctx, 5*time.Second)
    defer hangupCancel()
    if err := dialog.Hangup(hangupCtx); err != nil {
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("BlindTransfer post-REFER BYE warning: %v", err), "warn")
    }

    ex.engine.emitActionLog(node.ID, instanceID, "BlindTransfer succeeded", "info",
        WithSIPMessage("sent", "REFER", 202, "", "", node.TransferTarget))
    return nil
}
```

#### 3.5 executeAttendedTransfer

Attended Transfer는 두 단계로 나뉜다.

**단계 A: Consultation Call 수립** (MakeCall과 유사, 별도 키로 저장)

```go
// executor.go
// AttendedTransfer Command는 두 단계를 순서대로 수행한다:
// 1. 원래 dialog를 Hold
// 2. TransferTarget으로 consultation call 발신
// 3. consultation call이 연결되면 원래 dialog에 Replaces REFER 전송
// 4. 두 dialog 모두 종료
func (ex *Executor) executeAttendedTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    if node.TransferTarget == "" {
        return fmt.Errorf("AttendedTransfer requires transferTarget")
    }

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("AttendedTransfer: consult to %s", node.TransferTarget), "info")

    // 1. 원래 (primary) dialog 조회
    primaryDialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("AttendedTransfer: no primary dialog for instance %s", instanceID)
    }

    // 2. Primary dialog Hold
    primaryMediaSess := primaryDialog.Media().MediaSession()
    if primaryMediaSess != nil {
        primaryMediaSess.Mode = "sendonly"
        type reInviter interface{ ReInvite(ctx context.Context) error }
        if ri, ok := primaryDialog.(reInviter); ok {
            holdCtx, holdCancel := context.WithTimeout(ctx, 10*time.Second)
            defer holdCancel()
            if err := ri.ReInvite(holdCtx); err != nil {
                ex.engine.emitActionLog(node.ID, instanceID,
                    fmt.Sprintf("AttendedTransfer: Hold warning: %v", err), "warn")
                // Hold 실패해도 진행 (일부 UA는 Hold 없이도 허용)
            }
        }
    }
    ex.engine.emitActionLog(node.ID, instanceID, "AttendedTransfer: primary dialog held", "info")

    // 3. Consultation call 발신
    var consultTarget sip.Uri
    if err := sip.ParseUri(node.TransferTarget, &consultTarget); err != nil {
        return fmt.Errorf("AttendedTransfer: invalid transferTarget: %w", err)
    }

    instance, err := ex.im.GetInstance(instanceID)
    if err != nil {
        return fmt.Errorf("AttendedTransfer: get instance failed: %w", err)
    }

    consultCtx, consultCancel := context.WithTimeout(ctx, 30*time.Second)
    defer consultCancel()

    consultDialog, err := instance.UA.Invite(consultCtx, consultTarget, diago.InviteOptions{})
    if err != nil {
        // Consultation 실패 → Primary dialog Retrieve
        primaryMediaSess.Mode = "sendrecv"
        type reInviter interface{ ReInvite(ctx context.Context) error }
        if ri, ok := primaryDialog.(reInviter); ok {
            _ = ri.ReInvite(ctx)
        }
        return fmt.Errorf("AttendedTransfer: consultation call failed: %w", err)
    }
    defer consultDialog.Close()

    // 4. Consultation dialog를 별도 키로 저장
    consultKeyStr := consultKey(instanceID, node.ConsultSessionKey)
    ex.sessions.StoreDialogWithKey(consultKeyStr, consultDialog)
    defer ex.sessions.DeleteDialogWithKey(consultKeyStr)

    ex.engine.emitActionLog(node.ID, instanceID,
        fmt.Sprintf("AttendedTransfer: consultation established to %s", node.TransferTarget), "info")

    // 5. Primary dialog에 Replaces REFER 전송
    // RFC 3891 Replaces 헤더: Call-ID;to-tag=...;from-tag=...
    consultSIPDialog := consultDialog.DialogSIP()
    callID := consultSIPDialog.CallID
    toTag, _ := consultSIPDialog.InviteResponse.To().Params.Get("tag")
    fromTag, _ := consultSIPDialog.InviteRequest.From().Params.Get("tag")

    // Refer-To: <sip:target?Replaces=callID%3Bto-tag%3DtoTag%3Bfrom-tag%3DfromTag>
    replacesValue := fmt.Sprintf("%s;to-tag=%s;from-tag=%s", callID, toTag, fromTag)
    referToURI := fmt.Sprintf("%s?Replaces=%s",
        node.TransferTarget,
        url.QueryEscape(replacesValue))

    var referTo sip.Uri
    if err := sip.ParseUri(referToURI, &referTo); err != nil {
        return fmt.Errorf("AttendedTransfer: building Refer-To failed: %w", err)
    }

    type referer interface {
        Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
    }
    ref, ok := primaryDialog.(referer)
    if !ok {
        return fmt.Errorf("AttendedTransfer: primary dialog does not support Refer")
    }

    referCtx, referCancel := context.WithTimeout(ctx, 10*time.Second)
    defer referCancel()

    if err := ref.Refer(referCtx, referTo); err != nil {
        return fmt.Errorf("AttendedTransfer REFER failed: %w", err)
    }

    // 6. 두 dialog 모두 BYE
    hangupCtx, hangupCancel := context.WithTimeout(ctx, 5*time.Second)
    defer hangupCancel()
    _ = primaryDialog.Hangup(hangupCtx)
    _ = consultDialog.Hangup(hangupCtx)

    ex.engine.emitActionLog(node.ID, instanceID, "AttendedTransfer succeeded", "info",
        WithSIPMessage("sent", "REFER", 202, "", "", node.TransferTarget))
    return nil
}
```

**중요 설계 노트:** `consultSIPDialog.CallID`, `InviteResponse.To()`, `InviteRequest.From()`은 `sipgo.DialogClientSession`의 필드/메서드다. diago의 `DialogClientSession`은 `*sipgo.DialogClientSession`을 임베드하므로 접근 가능하다. 단, `diago.DialogSession` 인터페이스(`dialog_session.go:17-25`)는 `DialogSIP() *sipgo.Dialog`를 통해서만 접근되므로 타입 어서션이 필요하다.

#### 3.6 executeEvent() — HELD/RETRIEVED/TRANSFERRED 이벤트

HELD/RETRIEVED는 원격에서 Re-INVITE를 받아서 감지하는 이벤트다. diago는 Re-INVITE를 `handleReInvite()` 내부에서 자동 처리하며, `AnswerOptions.OnMediaUpdate` 콜백으로 애플리케이션에 알린다.

**감지 방법:** `DialogServerSession.AnswerOptions`의 `OnMediaUpdate` 콜백을 등록하고, 수신된 SDP의 `Mode`가 `sendonly`(=원격이 hold)이면 HELD, `sendrecv`(=원격이 retrieve)이면 RETRIEVED 이벤트를 발행한다.

이 콜백은 `Answer` 시점에 등록해야 하므로 `executeAnswer()`를 확장한다.

```go
// executor.go — executeAnswer() 확장
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Answer incoming call", "info")

    serverSession, exists := ex.sessions.GetServerSession(instanceID)
    if !exists {
        return fmt.Errorf("no incoming dialog to answer for instance %s", instanceID)
    }

    // v1.2 신규: OnMediaUpdate 콜백 등록으로 Hold/Retrieve 감지
    opts := diago.AnswerOptions{
        OnMediaUpdate: func(d *diago.DialogMedia) {
            mediaSess := d.MediaSession()
            if mediaSess == nil {
                return
            }
            switch mediaSess.Mode {
            case "sendonly":
                // 원격이 sendonly → 우리는 recvonly → 우리 입장에서 HELD
                ex.engine.emitActionLog("", instanceID, "Remote hold detected (HELD)", "info")
                ex.engine.emitSIPEvent(instanceID, "HELD")
            case "sendrecv":
                // 원격이 sendrecv 복원 → RETRIEVED
                ex.engine.emitActionLog("", instanceID, "Remote retrieve detected (RETRIEVED)", "info")
                ex.engine.emitSIPEvent(instanceID, "RETRIEVED")
            }
        },
    }

    if err := serverSession.AnswerOptions(opts); err != nil {
        // ... 기존 에러 처리 ...
        return fmt.Errorf("Answer failed: %w", err)
    }

    ex.sessions.StoreDialog(instanceID, serverSession)

    fromUser := serverSession.FromUser()
    toUser := serverSession.ToUser()
    ex.engine.emitActionLog(node.ID, instanceID, "Answer succeeded", "info",
        WithSIPMessage("received", "INVITE", 200, "", fromUser, toUser))
    return nil
}
```

TRANSFERRED 이벤트(원격에서 REFER 수신)는 `AnswerOptions.OnRefer` 콜백으로 감지한다.

```go
// executor.go — executeAnswer() OnRefer 추가
opts := diago.AnswerOptions{
    OnMediaUpdate: /* 위와 같음 */,
    OnRefer: func(referDialog *diago.DialogClientSession) error {
        // 원격 UA가 우리에게 REFER를 보냄 (=우리가 transfer 대상)
        ex.engine.emitActionLog("", instanceID, "Incoming REFER received (TRANSFERRED)", "info")
        ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")

        // Consultation call 수락: referDialog로 Invite + Ack
        if err := referDialog.Invite(referDialog.Context(), diago.InviteClientOptions{}); err != nil {
            return err
        }
        return referDialog.Ack(referDialog.Context())
    },
}
```

HELD/RETRIEVED/TRANSFERRED 이벤트 대기는 executor의 event 채널 패턴으로 구현한다.

```go
// executor.go — executeEvent() 확장
func (ex *Executor) executeEvent(ctx context.Context, instanceID string, node *GraphNode) error {
    // ...
    switch node.Event {
    case "INCOMING":     return ex.executeIncoming(...)
    case "DISCONNECTED": return ex.executeDisconnected(...)
    case "RINGING":      return ex.executeRinging(...)
    case "TIMEOUT":      return ex.executeTimeout(...)
    case "DTMFReceived": return ex.executeDTMFReceived(...)
    // --- v1.2 신규 ---
    case "HELD":         return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "HELD", timeout)
    case "RETRIEVED":    return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "RETRIEVED", timeout)
    case "TRANSFERRED":  return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "TRANSFERRED", timeout)
    case "NOTIFY":       return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "NOTIFY", timeout)
    default:
        return fmt.Errorf("event type %s is not supported", node.Event)
    }
}

func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType string, timeout time.Duration) error {
    ch := ex.sessions.SubscribeSIPEvent(instanceID, eventType)
    defer ex.sessions.UnsubscribeSIPEvent(instanceID, eventType, ch)

    select {
    case <-ch:
        ex.engine.emitActionLog(node.ID, instanceID,
            fmt.Sprintf("%s event received", eventType), "info")
        return nil
    case <-ctx.Done():
        return fmt.Errorf("%s event timeout after %v", eventType, timeout)
    }
}
```

이 패턴을 위해 SessionStore에 이벤트 구독 메커니즘을 추가한다.

```go
// executor.go — SessionStore 이벤트 버스 확장
type SessionStore struct {
    mu             sync.RWMutex
    dialogs        map[string]diago.DialogSession
    serverSessions map[string]*diago.DialogServerSession
    // v1.2 신규: SIP 이벤트 구독 채널 맵
    // 키: "{instanceID}:{eventType}", 값: 구독 채널 슬라이스
    sipEventSubs   map[string][]chan struct{}
}

func (ss *SessionStore) emitSIPEvent(instanceID, eventType string) {
    ss.mu.RLock()
    defer ss.mu.RUnlock()
    key := instanceID + ":" + eventType
    for _, ch := range ss.sipEventSubs[key] {
        select {
        case ch <- struct{}{}:
        default: // 버퍼 초과 시 드롭
        }
    }
}

func (ss *SessionStore) SubscribeSIPEvent(instanceID, eventType string) chan struct{} {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    key := instanceID + ":" + eventType
    ch := make(chan struct{}, 1)
    ss.sipEventSubs[key] = append(ss.sipEventSubs[key], ch)
    return ch
}

func (ss *SessionStore) UnsubscribeSIPEvent(instanceID, eventType string, ch chan struct{}) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    key := instanceID + ":" + eventType
    subs := ss.sipEventSubs[key]
    for i, s := range subs {
        if s == ch {
            ss.sipEventSubs[key] = append(subs[:i], subs[i+1:]...)
            break
        }
    }
}
```

`Engine.emitSIPEvent()`는 SessionStore의 `emitSIPEvent()`를 호출하는 래퍼다.

```go
// events.go 또는 engine.go — 신규 메서드
func (e *Engine) emitSIPEvent(instanceID, eventType string) {
    // Executor의 sessions에 접근해야 하므로 Engine이 Executor 참조를 보유해야 함
    // 현재 Engine은 Executor를 로컬 변수로만 보유 → executor를 Engine 필드로 승격
    if e.executor != nil {
        e.executor.sessions.emitSIPEvent(instanceID, eventType)
    }
}
```

**구조 변경:** `engine.go`에서 `executor`를 로컬 goroutine 변수에서 Engine 필드로 승격시켜야 한다.

```go
// engine.go — Engine 구조체 수정
type Engine struct {
    // ... 기존 필드 ...
    executor   *Executor  // v1.2 신규: executor를 필드로 승격 (SIP 이벤트 라우팅)
}
```

### 4. instance_manager.go 변경

v1.2에서 `instance_manager.go`는 최소한의 변경만 필요하다. 현재 구조는 이미 충분하다.

**변경 없음:** Attended Transfer의 consultation call은 `executeMakeCall()`과 동일하게 `instance.UA.Invite()`를 직접 호출한다. 이미 존재하는 인스턴스의 UA를 재사용하므로 새 UA 생성이나 포트 할당이 필요 없다.

**선택적 고려:** 실제 SIP 환경(loopback 이상)에서 REFER를 수신한 원격 UA가 우리 인스턴스에 새 INVITE를 보낼 때, `incomingCh`를 통해 처리된다. 이미 동작하는 패턴이다.

---

## Frontend 확장

### 5. 타입 확장 (scenario.ts)

```typescript
// types/scenario.ts

// COMMAND_TYPES에 v1.2 추가
export const COMMAND_TYPES = [
    'MakeCall', 'Answer', 'Release', 'PlayAudio', 'SendDTMF',
    // v1.2 신규
    'Hold', 'Retrieve', 'BlindTransfer', 'AttendedTransfer',
] as const;

// EVENT_TYPES는 이미 'HELD', 'RETRIEVED', 'TRANSFERRED', 'NOTIFY' 포함
// 변경 없음

// CommandNodeData에 v1.2 필드 추가
export interface CommandNodeData extends Record<string, unknown> {
    label: string;
    command: (typeof COMMAND_TYPES)[number];
    sipInstanceId?: string;
    targetUri?: string;
    timeout?: number;
    filePath?: string;
    digits?: string;
    intervalMs?: number;
    // v1.2 신규
    transferTarget?: string;     // BlindTransfer / AttendedTransfer 대상 URI
    consultSessionKey?: string;  // AttendedTransfer consultation leg 식별 키 (기본 "consult")
}
```

### 6. 노드 팔레트 개선 (node-palette.tsx)

현재 팔레트는 Commands와 Events를 하나의 섹션으로 구성한다. v1.2에서 Commands를 기능별 하위 그룹으로 나눈다.

```tsx
// components/node-palette.tsx — Commands 섹션 재구성
export function NodePalette() {
    return (
        <div>
            <Section title="SIP Instance">
                <PaletteItem type="sipInstance" label="SIP Instance" icon={Server}
                    colorClass="bg-emerald-50 border-emerald-400 text-emerald-900" />
            </Section>

            <Section title="Commands">
                {/* 기본 통화 제어 (기존) */}
                <SubSection title="Call Control">
                    <PaletteItem type="command-MakeCall" label="MakeCall" icon={Phone}
                        colorClass="bg-blue-50 border-blue-400 text-blue-900" />
                    <PaletteItem type="command-Answer" label="Answer" icon={PhoneIncoming}
                        colorClass="bg-blue-50 border-blue-400 text-blue-900" />
                    <PaletteItem type="command-Release" label="Release" icon={PhoneOff}
                        colorClass="bg-blue-50 border-blue-400 text-blue-900" />
                </SubSection>

                {/* v1.2 신규: Hold/Transfer */}
                <SubSection title="Hold / Transfer">
                    <PaletteItem type="command-Hold" label="Hold" icon={PauseCircle}
                        colorClass="bg-indigo-50 border-indigo-400 text-indigo-900" />
                    <PaletteItem type="command-Retrieve" label="Retrieve" icon={PlayCircle}
                        colorClass="bg-indigo-50 border-indigo-400 text-indigo-900" />
                    <PaletteItem type="command-BlindTransfer" label="BlindTransfer" icon={ArrowRightLeft}
                        colorClass="bg-violet-50 border-violet-400 text-violet-900" />
                    <PaletteItem type="command-AttendedTransfer" label="AttendedTransfer" icon={GitMerge}
                        colorClass="bg-violet-50 border-violet-400 text-violet-900" />
                </SubSection>

                {/* 미디어 (기존) */}
                <SubSection title="Media">
                    <PaletteItem type="command-PlayAudio" label="PlayAudio" icon={Volume2}
                        colorClass="bg-blue-50 border-blue-400 text-blue-900" />
                    <PaletteItem type="command-SendDTMF" label="SendDTMF" icon={Hash}
                        colorClass="bg-blue-50 border-blue-400 text-blue-900" />
                </SubSection>
            </Section>

            <Section title="Events">
                {/* 기존 이벤트들 */}
                {/* HELD, RETRIEVED, TRANSFERRED는 이미 팔레트에 존재 — 색상만 유지 */}
                {/* 단, 이제 백엔드 구현이 완료되므로 "미구현" 표시 제거 */}
            </Section>
        </div>
    );
}
```

`SubSection` 컴포넌트를 신규 추가하거나, 기존 `Section`의 children에 중첩 그룹으로 처리한다. 구현은 기존 `Section` 컴포넌트 패턴과 동일 (접기/펼치기).

### 7. Properties 패널 확장 (command-properties.tsx)

Hold와 Retrieve는 별도 필드가 없다 (인스턴스 할당만 필요). BlindTransfer와 AttendedTransfer는 `transferTarget` 필드가 필요하다.

```tsx
// components/properties/command-properties.tsx — v1.2 추가

// BlindTransfer 속성
{data.command === 'BlindTransfer' && (
    <div className="space-y-2">
        <Label htmlFor="transferTarget">Transfer Target URI</Label>
        <Input
            id="transferTarget"
            value={data.transferTarget || ''}
            onChange={(e) => onUpdate({ transferTarget: e.target.value })}
            placeholder="sip:agent@domain"
        />
        <p className="text-xs text-muted-foreground">
            Destination for blind transfer (REFER Refer-To)
        </p>
    </div>
)}

// AttendedTransfer 속성
{data.command === 'AttendedTransfer' && (
    <>
        <div className="space-y-2">
            <Label htmlFor="transferTarget">Consultation Target URI</Label>
            <Input
                id="transferTarget"
                value={data.transferTarget || ''}
                onChange={(e) => onUpdate({ transferTarget: e.target.value })}
                placeholder="sip:agent@domain"
            />
            <p className="text-xs text-muted-foreground">
                URI to call for consultation before transfer
            </p>
        </div>
        <div className="space-y-2">
            <Label htmlFor="consultSessionKey">Consultation Session Key</Label>
            <Input
                id="consultSessionKey"
                value={data.consultSessionKey || 'consult'}
                onChange={(e) => onUpdate({ consultSessionKey: e.target.value })}
                placeholder="consult"
            />
            <p className="text-xs text-muted-foreground">
                Internal key for consultation dialog (default: "consult")
            </p>
        </div>
        <div className="space-y-2">
            <Label htmlFor="timeout">Transfer Timeout (ms)</Label>
            <Input
                id="timeout"
                type="number"
                value={data.timeout || 30000}
                onChange={(e) => onUpdate({ timeout: parseInt(e.target.value, 10) })}
            />
        </div>
    </>
)}

// Hold / Retrieve — 별도 필드 없음, 인스턴스 할당 UI만 표시
{(data.command === 'Hold' || data.command === 'Retrieve') && (
    <p className="text-xs text-muted-foreground">
        {data.command === 'Hold'
            ? 'Sends Re-INVITE with sendonly SDP to put call on hold.'
            : 'Sends Re-INVITE with sendrecv SDP to retrieve held call.'}
    </p>
)}
```

### 8. 실행 모니터 개선

#### 8.1 execution-log.tsx — 인스턴스 필터 추가

현재 로그는 레벨(info/warn/error) 필터링만 지원한다. v1.2에서 인스턴스별 필터를 추가한다.

```tsx
// components/execution-log.tsx — 인스턴스 필터 추가

// 상태: 선택된 인스턴스 ID 필터
const [instanceFilter, setInstanceFilter] = useState<string | null>(null);

// 고유 인스턴스 ID 목록
const uniqueInstances = useMemo(
    () => [...new Set(actionLogs.map((l) => l.instanceId).filter(Boolean))],
    [actionLogs]
);

// 필터 적용
const filteredLogs = actionLogs.filter(
    (log) =>
        activeFilters.has(log.level) &&
        (instanceFilter === null || log.instanceId === instanceFilter)
);

// UI: 인스턴스 선택 드롭다운
<select
    value={instanceFilter ?? 'all'}
    onChange={(e) => setInstanceFilter(e.target.value === 'all' ? null : e.target.value)}
    className="text-xs border rounded px-1 py-0.5"
>
    <option value="all">All Instances</option>
    {uniqueInstances.map((id) => (
        <option key={id} value={id}>{id}</option>
    ))}
</select>
```

#### 8.2 execution-timeline.tsx — Transfer/Hold 시각화

현재 타임라인은 `sent`/`received` 방향으로만 화살표를 그린다. Transfer 이벤트는 별도 레인 없이 표시하기 어려우므로 SIP 메서드 레이블을 색상으로 구분한다.

```tsx
// components/execution-timeline.tsx — 메서드별 색상 구분

const methodColor = (method: string, responseCode?: number): string => {
    if (responseCode && responseCode >= 400) return '#ef4444'; // red
    switch (method) {
        case 'INVITE': return '#3b82f6';  // blue
        case 'BYE':    return '#ef4444';  // red
        case 'REFER':  return '#8b5cf6';  // violet — Transfer
        case 'NOTIFY': return '#8b5cf6';  // violet
        case 'RINGING': return '#f59e0b'; // amber
        default:        return '#6b7280'; // gray
    }
};
```

HELD/RETRIEVED 이벤트는 Re-INVITE이므로 `method: "INVITE"`로 로그되나, Hold 관련 로그 메시지에 "(sendonly)"나 "(HELD)" 텍스트가 포함된다. 타임라인 레이블을 `method + note` 형태로 개선한다.

```tsx
// 기존: label = method
// 신규: label = sipMessage.method + (sipMessage.note가 있으면 ' (note)')
const label = msg.sipMessage?.method
    ? (msg.sipMessage.note
        ? `${msg.sipMessage.method} (${msg.sipMessage.note})`
        : msg.sipMessage.method)
    : String(msg.sipMessage?.responseCode || '');
```

이를 위해 `WithSIPMessage()` 옵션 함수에 `note` 필드를 추가한다.

```go
// events.go — WithSIPMessage 확장
func WithSIPMessage(direction, method string, responseCode int, callID, from, to string, note ...string) ActionLogOption {
    return func(data map[string]interface{}) {
        msg := map[string]interface{}{
            "direction":    direction,
            "method":       method,
            "responseCode": responseCode,
            "callId":       callID,
            "from":         from,
            "to":           to,
        }
        if len(note) > 0 && note[0] != "" {
            msg["note"] = note[0]
        }
        data["sipMessage"] = msg
    }
}
```

프론트엔드 타입도 갱신한다.

```typescript
// types/execution.ts — SIPMessage에 note 필드 추가
export interface SIPMessage {
    direction: 'sent' | 'received';
    method: string;
    responseCode?: number;
    callId?: string;
    from?: string;
    to?: string;
    note?: string;  // v1.2 신규: "sendonly", "HELD" 등 컨텍스트
}
```

---

## 데이터 흐름

### BlindTransfer 흐름

```
[Scenario Flow]
  MakeCall ──► RINGING ──► Hold ──► BlindTransfer ──► Release

[SIP Ladder]

  Instance A          Remote UA B          Agent C
      │                    │                   │
      │──── INVITE ────────►│                   │
      │◄─── 180 Ringing ───│                   │
      │◄─── 200 OK ────────│                   │
      │──── ACK ───────────►│                   │
      │                    │                   │
      │ [Hold]             │                   │
      │──── INVITE(sendonly)►│                  │
      │◄─── 200 OK(recvonly)│                  │
      │──── ACK ───────────►│                   │
      │                    │                   │
      │ [BlindTransfer]    │                   │
      │──── REFER ──────────►│                  │
      │    Refer-To: sip:C  │                  │
      │◄─── 202 Accepted ──│                   │
      │◄─── NOTIFY(100) ───│                   │
      │──── 200 OK ─────────►│  INVITE ─────────►│
      │◄─── NOTIFY(200) ───│  ◄─ 200 OK ───────│
      │──── 200 OK ─────────►│  ACK ─────────────►│
      │──── BYE ───────────►│                   │
      │◄─── 200 OK ────────│                   │
```

### AttendedTransfer 흐름

```
[Scenario Flow]
  MakeCall (primary) ──► Hold ──► AttendedTransfer (consultation + REFER) ──► [BYE both]

[SIP Ladder]

  Instance A          Remote UA B          Agent C
      │                    │                   │
      │ [Primary call]     │                   │
      │──── INVITE ────────►│                   │
      │◄─── 200 OK ────────│                   │
      │──── ACK ───────────►│                   │
      │                    │                   │
      │ [Hold primary]     │                   │
      │──── INVITE(sendonly)►│                  │
      │◄─── 200 OK ────────│                   │
      │──── ACK ───────────►│                   │
      │                    │                   │
      │ [Consultation call] │                  │
      │──────────────────── INVITE ─────────────►│
      │◄─────────────────── 200 OK ─────────────│
      │──────────────────── ACK ────────────────►│
      │                    │                   │
      │ [REFER with Replaces]│                  │
      │──── REFER ──────────►│                  │
      │   Refer-To: sip:C?  │                  │
      │   Replaces=callID;  │                  │
      │   to-tag=X;from-tag=Y│                 │
      │◄─── 202 Accepted ──│                   │
      │                    │──── INVITE ────────►│
      │                    │  Replaces: callID  │
      │                    │◄─── 200 OK ────────│
      │                    │──── ACK ───────────►│
      │◄─── BYE ───────────│   (consult leg BYE)│
      │──── BYE ───────────►│                   │
```

### Hold/Retrieve 흐름

```
[Scenario Flow]
  Answer ──► HELD (wait remote hold) ──► RETRIEVED (wait remote retrieve)

[SIP Ladder]

  Instance A          Remote UA B
      │                    │
      │ [Remote puts on hold]
      │◄──── INVITE(sendonly)│
      │───── 200 OK(recvonly)►│
      │◄──── ACK ───────────│
      │  OnMediaUpdate callback: Mode="sendonly" → emitSIPEvent("HELD")
      │                    │
      │ [HELD event node completes]
      │                    │
      │ [Remote retrieves]  │
      │◄──── INVITE(sendrecv)│
      │───── 200 OK(sendrecv)►│
      │◄──── ACK ───────────│
      │  OnMediaUpdate callback: Mode="sendrecv" → emitSIPEvent("RETRIEVED")
      │                    │
      │ [RETRIEVED event node completes]
```

---

## 빌드 순서 제안

의존성 분석에 기반한 순서다.

```
Phase 1: Hold/Retrieve (기반)
├── 이유: Re-INVITE 패턴이 가장 단순, 기존 SessionStore 변경 불필요
├── 포함:
│   ├── executor.go: executeHold(), executeRetrieve()
│   ├── executor.go: executeAnswer() AnswerOptions 확장 (OnMediaUpdate)
│   ├── executor.go: SessionStore sipEventSubs 추가
│   ├── executor.go: SubscribeSIPEvent/UnsubscribeSIPEvent/emitSIPEvent
│   ├── executor.go: executeWaitSIPEvent() for HELD/RETRIEVED
│   ├── engine.go: executor 필드 승격
│   ├── events.go: WithSIPMessage note 파라미터 추가
│   ├── graph.go: GraphNode 신규 필드 추가
│   ├── scenario.ts: COMMAND_TYPES + CommandNodeData 확장
│   ├── command-properties.tsx: Hold/Retrieve UI
│   ├── event-properties.tsx: HELD/RETRIEVED 속성 (timeout만)
│   └── execution-log.tsx: 인스턴스 필터 추가
└── 검증: Hold→HELD→Retrieve→RETRIEVED 시나리오

Phase 2: BlindTransfer
├── 이유: Hold 완료 후 REFER 패턴 추가, Attended보다 단순
├── 포함:
│   ├── executor.go: executeBlindTransfer()
│   ├── scenario.ts: BlindTransfer 타입
│   ├── command-properties.tsx: BlindTransfer UI (transferTarget)
│   ├── node-palette.tsx: BlindTransfer 팔레트 항목
│   └── execution-timeline.tsx: REFER 색상 구분
└── 검증: MakeCall→Hold→BlindTransfer 시나리오

Phase 3: AttendedTransfer
├── 이유: Hold + BlindTransfer 모두 완료 후, 가장 복잡한 기능
├── 포함:
│   ├── executor.go: SessionStore 복합 키 메서드 (StoreDialogWithKey 등)
│   ├── executor.go: executeAttendedTransfer()
│   ├── executor.go: TRANSFERRED 이벤트 (OnRefer 콜백)
│   ├── scenario.ts: AttendedTransfer 타입
│   ├── command-properties.tsx: AttendedTransfer UI
│   └── node-palette.tsx: AttendedTransfer 팔레트 항목
└── 검증: MakeCall→Hold→AttendedTransfer 시나리오

Phase 4: UI 개선 (노드 팔레트 그룹화)
├── 이유: 기능 구현 후 UX 개선, 독립적
├── 포함:
│   ├── node-palette.tsx: SubSection 컴포넌트, Call Control/Hold+Transfer/Media 그룹
│   ├── execution-timeline.tsx: note 필드 시각화
│   └── command-node.tsx: Hold/Transfer 노드 시각적 구분
└── 검증: 시각적 확인
```

---

## 통합 포인트 요약 (파일별)

| 파일 | 변경 종류 | 변경 내용 |
|------|-----------|-----------|
| `internal/engine/graph.go` | 수정 | `GraphNode`에 `TransferTarget`, `ConsultSessionKey` 필드 추가; 파싱 로직 확장 |
| `internal/engine/executor.go` | 수정 | `SessionStore`에 복합 키 메서드 + sipEventSubs 추가; `executeCommand()` 스위치 확장; `executeAnswer()` AnswerOptions 확장; `executeHold/Retrieve/BlindTransfer/AttendedTransfer()` 신규; `executeWaitSIPEvent()` 신규 |
| `internal/engine/engine.go` | 수정 | `executor` 필드 승격 (`*Executor`); `emitSIPEvent()` 신규 메서드 |
| `internal/engine/events.go` | 수정 | `WithSIPMessage()` variadic `note` 파라미터 추가 |
| `frontend/src/.../types/scenario.ts` | 수정 | `COMMAND_TYPES`에 4개 추가; `CommandNodeData`에 `transferTarget`, `consultSessionKey` 추가 |
| `frontend/src/.../types/execution.ts` | 수정 | `SIPMessage`에 `note?` 필드 추가 |
| `frontend/src/.../components/node-palette.tsx` | 수정 | `SubSection` 컴포넌트 추가; Commands를 3개 서브섹션으로 재구성; Hold/Transfer 팔레트 항목 추가 |
| `frontend/src/.../components/properties/command-properties.tsx` | 수정 | Hold/Retrieve 설명 UI; BlindTransfer/AttendedTransfer `transferTarget` 입력 추가 |
| `frontend/src/.../components/properties/event-properties.tsx` | 수정 | HELD/RETRIEVED/TRANSFERRED/NOTIFY 이벤트 속성 (timeout 기존 패턴 재사용) |
| `frontend/src/.../components/execution-log.tsx` | 수정 | 인스턴스 필터 드롭다운 추가 |
| `frontend/src/.../components/execution-timeline.tsx` | 수정 | 메서드별 색상 구분 확장; `note` 필드 레이블 표시 |

**새로 생성할 파일: 없음.** 모든 변경은 기존 파일 수정이다.

---

## 아키텍처 리스크 및 완화

### 리스크 1: MediaSession.Mode 직접 조작

**상황:** `dialog.Media().MediaSession().Mode = "sendonly"` 후 `ReInvite()` 호출하는 패턴은 diago 공개 API가 아닌 내부 상태를 직접 변경한다.

**근거:** `MediaSession.Mode` 필드는 `media_session.go:102`에서 exported 필드로 공개되어 있고, `LocalSDP()`가 이 필드를 읽어 SDP를 생성함이 `media_session.go:403`에서 확인된다. `ReInvite()`는 `LocalSDP()`를 사용함이 `dialog_server_session.go:333`에서 확인된다. diago 공개 API 범위 안이다.

**완화:** 다음 버전에서 diago가 `Hold()` 전용 API를 제공한다면 교체한다. 현재는 가장 명확한 경로다.

**신뢰도: HIGH**

### 리스크 2: AttendedTransfer의 Replaces 헤더 구성

**상황:** `sipgo.DialogClientSession`의 `InviteResponse.To()`, `InviteRequest.From()`, `CallID` 접근이 `diago.DialogSession` 인터페이스를 통해서는 직접 불가능하다. `DialogSIP()` 메서드가 `*sipgo.Dialog`를 반환하므로 이를 통해 접근한다.

**근거:** `diago.DialogSession` 인터페이스(`dialog_session.go:17-25`)에 `DialogSIP() *sipgo.Dialog`가 있다. `sipgo.Dialog`는 `CallID`, `InviteRequest`, `InviteResponse`를 공개 필드로 보유한다. 확인 필요: `sipgo.Dialog.CallID` 타입과 `InviteResponse.To().Params.Get("tag")` API.

**완화:** 구현 시 sipgo v1.2.0 소스를 직접 확인하여 태그 추출 방법 검증. 테스트 케이스로 tag 추출 검증.

**신뢰도: MEDIUM** (sipgo Dialog 구조 직접 소스 미확인)

### 리스크 3: executeAnswer() 수정이 기존 테스트에 영향

**상황:** `executeAnswer()`가 `serverSession.Answer()`에서 `serverSession.AnswerOptions(opts)`로 변경된다.

**완화:** `AnswerOptions`의 `OnMediaUpdate`와 `OnRefer`가 nil이어도 기존 동작과 동일하다(`dialog_server_session.go:173-194`에서 확인). 기존 테스트는 통과해야 한다.

**신뢰도: HIGH**

### 리스크 4: AttendedTransfer 복잡도

**상황:** Attended Transfer는 타이밍에 민감하다. Consultation call 실패, Hold 실패, REFER 실패 각각에 대한 롤백 로직이 필요하다.

**완화:** 각 단계마다 에러 핸들링과 롤백(Hold 복원) 구현. 인수 테스트 시나리오를 단계별로 수립.

**신뢰도: MEDIUM** (실제 SIP 환경에서 엣지 케이스 많음)

---

## Sources

- diago v0.27.0 소스 직접 확인:
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go` — DialogSession 인터페이스
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session.go` — Refer(), ReferOptions(), ReInvite()
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go` — Refer(), ReInvite(), AnswerOptions
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_media.go` — MediaSession(), StopRTP(), StartRTP()
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/media_session.go` — Mode 필드, StopRTP/StartRTP
  - `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/sdp/utils.go` — ModeSendonly, ModeSendrecv, ModeRecvonly 상수
- [RFC 3515 — The Session Initiation Protocol (SIP) Refer Method](https://datatracker.ietf.org/doc/html/rfc3515)
- [RFC 3891 — The Session Initiation Protocol (SIP) "Replaces" Header](https://datatracker.ietf.org/doc/html/rfc3891)
- 기존 sipflow 소스: `internal/engine/executor.go`, `graph.go`, `instance_manager.go`, `events.go`
