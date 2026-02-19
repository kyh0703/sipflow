# Phase 10: Hold/Retrieve Backend - Research

**Researched:** 2026-02-19
**Domain:** diago v0.27.0 Re-INVITE / MediaSession / AnswerOptions — Go SIP Hold 구현
**Confidence:** HIGH (diago 소스 직접 확인)

---

## Summary

Phase 10의 구현 범위는 다음 네 가지다: Hold Command (Re-INVITE sendonly 발신), Retrieve Command (Re-INVITE sendrecv 발신), HeldEvent (상대방 Re-INVITE sendonly 감지), RetrievedEvent (상대방 Re-INVITE sendrecv 감지). 그리고 이 모든 것의 선결 조건인 `executeAnswer()` → `AnswerOptions()` 리팩토링이 포함된다.

diago v0.27.0은 Hold/Retrieve를 위한 전용 `Hold()` API가 없다. 대신 `MediaSession.Mode` 필드를 직접 설정한 후 `ReInvite(ctx)` 메서드를 호출하는 조합으로 구현한다. 이 패턴은 diago 공개 exported 필드를 사용하므로 안전하다. `DialogClientSession.ReInvite()`와 `DialogServerSession.ReInvite()` 모두 현재 `mediaSession.LocalSDP()`를 사용해 SDP를 생성하며, `LocalSDP()`는 `Mode` 필드를 그대로 반영한다.

상대방 Hold/Retrieve 감지(HeldEvent/RetrievedEvent)에는 중요한 버그가 있다. `AnswerOptions.OnMediaUpdate` 콜백에서 `d.MediaSession().Mode`를 읽어도 항상 `sendrecv`가 반환된다. 이는 diago `MediaSession.Fork()`가 Mode를 항상 `sdp.ModeSendrecv`로 하드코딩하기 때문이다 (`media_session.go:259`). 따라서 `Mode` 필드 대신 원격 SDP 바이트를 직접 파싱하여 `a=sendonly` / `a=sendrecv` 속성을 확인해야 한다. diago v0.27.0에서 `onMediaUpdate` 콜백이 받는 `*DialogMedia`에는 원본 SDP 바이트에 접근할 방법이 없으므로, `d.mediaSession.sdp`가 private 필드임을 고려할 때 `d.MediaSession().LocalSDP()`를 파싱하거나 별도의 SDP 파싱 접근법이 필요하다.

**주요 권장사항:** Hold 발신은 `Mode=sendonly` + `ReInvite()` 조합으로 즉시 구현. HeldEvent 감지는 `onMediaUpdate` 콜백에서 `bytes.Contains(sdp, "a=sendonly")` 방식으로 원격 SDP 방향을 파싱하거나, `req.Body()`를 클로저로 캡처하는 우회 패턴 사용.

---

## Standard Stack

이 페이즈에서 새 라이브러리 추가는 없다. 기존 스택으로 모두 구현 가능하다.

### Core
| 라이브러리 | 버전 | 목적 | 표준인 이유 |
|-----------|------|------|------------|
| `github.com/emiago/diago` | v0.27.0 | SIP UA, Re-INVITE, AnswerOptions | 프로젝트 전체 SIP 스택 |
| `github.com/emiago/diago/media` | v0.27.0 | MediaSession.Mode 조작 | diago 내장 패키지 |
| `github.com/emiago/diago/media/sdp` | v0.27.0 | Mode 상수 (ModeSendonly, ModeSendrecv) | diago 내장 패키지 |
| Go standard library | 1.21+ | `bytes`, `strings`, `context`, `sync` | 표준 라이브러리 |

### 확인된 API (소스 직접 검증)
| API | 파일 | 역할 |
|-----|------|------|
| `DialogClientSession.ReInvite(ctx)` | `dialog_client_session.go:433` | Hold/Retrieve Re-INVITE 발신 (클라이언트 측) |
| `DialogServerSession.ReInvite(ctx)` | `dialog_server_session.go:332` | Hold/Retrieve Re-INVITE 발신 (서버 측) |
| `MediaSession.Mode string` | `media_session.go:102` | SDP direction 제어 — exported 필드 |
| `sdp.ModeSendonly` | `media/sdp/utils.go:31` | "sendonly" 상수 |
| `sdp.ModeSendrecv` | `media/sdp/utils.go:30` | "sendrecv" 상수 |
| `AnswerOptions.OnMediaUpdate func(*DialogMedia)` | `dialog_server_session.go:152` | Re-INVITE 수신 감지 콜백 |
| `AnswerOptions.OnRefer func(*DialogClientSession) error` | `dialog_server_session.go:160` | REFER 수신 감지 콜백 |
| `DialogServerSession.AnswerOptions(opt AnswerOptions) error` | `dialog_server_session.go:173` | 콜백 포함 Answer |
| `MediaSession.Fork() *MediaSession` | `media_session.go:253` | Re-INVITE 시 미디어 세션 복사 |

**설치:** 기존 `go.mod`에 이미 포함됨. 추가 `go get` 불필요.

---

## Architecture Patterns

### 권장 수정 파일 구조
```
internal/engine/
├── executor.go       # 주요 수정: executeAnswer(), executeHold(), executeRetrieve(),
│                     #   executeWaitSIPEvent(), SessionStore sipEventSubs 추가
├── engine.go         # executor 필드 승격, emitSIPEvent() 추가
├── events.go         # WithSIPMessage() note 파라미터 추가
└── graph.go          # GraphNode TransferTarget 필드 추가 (v1.2 전체 대비)
```

### 패턴 1: Hold Command 구현

**설명:** `MediaSession.Mode`를 `sdp.ModeSendonly`로 설정 후 `ReInvite()` 호출. `DialogSession` 인터페이스가 `ReInvite()`를 직접 노출하지 않으므로 타입 어서션 필요.

**사용 시점:** Hold Command 노드 실행 시

```go
// 소스: diago v0.27.0/dialog_client_session.go:433, dialog_server_session.go:332
func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Hold: sending Re-INVITE (sendonly)", "info")

    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("Hold: no active dialog for instance %s", instanceID)
    }

    // MediaSession.Mode는 exported 필드 (media_session.go:102)
    mediaSess := dialog.Media().MediaSession()
    if mediaSess == nil {
        return fmt.Errorf("Hold: no media session available")
    }
    mediaSess.Mode = sdp.ModeSendonly // "sendonly"

    // DialogSession 인터페이스에 ReInvite()가 없으므로 타입 어서션
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
        WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly"))
    return nil
}
```

### 패턴 2: Retrieve Command 구현

**설명:** `Mode`를 `sdp.ModeSendrecv`로 복원 후 `ReInvite()`.

```go
// 소스: diago v0.27.0/dialog_client_session.go:433
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
    mediaSess.Mode = sdp.ModeSendrecv // "sendrecv"

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
        WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendrecv"))
    return nil
}
```

### 패턴 3: executeAnswer() → AnswerOptions() 리팩토링

**설명:** 콜백 등록을 위해 `serverSession.Answer()` → `serverSession.AnswerOptions(opts)` 변경. `OnMediaUpdate`와 `OnRefer`가 nil이어도 기존 동작과 동일하다 (`dialog_server_session.go:173-194`에서 확인).

**중요:** `OnMediaUpdate` 콜백에서 `d.MediaSession().Mode`를 읽으면 버그로 항상 `sendrecv`가 반환됨. 대신 원격 SDP 파싱이 필요함.

```go
// 소스: diago v0.27.0/dialog_server_session.go:173
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Answer incoming call", "info")

    serverSession, exists := ex.sessions.GetServerSession(instanceID)
    if !exists {
        return fmt.Errorf("no incoming dialog to answer for instance %s", instanceID)
    }

    // v1.2: AnswerOptions로 변경하여 OnMediaUpdate 콜백 등록
    opts := diago.AnswerOptions{
        OnMediaUpdate: func(d *diago.DialogMedia) {
            // 중요: d.MediaSession().Mode는 항상 sendrecv를 반환 (Fork() 버그 #125)
            // 대신 LocalSDP()를 파싱하여 원격 방향을 추론
            // LocalSDP()는 우리가 응답으로 보낸 SDP — Hold를 받으면 recvonly, Retrieve이면 sendrecv
            localSDP := string(d.MediaSession().LocalSDP())
            if strings.Contains(localSDP, "a=recvonly") {
                // 우리가 recvonly로 응답 → 원격이 sendonly(=Hold)를 보낸 것
                ex.engine.emitActionLog("", instanceID, "Remote hold detected (HELD)", "info")
                ex.engine.emitSIPEvent(instanceID, "HELD")
            } else if strings.Contains(localSDP, "a=sendrecv") {
                // 우리가 sendrecv로 응답 → 원격이 sendrecv(=Retrieve)를 보낸 것
                ex.engine.emitActionLog("", instanceID, "Remote retrieve detected (RETRIEVED)", "info")
                ex.engine.emitSIPEvent(instanceID, "RETRIEVED")
            }
        },
        OnRefer: func(referDialog *diago.DialogClientSession) error {
            // Phase 11 (BlindTransfer)에서 사용 — 지금은 TRANSFERRED 이벤트만 발행
            ex.engine.emitActionLog("", instanceID, "Incoming REFER received (TRANSFERRED)", "info")
            ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")
            return nil
        },
    }

    if err := serverSession.AnswerOptions(opts); err != nil {
        errMsg := err.Error()
        if strings.Contains(strings.ToLower(errMsg), "codec") ||
            strings.Contains(strings.ToLower(errMsg), "media") ||
            strings.Contains(strings.ToLower(errMsg), "negotiat") {
            return fmt.Errorf("codec negotiation failed (488 Not Acceptable): %w", err)
        }
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

### 패턴 4: SessionStore SIP 이벤트 버스

**설명:** HeldEvent/RetrievedEvent가 블로킹 대기하려면 이벤트 채널 메커니즘이 필요. 기존 `incomingCh` 패턴과 동일한 원리.

```go
// executor.go — SessionStore 확장
type SessionStore struct {
    mu             sync.RWMutex
    dialogs        map[string]diago.DialogSession
    serverSessions map[string]*diago.DialogServerSession
    // v1.2 신규: SIP 이벤트 구독 채널 맵
    // 키: "{instanceID}:{eventType}", 값: 구독 채널 슬라이스
    sipEventSubs   map[string][]chan struct{}
}

func NewSessionStore() *SessionStore {
    return &SessionStore{
        dialogs:        make(map[string]diago.DialogSession),
        serverSessions: make(map[string]*diago.DialogServerSession),
        sipEventSubs:   make(map[string][]chan struct{}),
    }
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

### 패턴 5: Engine.executor 필드 승격

**설명:** `emitSIPEvent()`가 `SessionStore`에 접근하려면 `Engine`이 `Executor` 참조를 보유해야 한다. 현재 `executor`는 `StartScenario()` 내부 로컬 변수다.

```go
// engine.go — Engine 구조체 수정
type Engine struct {
    ctx         context.Context
    repo        *scenario.Repository
    emitter     EventEmitter
    im          *InstanceManager
    executor    *Executor   // v1.2 신규: SIP 이벤트 라우팅을 위해 필드로 승격
    mu          sync.Mutex
    running     bool
    scenarioID  string
    cancelFunc  context.CancelFunc
    wg          sync.WaitGroup
}

// StartScenario()에서 로컬 변수 대신 필드에 할당
// executor := NewExecutor(e, e.im) → e.executor = NewExecutor(e, e.im)

// engine.go 또는 events.go — 신규 메서드
func (e *Engine) emitSIPEvent(instanceID, eventType string) {
    e.mu.Lock()
    ex := e.executor
    e.mu.Unlock()
    if ex != nil {
        ex.sessions.emitSIPEvent(instanceID, eventType)
    }
}
```

### 패턴 6: executeWaitSIPEvent — HELD/RETRIEVED 이벤트 대기

**설명:** 이벤트 노드가 채널에서 이벤트를 블로킹 대기하는 패턴. 기존 `executeIncoming`의 `incomingCh` 채널 패턴과 동일한 구조.

```go
// executor.go
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

// executeEvent() 스위치 확장
case "HELD":      return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "HELD", timeout)
case "RETRIEVED": return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "RETRIEVED", timeout)
```

### 패턴 7: WithSIPMessage note 파라미터 추가

**설명:** Hold/Retrieve Re-INVITE를 일반 INVITE와 구분하기 위해 note 필드 추가. variadic 파라미터로 기존 호출 코드 변경 없음.

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

### 피해야 할 안티패턴

- **`d.MediaSession().Mode` 읽기:** `onMediaUpdate` 콜백에서 Mode를 읽으면 `Fork()` 버그로 항상 `sendrecv`. `LocalSDP()`를 파싱하거나 `strings.Contains(sDP, "a=recvonly")` 방식 사용.
- **`ReInvite()` 후 Mode 방치:** Hold 후 `Mode=sendonly`가 지속된다. Retrieve 시 반드시 `Mode=sendrecv`로 복원.
- **락 안에서 `emitSIPEvent()` 호출:** `sdpReInviteUnsafe()`는 `d.mu.Lock()` 안에서 호출된다. `onMediaUpdate`에서 다른 락을 잡으면 데드락 가능. 콜백은 빠르게 완료하고 채널 신호만 보낼 것.

---

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 사용 | 이유 |
|------|-------------|----------|------|
| SDP direction 읽기 | 직접 정규식 파싱 | `strings.Contains(sDP, "a=sendonly")` + `LocalSDP()` | diago 내부 SDP 구조 활용 |
| Re-INVITE | 직접 SIP 요청 빌드 | `MediaSession.Mode` + `ReInvite()` | diago가 ACK, 491 처리 등 자동화 |
| 이벤트 대기 | time.Sleep 폴링 | `chan struct{}` 구독/발행 패턴 | 타임아웃 정확성, context 취소 지원 |
| Hold 상태 추적 | 별도 상태 변수 | `MediaSession.Mode` 필드 | diago가 이미 상태를 보유 |

**핵심 통찰:** diago의 Re-INVITE 구현(`DialogClientSession.reInviteDo()`)은 491 Request Pending 자동 재시도, ACK 자동 전송, Contact 업데이트를 처리한다. 직접 구현하면 이 엣지 케이스를 모두 처리해야 한다.

---

## Common Pitfalls

### 함정 1: Fork() 버그 — Mode 항상 sendrecv

**발생하는 문제:** `onMediaUpdate` 콜백에서 `d.MediaSession().Mode`를 읽으면 항상 `"sendrecv"`를 반환하여 Hold/Retrieve를 구분할 수 없다.

**발생 이유:** `sdpUpdateUnsafe()`가 내부적으로 `d.mediaSession.Fork()`를 호출하고, `Fork()` 구현이 `Mode: sdp.ModeSendrecv`로 하드코딩되어 있다 (`media_session.go:259`).

```go
// Fork() 소스 - 버그 위치
func (s *MediaSession) Fork() *MediaSession {
    cp := MediaSession{
        ...
        Mode: sdp.ModeSendrecv,  // 항상 sendrecv로 초기화 — 버그의 원인
        ...
    }
    return &cp
}
```

**피하는 방법:** `MediaSession().Mode` 대신 `LocalSDP()` 파싱. 우리가 응답한 SDP의 mode를 읽는 것이 더 신뢰성 있다.

```go
// 올바른 방법
localSDP := string(d.MediaSession().LocalSDP())
if strings.Contains(localSDP, "a=recvonly") {
    // Hold: 원격이 sendonly를 보냈고, 우리는 recvonly로 응답
    ex.engine.emitSIPEvent(instanceID, "HELD")
} else if strings.Contains(localSDP, "a=sendrecv") {
    // Retrieve: 원격이 sendrecv를 보냈고, 우리도 sendrecv로 응답
    ex.engine.emitSIPEvent(instanceID, "RETRIEVED")
}
```

**경고 신호:** HeldEvent 노드가 절대 완료되지 않고 타임아웃되는 경우.

**신뢰도:** HIGH — diago 소스 `media_session.go:253-267`에서 직접 확인됨.

---

### 함정 2: onMediaUpdate 콜백에서 데드락

**발생하는 문제:** `onMediaUpdate` 콜백이 `dialog.Media().mediaSession.mu` 락이 잡힌 상태에서 호출될 수 있다. 콜백 내부에서 동일 락을 잡으면 데드락.

**발생 이유:** `sdpReInviteUnsafe()`는 `d.mu.Lock()` 안에서 호출되고, 이 안에서 `onMediaUpdate(d)`가 실행된다.

```go
// dialog_media.go - 위험 지점
func (d *DialogMedia) sdpReInviteUnsafe(sdp []byte) error {
    // ...
    if d.onMediaUpdate != nil {
        d.onMediaUpdate(d)  // 락 안에서 호출됨
    }
    return nil
}
```

**피하는 방법:** 콜백 내부에서 `dialog.Media()` 잠금이 필요한 메서드 호출 금지. 채널에만 신호를 보내고 즉시 반환.

```go
OnMediaUpdate: func(d *diago.DialogMedia) {
    localSDP := string(d.MediaSession().LocalSDP()) // MediaSession()은 내부적으로 mu.Lock() 호출 — 중첩 락 위험
    // ...
    ch <- struct{}{} // 채널 신호만 보내고 반환
},
```

**더 안전한 방법:** 콜백 진입 시 goroutine으로 실행.

```go
OnMediaUpdate: func(d *diago.DialogMedia) {
    // d.MediaSession()은 mu.Lock()을 사용하므로 직접 접근 대신 LocalSDP 추출을 빠르게 수행
    // (sdpReInviteUnsafe 후 mediaSession은 이미 교체되어 있음)
    // onMediaUpdate는 d.mu.Lock() 안에서 호출되지 않으므로 (sdpReInviteUnsafe 후)
    // 실제로는 락 해제 후 호출됨 — 확인 필요
}
```

**실제 분석:** `handleMediaUpdate()`에서 `d.mu.Lock()` 후 `sdpReInviteUnsafe()` 호출, 그 안에서 `onMediaUpdate` 호출됨. 즉, 콜백은 `d.mu` 락 안에서 실행된다. `d.MediaSession()`도 내부적으로 `d.mu.Lock()` 재진입을 시도한다.

```go
// dialog_media.go:194 - MediaSession()은 mu.Lock()을 사용
func (d *DialogMedia) MediaSession() *media.MediaSession {
    d.mu.Lock()
    defer d.mu.Unlock()
    return d.mediaSession
}
```

따라서 `onMediaUpdate` 콜백 안에서 `d.MediaSession()` 호출은 데드락을 일으킬 수 있다. **안전한 방법:** `d.mediaSession` 필드에 접근하지 않고 goroutine으로 분리하거나, diago가 내부적으로 콜백을 mutex 안에서 호출하는지 주의.

**경고 신호:** 콜백 실행 후 프로그램이 무한 대기 상태.

**신뢰도:** HIGH — `dialog_media.go:200-219`, `dialog_media.go:194-198`에서 직접 확인됨.

---

### 함정 3: diago #110 — 빈 SDP nil 크래시

**발생하는 문제:** 상대방이 빈 SDP body (keep-alive Re-INVITE)를 보낼 때, `sdpUpdateUnsafe()` 내부의 `mediaSession.Fork().RemoteSDP(nil)` 호출로 패닉 또는 에러 발생 가능.

**발생 이유:** `handleMediaUpdate()`는 `req.Body() != nil` 체크 후에만 `sdpReInviteUnsafe()`를 호출한다 (`dialog_media.go:207`). 그러나 `sdpReInviteUnsafe()` 내부의 `sdpUpdateUnsafe()` 자체는 nil 체크 없이 `RemoteSDP(sdp)`를 호출한다.

**피하는 방법:** diago v0.27.0에서 `handleMediaUpdate`는 nil body를 이미 체크한다 (`dialog_media.go:207`). 그러나 에러 발생 시 로그를 캐치하여 크래시 방지.

```go
// onMediaUpdate 콜백에서 방어적으로
OnMediaUpdate: func(d *diago.DialogMedia) {
    // 에러 복구 래핑
    defer func() {
        if r := recover(); r != nil {
            ex.engine.emitActionLog("", instanceID, fmt.Sprintf("onMediaUpdate panic: %v", r), "warn")
        }
    }()
    // ... 실제 로직
}
```

**경고 신호:** `"sdp update media remote SDP applying failed"` 에러 메시지.

**신뢰도:** MEDIUM — 이슈 #110이 오픈 상태이나, `dialog_media.go:207`의 nil 체크로 이미 완화됨.

---

### 함정 4: Re-INVITE 후 Mode 복원 누락

**발생하는 문제:** Hold 후 Retrieve 없이 통화가 종료되면 다음 통화에서 `Mode=sendonly`가 지속될 수 있다.

**발생 이유:** `MediaSession.Mode`는 Dialog 인스턴스에 귀속된다. 새 통화는 새 Dialog를 생성하므로 실제로는 문제없으나, 시나리오 재실행 시 `SessionStore` 재사용 패턴이면 주의 필요.

**피하는 방법:** Executor의 `cleanup()` 시점에 별도 처리 불필요. `CloseAll()`이 Dialog를 닫고 새 통화는 새 Dialog를 생성한다.

---

### 함정 5: executeAnswer() 코덱 협상 실패 처리

**발생하는 문제:** `AnswerOptions` 전환 후 코덱 협상 실패 에러가 다르게 동작할 수 있다.

**피하는 방법:** 기존 `executeAnswer()`의 에러 처리 로직(`strings.Contains(errMsg, "codec")` 등)을 그대로 유지.

---

## Code Examples

### 예시 1: 완전한 executeHold 구현

```go
// 소스: diago v0.27.0/dialog_client_session.go:433, media/media_session.go:102
import (
    "context"
    "fmt"
    "github.com/emiago/diago/media/sdp"
)

func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
    ex.engine.emitActionLog(node.ID, instanceID, "Hold: sending Re-INVITE (sendonly)", "info")

    dialog, exists := ex.sessions.GetDialog(instanceID)
    if !exists {
        return fmt.Errorf("Hold: no active dialog for instance %s", instanceID)
    }

    mediaSess := dialog.Media().MediaSession()
    if mediaSess == nil {
        return fmt.Errorf("Hold: no media session available")
    }

    // sdp.ModeSendonly = "sendonly" (media/sdp/utils.go:31에서 확인)
    mediaSess.Mode = sdp.ModeSendonly

    type reInviter interface {
        ReInvite(ctx context.Context) error
    }
    ri, ok := dialog.(reInviter)
    if !ok {
        return fmt.Errorf("Hold: dialog type %T does not support ReInvite", dialog)
    }

    if err := ri.ReInvite(ctx); err != nil {
        // Hold 실패 시 Mode 복원
        mediaSess.Mode = sdp.ModeSendrecv
        return fmt.Errorf("Hold Re-INVITE failed: %w", err)
    }

    ex.engine.emitActionLog(node.ID, instanceID, "Hold succeeded (Re-INVITE sendonly sent)", "info",
        WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly"))
    return nil
}
```

### 예시 2: onMediaUpdate 콜백 안전 구현

```go
// 소스: diago v0.27.0/dialog_server_session.go:150-167, dialog_media.go:200-235
// 주의: 콜백은 d.mu 락 안에서 호출됨. d.MediaSession() 직접 호출 피할 것.

OnMediaUpdate: func(d *diago.DialogMedia) {
    // goroutine으로 분리하여 락 의존성 회피
    go func() {
        // LocalSDP()는 d.mu.Lock()을 사용하므로 goroutine 안에서 호출
        localSDP := string(d.MediaSession().LocalSDP())
        if strings.Contains(localSDP, "a=recvonly") {
            ex.engine.emitActionLog("", instanceID, "HELD: remote sendonly detected", "info")
            ex.engine.emitSIPEvent(instanceID, "HELD")
        } else if strings.Contains(localSDP, "a=sendrecv") {
            ex.engine.emitActionLog("", instanceID, "RETRIEVED: remote sendrecv detected", "info")
            ex.engine.emitSIPEvent(instanceID, "RETRIEVED")
        }
    }()
},
```

**락 분석 재확인:** `handleMediaUpdate()`의 호출 경로:
1. `d.mu.Lock()` — `handleMediaUpdate()` 진입 시
2. `sdpReInviteUnsafe()` 호출
3. `onMediaUpdate(d)` 호출 — 여전히 `d.mu` 락 안
4. `d.mu.Unlock()` — `handleMediaUpdate()` 종료 시

따라서 콜백 안에서 `d.MediaSession()`(내부에서 `d.mu.Lock()`)을 직접 호출하면 데드락. **goroutine으로 분리 필수.**

### 예시 3: engine.go executor 필드 승격

```go
// engine.go
type Engine struct {
    ctx         context.Context
    repo        *scenario.Repository
    emitter     EventEmitter
    im          *InstanceManager
    executor    *Executor   // v1.2: SIP 이벤트 라우팅을 위해 필드로 승격
    mu          sync.Mutex
    running     bool
    scenarioID  string
    cancelFunc  context.CancelFunc
    wg          sync.WaitGroup
}

// StartScenario()에서:
// 기존: executor := NewExecutor(e, e.im)
// 변경: e.executor = NewExecutor(e, e.im)
// cleanup() 인자도 제거 가능: cleanup(executor) → cleanup()

func (e *Engine) emitSIPEvent(instanceID, eventType string) {
    e.mu.Lock()
    ex := e.executor
    e.mu.Unlock()
    if ex != nil {
        ex.sessions.emitSIPEvent(instanceID, eventType)
    }
}

// cleanup 변경
func (e *Engine) cleanup() {
    e.emitActionLog("", "", "Starting cleanup", "info")
    ctx := context.Background()
    e.executor.sessions.HangupAll(ctx)
    e.executor.sessions.CloseAll()
    e.im.Cleanup()
    e.emitActionLog("", "", "Cleanup completed", "info")

    // 시나리오 완료 후 executor 초기화
    e.mu.Lock()
    e.executor = nil
    e.mu.Unlock()
}
```

---

## State of the Art

| 이전 접근법 | 현재 접근법 | 변경 시점 | 영향 |
|------------|-----------|----------|------|
| `serverSession.Answer()` | `serverSession.AnswerOptions(opts)` | Phase 10 | 콜백 등록 가능 — Phase 10 선결조건 |
| 없음 (Hold API 없음) | `Mode=sendonly` + `ReInvite()` | Phase 10 | diago 공식 Hold() API 부재로 인한 우회 |
| 없음 | `SessionStore.sipEventSubs` 이벤트 버스 | Phase 10 | HELD/RETRIEVED 이벤트 대기 인프라 |

**폐기됨/구식:**
- `serverSession.Answer()` 직접 호출 — `AnswerOptions()`로 대체. 단, 기존 동작과 완전히 호환됨.

---

## Open Questions

### Q1: onMediaUpdate 콜백 락 의존성 완전 검증

**아는 것:** `handleMediaUpdate()`는 `d.mu.Lock()` 안에서 `sdpReInviteUnsafe()`를 호출하고, 그 안에서 `onMediaUpdate(d)`가 실행됨.

**불명확한 것:** `DialogServerSession`의 경우 `readReInvite()` → `handleMediaUpdate()`가 정확히 어느 시점에 락을 잡는지. `DialogServerSession.handleMediaUpdate()`가 서버 세션에서도 동일하게 `d.mu.Lock()` 안에서 실행되는지.

**권장사항:** goroutine으로 콜백 분리하여 락 문제를 원천 회피. 성능 오버헤드 무시할 수준.

### Q2: LocalSDP() 파싱으로 Hold 감지 신뢰성

**아는 것:** Hold 수신 시 우리(수신 측)는 `a=recvonly`로 응답. Retrieve 수신 시 `a=sendrecv`로 응답.

**불명확한 것:** `LocalSDP()`가 Re-INVITE 처리 완료 후 어느 시점에 업데이트되는지. 콜백 호출 시점에 이미 새 LocalSDP가 생성되어 있는지.

**권장사항:** 구현 후 실제 SIP 트래픽으로 `LocalSDP()` 값 검증. Retrieve 후 LocalSDP가 `a=sendrecv`인지 로그로 확인.

---

## Sources

### Primary (HIGH 신뢰도 — 소스 직접 확인)
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_client_session.go:433` — `ReInvite()` 구현 확인
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go:150-194` — `AnswerOptions`, `AnswerOptions()` 구현
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_server_session.go:332` — `DialogServerSession.ReInvite()` 구현
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_media.go:200-235` — `handleMediaUpdate()`, `sdpReInviteUnsafe()` 구현
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_media.go:194-198` — `MediaSession()` 락 동작
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/media_session.go:90-157` — `MediaSession` 구조체, `Mode` 필드
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/media_session.go:253-267` — `Fork()` 구현 및 버그 위치 (`Mode: sdp.ModeSendrecv` 하드코딩)
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/media/sdp/utils.go:27-32` — Mode 상수 (`ModeSendonly = "sendonly"` 등)
- `/home/overthinker/go/pkg/mod/github.com/emiago/diago@v0.27.0/dialog_session.go:17-25` — `DialogSession` 인터페이스 (`ReInvite` 미포함 확인)
- `/home/overthinker/Project/sipflow/internal/engine/executor.go` — 기존 코드 구조 파악
- `/home/overthinker/Project/sipflow/internal/engine/engine.go` — executor 로컬 변수 패턴 확인
- `/home/overthinker/Project/sipflow/internal/engine/events.go` — `WithSIPMessage` 현재 시그니처

### Secondary (MEDIUM 신뢰도)
- `.planning/research/SUMMARY.md` — v1.2 사전 연구 요약 (버그 #110, #125, PR #126 현황)
- `.planning/research/ARCHITECTURE.md` — 설계 코드 예시 (구현 가이드)
- `.planning/STATE.md` — 프로젝트 설계 결정 누적

### Tertiary (LOW 신뢰도)
- diago GitHub Issues #110, #125 — 버그 현황 (SUMMARY.md에서 2026-02-19 기준으로 확인된 상태)

---

## Metadata

**신뢰도 세분화:**
- Hold/Retrieve API: HIGH — diago 소스 직접 확인
- AnswerOptions 콜백: HIGH — 소스 직접 확인
- Fork() 버그 (Mode 리셋): HIGH — 소스 코드 `media_session.go:259`에서 직접 확인
- onMediaUpdate 락 동작: HIGH — `dialog_media.go:200-235` 코드 경로 추적 확인
- LocalSDP() 파싱 감지 신뢰성: MEDIUM — 논리적으로 맞으나 실행 시점 검증 필요
- SessionStore 이벤트 버스: HIGH — 기존 incomingCh 패턴과 동일 구조

**연구 날짜:** 2026-02-19
**유효 기한:** 30일 (diago v0.27.0 고정, 안정적)
