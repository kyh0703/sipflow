# Pitfalls Research: Transfer/Hold + UI 개선 (v1.2)

**도메인:** SIP Call Flow Simulator — Transfer(Blind/Attended), Hold/Retrieve, UI 개선
**리서치일:** 2026-02-19
**기반 시스템:** SIPFLOW v1.1 (diago v0.27.0, Go 1.23, XYFlow 12.x)

---

## Executive Summary

v1.2에서 발생할 수 있는 세 가지 치명적 위험:

1. **SessionStore 1:1 키 충돌** — Attended Transfer에서 consultation call의 새 dialog가 기존 dialog를 덮어쓴다. 현재 `map[instanceID]dialog` 구조는 인스턴스당 dialog 1개만 지원하므로, 원래 통화가 조용히 유실된다.

2. **diago Hold API 미완성** — diago v0.27.0에 `Hold()`/`Unhold()` 메서드가 없다 (이슈 #95, #110 모두 open). ReInvite + SDP 수동 조작으로 구현해야 하며, 빈 SDP를 수신하면 `"sdp update media remote SDP applying failed: Media not found for"` 에러가 발생한다 (이슈 #110).

3. **Refer 후 dialog 정리 타이밍** — RFC 3515에 따르면 REFER 후 BYE를 보내도 NOTIFY subscription이 종료될 때까지 dialog가 살아있어야 한다. 이를 무시하면 "481 Call/Transaction Does Not Exist"를 받거나 NOTIFY 수신 전에 dialog가 닫히는 race condition이 발생한다.

---

## 치명적 함정

### 함정 1: SessionStore 1:1 키 충돌 — Attended Transfer의 다중 dialog

**심각도:** 치명적

**문제:**
Attended Transfer는 하나의 인스턴스가 두 개의 동시 dialog를 관리해야 한다:
- Dialog A: 원래 통화 (transferee와)
- Dialog B: consultation call (transfer target과)

현재 `SessionStore.dialogs`는 `map[string]diago.DialogSession` 구조로 instanceID를 키로 사용한다. `executeMakeCall`이 consultation call을 위해 `StoreDialog(instanceID, newDialog)`를 호출하면 Dialog A가 조용히 덮어쓰여진다.

```go
// 현재 코드 — 덮어쓰기 발생
func (ex *Executor) executeMakeCall(...) error {
    dialog, err := instance.UA.Invite(...)
    ex.sessions.StoreDialog(instanceID, dialog)  // ← 원래 dialog 덮어씀!
    ...
}
```

**원인:**
설계 당시 인스턴스당 1개 통화만 가정했다. `dialogs map[string]diago.DialogSession`의 키가 instanceID이므로 구조적으로 2개를 동시에 저장할 수 없다.

**경고 신호:**
- Attended Transfer 시나리오에서 transferee에게 BYE가 전송되지 않음
- Release 노드가 consultation call을 종료하고 원래 통화는 영구 hanging
- 로그에서 "no active dialog" 에러가 예상치 않은 시점에 발생
- `GetDialog(instanceID)`가 엉뚱한 dialog를 반환

**예방 전략:**
SessionStore를 1:N 구조로 확장해야 한다. 두 가지 접근 방식:

**옵션 A — dialog 역할 레이블 추가 (권장):**
```go
type SessionStore struct {
    mu             sync.RWMutex
    dialogs        map[string]map[string]diago.DialogSession        // instanceID -> role -> dialog
    serverSessions map[string]*diago.DialogServerSession
}

// 역할 상수
const (
    DialogRolePrimary      = "primary"      // 원래 통화
    DialogRoleConsultation = "consultation" // Attended Transfer 두 번째 leg
)

func (ss *SessionStore) StoreDialogWithRole(instanceID, role string, dialog diago.DialogSession) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    if ss.dialogs[instanceID] == nil {
        ss.dialogs[instanceID] = make(map[string]diago.DialogSession)
    }
    ss.dialogs[instanceID][role] = dialog
}
```

**옵션 B — dialog를 Call-ID로 키잉 (대안):**
```go
// dialogs map[callID]diago.DialogSession
// 단, diago.DialogSession 인터페이스에 Call-ID 접근이 없으므로
// DialogSIP().CallID()로 접근해야 함 (검증 필요)
```

옵션 A가 권장된다. 역할 기반 접근이 의도를 명확히 하고 기존 코드와의 하위 호환성을 유지하기 쉽다. `GetDialog(instanceID)` 기존 호출은 `GetDialog(instanceID, DialogRolePrimary)`로 마이그레이션하면 된다.

**영향 페이즈:** AttendedTransfer 구현 페이즈 (최우선 설계 결정)

---

### 함정 2: diago Hold/Unhold API 부재 + 빈 SDP 수신 크래시

**심각도:** 치명적

**문제 (A) — API 부재:**
diago v0.27.0에는 `Hold()`, `Unhold()`, `HoldMedia()` 메서드가 없다 (GitHub 이슈 #95, 라벨: "on roadmap, Open To Sponsor"). Hold를 구현하려면 `ReInvite()`를 수동으로 호출하고 SDP를 직접 조작해야 한다.

```go
// diago가 제공하는 것
func (d *DialogClientSession) ReInvite(ctx context.Context) error  // 현재 미디어 세션 기반 re-INVITE
func (d *DialogMedia) StopRTP(rw int8, dur time.Duration) error
func (d *DialogMedia) StartRTP(rw int8, dur time.Duration) error

// Hold를 위해 필요한 것 — diago가 제공하지 않음
// → SDP에 a=sendonly 또는 a=inactive 삽입
// → ReInvite 전송
// → 원래 IP 복원 후 Retrieve ReInvite
```

**문제 (B) — 빈 SDP 수신 크래시 (이슈 #110):**
상대방이 hold를 위해 빈 SDP body(`Content-Length: 0`)의 Re-INVITE를 전송하면 diago가 에러를 반환한다:

```
"sdp update media remote SDP applying failed: Media not found for"
```

이 에러는 `sdpUpdateUnsafe` 함수가 nil/empty SDP 체크를 하지 않아서 발생하며, 이슈 #110에서 확인된 알려진 버그다 (status: open, milestone: diago-stable-release).

**원인:**
- Hold API: diago가 아직 구현하지 않은 기능
- 빈 SDP: `sdpUpdateUnsafe`의 nil 체크 누락

**경고 신호:**
- Hold 명령 실행 시 "unsupported operation" 에러
- 상대방이 hold를 걸 때 `"sdp update media remote SDP applying failed"` 로그
- HoldEvent 대기 노드에서 타임아웃

**예방 전략:**

Hold 구현 — `StopRTP` + 수동 ReInvite 조합:
```go
func executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID, DialogRolePrimary)
    if !exists {
        return fmt.Errorf("no active dialog for Hold")
    }

    // 1. RTP 전송 중단 (sendonly 시뮬레이션)
    // rw: 1=write(send), 2=read(recv), 3=both
    if err := dialog.Media().StopRTP(3, 0); err != nil {
        return fmt.Errorf("StopRTP failed: %w", err)
    }

    // 2. ReInvite로 hold 신호 (SDP 조작은 diago 내부에서 처리)
    // 주의: diago가 자동으로 sendonly SDP를 생성하는지 검증 필요
    if err := dialog.(*diago.DialogClientSession).ReInvite(ctx); err != nil {
        return fmt.Errorf("Hold ReInvite failed: %w", err)
    }
    return nil
}
```

빈 SDP 수신 방어 — 상대방이 빈 SDP로 hold를 걸 때:
```go
// diago 이슈 #110 workaround: handleReInvite에서 빈 body 무시
// → diago를 fork하거나 패치할 필요가 있을 수 있음
// → 또는 OnDo() 훅으로 Re-INVITE body 전처리
// → 최소한: 에러를 catch하고 경고로 처리 (크래시 방지)
func executeHoldEvent(ctx context.Context, ...) error {
    // ... HoldEvent 대기 로직
    // 에러가 "sdp update" 관련이면 경고로 처리하고 hold 완료로 간주
}
```

**영향 페이즈:** Hold/Retrieve 구현 페이즈 (착수 전 diago API 동작 실험 필수)

---

### 함정 3: REFER 후 BYE 타이밍 — NOTIFY subscription 종료 전 dialog 닫힘

**심각도:** 치명적

**문제:**
RFC 3515에 따르면 REFER는 암묵적 subscription을 생성한다. BYE를 전송해도 NOTIFY subscription이 완전히 종료될 때까지 dialog가 살아있어야 한다. diago의 `Refer()` 문서는 "It is expected that after calling this you are hanging up call to send BYE"라고 명시하지만, BYE와 NOTIFY 사이의 타이밍을 명확히 정의하지 않는다.

```
Blind Transfer 흐름:
A -- REFER --> B
A <-- 202 Accepted -- B
A <-- NOTIFY (100 Trying) -- B   ← 이 NOTIFY가 도착하기 전에 BYE를 보내면?
A -- BYE --> B                   ← dialog가 닫힘
A <-- NOTIFY (200 OK) -- B       ← 481 Call/Transaction Does Not Exist 발생!
```

실제 race condition: `executeBlindTransfer`에서 `Refer()` 직후 `Hangup()` 또는 `Release` 노드로 즉시 이동하면 최종 NOTIFY가 도착하기 전에 dialog가 닫힐 수 있다.

**원인:**
- RFC 3515: REFER 후 BYE는 subscription 종료 후에 보내야 함
- diago `ReferClientOptions.OnNotify` 콜백이 있지만 subscription 완료를 보장하는 메커니즘이 없음
- SIPFLOW Executor는 Refer → 즉시 다음 노드로 진행하므로 NOTIFY 대기 없음

**경고 신호:**
- Blind Transfer 후 로그에 "481 Call/Transaction Does Not Exist"
- Transfer가 성공한 것처럼 보이지만 대상에게 연결이 안 됨
- `OnNotify` 콜백이 호출되지 않음 (dialog 먼저 닫혔기 때문)

**예방 전략:**

`ReferClientOptions.OnNotify` 콜백으로 NOTIFY 수신 후 BYE:
```go
func executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    dialog, exists := ex.sessions.GetDialog(instanceID, DialogRolePrimary)
    if !exists {
        return fmt.Errorf("no active dialog for BlindTransfer")
    }

    referTo := sip.Uri{...} // node.TargetURI 파싱

    notifyDone := make(chan int, 1)

    opts := diago.ReferClientOptions{
        OnNotify: func(statusCode int) {
            // NOTIFY 200 OK (또는 최종 응답) 수신 시
            notifyDone <- statusCode
        },
    }

    if err := dialog.(*diago.DialogClientSession).ReferOptions(ctx, referTo, opts); err != nil {
        return fmt.Errorf("Refer failed: %w", err)
    }

    // NOTIFY 최종 응답 대기 (최대 10초)
    select {
    case statusCode := <-notifyDone:
        if statusCode < 200 || statusCode >= 300 {
            return fmt.Errorf("transfer failed with status %d", statusCode)
        }
        // 이제 안전하게 BYE
        return dialog.Hangup(ctx)
    case <-ctx.Done():
        return ctx.Err()
    case <-time.After(10 * time.Second):
        // NOTIFY 타임아웃 — BYE 강행
        ex.engine.emitActionLog(node.ID, instanceID, "NOTIFY timeout, forcing BYE", "warn")
        _ = dialog.Hangup(ctx)
        return fmt.Errorf("REFER NOTIFY timeout")
    }
}
```

**영향 페이즈:** BlindTransfer 구현 페이즈

---

### 함정 4: Attended Transfer의 incomingCh 버퍼 포화

**심각도:** 치명적

**문제:**
현재 `incomingCh`는 버퍼 1인 채널이다:
```go
incomingCh: make(chan *diago.DialogServerSession, 1)
```

Attended Transfer 시나리오에서 하나의 인스턴스가 두 개의 incoming INVITE를 연속으로 받을 수 있다 (예: transfer target 역할을 하는 인스턴스). 첫 번째 INVITE가 채널에서 소비되기 전에 두 번째 INVITE가 도착하면, `Serve` 콜백이 두 번째 INVITE를 `incomingCh <-`에 전달하려 할 때 채널이 가득 차 blocking 또는 드롭이 발생한다.

```go
// Serve 콜백 — 현재 코드
go func(i *ManagedInstance, c context.Context) {
    _ = i.UA.Serve(c, func(inDialog *diago.DialogServerSession) {
        i.incomingCh <- inDialog  // ← 버퍼 1이므로 두 번째 INVITE 시 blocking!
    })
}(inst, instCtx)
```

**원인:**
Transfer 시나리오에서 한 인스턴스가 여러 INCOMING 이벤트를 처리해야 하는 경우를 설계에서 고려하지 않았다.

**경고 신호:**
- Attended Transfer 시나리오에서 두 번째 INCOMING 이벤트가 타임아웃
- 특정 시나리오에서 교착 상태 (goroutine 영구 blocking)
- `Serve` goroutine이 응답하지 않음 (두 번째 incomingCh 삽입에서 blocking)

**예방 전략:**

버퍼 크기를 늘리거나 non-blocking 전송으로 변경:
```go
// 옵션 A: 버퍼 확장
incomingCh: make(chan *diago.DialogServerSession, 10)

// 옵션 B: non-blocking 전송 + 드롭 경고 (더 안전)
go func(i *ManagedInstance, c context.Context) {
    _ = i.UA.Serve(c, func(inDialog *diago.DialogServerSession) {
        select {
        case i.incomingCh <- inDialog:
        default:
            // 채널 가득 참 — 이 INVITE는 처리 불가
            log.Warn("incomingCh full, dropping INVITE")
            _ = inDialog.Respond(sip.StatusBusyHere)
        }
    })
}(inst, instCtx)
```

**영향 페이즈:** AttendedTransfer 구현 페이즈 + InstanceManager 수정

---

## 중간 함정

### 함정 5: Hold Re-INVITE 중 미디어 재생 중단 (PlayAudio 노드와 충돌)

**심각도:** 중간

**문제:**
`executePlayAudio`는 `pb.Play(file, "audio/wav")`를 blocking 호출로 실행한다. Hold Re-INVITE가 재생 중에 도착하면 두 가지 충돌이 발생한다:

1. `StopRTP()` 호출이 재생 goroutine과 race condition — RTP 세션이 재생 중에 중단됨
2. Hold Re-INVITE를 처리하는 diago 내부 `handleReInvite`와 `PlaybackCreate()`가 동일한 `DialogMedia`에 동시 접근

```go
// PlayAudio 실행 중 (blocking)
bytesPlayed, err := pb.Play(file, "audio/wav")   // ← 이 사이에

// Hold Re-INVITE 수신 → diago 내부 handleReInvite 호출 → StopRTP
// → PlayAudio goroutine과 race condition
```

**원인:**
PlayAudio는 단일 goroutine의 blocking 호출이지만, diago는 Re-INVITE를 별도 goroutine에서 처리한다.

**경고 신호:**
- Hold 중에 PlayAudio 노드가 에러로 종료됨
- "context canceled" 또는 "RTP session closed" 에러가 PlayAudio 중에 발생
- Hold 후 재생이 재개되지 않음

**예방 전략:**

Hold와 PlayAudio를 상호 배타적으로 설계:
1. Hold 노드 전에 PlayAudio 완료를 보장하는 시나리오 설계 가이드 제공
2. PlayAudio 실행 중 context 취소를 감지하여 graceful 중단:
```go
// pb.Play는 context가 취소되면 중단되어야 함
// diago PlaybackCreate가 ctx를 받는지 확인 필요
pb, err := dialog.Media().PlaybackCreate()
// Play 중 context 취소 처리 — context 전달 여부 diago API 확인 필수
bytesPlayed, err := pb.Play(file, "audio/wav")
if err != nil && ctx.Err() != nil {
    return nil // context 취소는 정상 종료로 처리
}
```

**영향 페이즈:** Hold 구현 페이즈 + Media 통합

---

### 함정 6: Executor 체인 모델과 다중 dialog 수명 불일치

**심각도:** 중간

**문제:**
현재 Executor는 단일 선형 체인(`SuccessNext`/`FailureNext`)을 실행한다. Attended Transfer는 두 개의 병렬 dialog를 동시에 유지해야 한다:

```
인스턴스 A 체인:
MakeCall(B) → Hold(A-B dialog) → MakeCall(C) → AttendedTransfer → Release

문제: 이 체인은 선형이지만 A-B dialog와 A-C dialog 두 개를 동시에 관리해야 함.
현재 ExecuteChain은 하나의 context/instanceID로 순차 실행.
```

Consultation call (A-C)이 진행되는 동안 원래 통화 (A-B)는 Hold 상태여야 하는데, 이 상태를 추적하는 메커니즘이 없다.

**원인:**
단일 인스턴스 = 단일 활성 dialog를 가정하는 설계. Transfer 시나리오에서 이 가정이 깨진다.

**경고 신호:**
- AttendedTransfer 노드에서 "which dialog?" 에러
- Release 노드가 어떤 dialog를 종료해야 할지 모름
- Hold 상태가 consultation call 완료 후 유실됨

**예방 전략:**

GraphNode에 `DialogRole` 필드 추가로 어떤 dialog를 대상으로 하는지 명시:
```go
type GraphNode struct {
    // ... 기존 필드
    DialogRole string // "primary" | "consultation" — 없으면 기본값 "primary"
}
```

Attended Transfer 특화 executor:
```go
func (ex *Executor) executeAttendedTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
    // 1. primary dialog 조회 (A-B)
    primaryDialog, _ := ex.sessions.GetDialog(instanceID, DialogRolePrimary)
    // 2. consultation dialog 조회 (A-C)
    consultDialog, _ := ex.sessions.GetDialog(instanceID, DialogRoleConsultation)
    // 3. REFER with Replaces 전송
    // 4. 두 dialog 모두 정리
}
```

**영향 페이즈:** AttendedTransfer 구현 페이즈 + Executor 리팩토링

---

### 함정 7: HoldEvent/TransferEvent 수신 시 diago 이슈 #91 (Hangup + Refer broken)

**심각도:** 중간

**문제:**
diago 이슈 #91에 따르면 Hangup과 Refer 모두 `Content-Length` 헤더가 설정되지 않는 버그가 있었다. 현재 v0.27.0에서 이 버그가 수정되었는지 확인이 필요하다. 수정되지 않았다면 BlindTransfer와 Release 노드가 모두 실패한다.

**원인:**
SIP 요청 빌드 시 Content-Length 헤더 누락 — sipgo 레벨의 버그.

**경고 신호:**
- Refer() 호출 시 상대방에게 REFER가 전달되지 않음
- Hangup() 호출 시 BYE가 전달되지 않거나 상대방이 파싱 실패
- Wireshark에서 BYE/REFER 패킷에 Content-Length 헤더 누락

**예방 전략:**

구현 착수 전 diago v0.27.0에서 `Refer()` 동작을 소규모 테스트로 검증:
```go
// 검증 테스트 — 구현 시작 전 실행
func TestReferContentLength(t *testing.T) {
    // diago UA 두 개 생성
    // INVITE → Answer → Refer
    // Wireshark 또는 패킷 캡처로 Content-Length 확인
}
```

만약 버그가 있으면 diago 최신 버전으로 업그레이드 고려 (`go get github.com/emiago/diago@latest`).

**영향 페이즈:** BlindTransfer/AttendedTransfer 구현 페이즈 착수 전 검증

---

### 함정 8: out-of-dialog NOTIFY 수신 거부

**심각도:** 중간

**문제:**
diago 이슈 #51에 따르면, Transfer와 관련된 NOTIFY가 dialog 외부로 도착할 때 diago가 `"400 missing tag param in To header / Call/Transaction Outside Dialog"` 에러로 거부한다.

Transfer 시나리오에서 일부 SIP 서버(Asterisk PBX 등)는 REFER 후 out-of-dialog NOTIFY를 보낼 수 있다. 이를 diago가 거부하면 Transfer 성공 여부를 확인할 수 없다.

**원인:**
diago의 `OnNotify()` 핸들러가 SUBSCRIBE-NOTIFY dialog 흐름만 처리하도록 설계되어 있어 out-of-dialog NOTIFY를 처리하지 못한다.

**경고 신호:**
- Refer() 성공 (202 Accepted) 후 `OnNotify` 콜백이 영구적으로 호출되지 않음
- 상대방 SIP 서버 로그에 NOTIFY 전송 후 400 응답 수신
- Transfer가 성공했지만 SIPFLOW에서 진행이 멈춤 (NOTIFY 대기 중)

**예방 전략:**

NOTIFY 대기에 합리적인 타임아웃을 설정하고, 타임아웃 시 Transfer를 "성공으로 추정"하는 fallback:
```go
// OnNotify 콜백 대기 (5초)
// 타임아웃 시: NOTIFY 수신 불가 (out-of-dialog 거부 등)로 판단하고
// Transfer는 성공한 것으로 간주, BYE 전송
select {
case statusCode := <-notifyDone:
    // 정상 확인
case <-time.After(5 * time.Second):
    ex.engine.emitActionLog(node.ID, instanceID,
        "REFER NOTIFY not received (possible out-of-dialog issue), assuming transfer success", "warn")
    // fallback: BYE 전송
}
```

로컬 시뮬레이션 모드에서는 이 이슈가 발생하지 않을 수 있다 (SIPFLOW 인스턴스끼리 통신할 때). 외부 SIP 서버 테스트 시 주의.

**영향 페이즈:** BlindTransfer/AttendedTransfer 구현 페이즈 + 통합 테스트

---

### 함정 9: UI 팔레트 리팩토링 시 DnD 브레이킹

**심각도:** 중간

**문제:**
현재 SIPFLOW의 노드 팔레트는 HTML5 native DnD (`draggable`, `onDragStart`, `dataTransfer`)와 XYFlow의 `onDrop`/`onDragOver`를 조합하여 구현되어 있다. v1.2 UI 개선에서 팔레트를 그룹화하거나 검색 기능을 추가할 때 DOM 구조를 변경하면 DnD가 깨질 수 있다.

XYFlow 이슈 #5310(2025년 6월, open)에 따르면 노드 내부 DnD가 깨지는 regression이 있고, XYFlow v12 이후 DnD 패턴이 `DnDContext`/`DnDProvider`로 변경되었다.

**원인:**
- 팔레트 DOM 구조 변경 시 `draggable` 속성 상속 또는 이벤트 버블링 경로 변경
- XYFlow의 기존 DnD 이벤트 핸들러와의 충돌
- v1.1에서 적용한 `nodrag` 클래스 패턴이 새 구조에서 작동하지 않을 수 있음

**경고 신호:**
- 노드를 팔레트에서 캔버스로 드래그했는데 드롭이 안 됨
- 드래그 시 커서는 이동하지만 노드가 캔버스에 생성되지 않음
- `dataTransfer.getData('application/sipflow-node')`가 빈 문자열 반환

**예방 전략:**

팔레트 리팩토링 시 DnD 관련 코드를 분리된 컴포넌트로 격리:
```typescript
// 기존 DnD 로직을 팔레트 아이템 레벨에서 완전히 캡슐화
function PaletteItem({ nodeType, label, icon }: PaletteItemProps) {
    const onDragStart = (event: DragEvent) => {
        event.dataTransfer.setData('application/sipflow-node', nodeType)
        event.dataTransfer.effectAllowed = 'move'
    }

    return (
        <div
            draggable
            onDragStart={onDragStart}
            // ← 그룹화/검색 wrapper는 draggable 없이 감쌈
        >
            {icon} {label}
        </div>
    )
}
```

리팩토링 규칙:
1. `draggable` 속성은 팔레트 아이템 최하위 leaf 컴포넌트에만 적용
2. 그룹화 wrapper (`<div>`, `<section>` 등)에는 `draggable` 없음
3. 검색 input에 `className="nodrag"` 추가 (XYFlow 내부 DnD 충돌 방지)
4. 리팩토링 후 즉시 DnD E2E 테스트 실행

**영향 페이즈:** UI 개선 페이즈 (노드 팔레트 리팩토링 시)

---

### 함정 10: Hold 상태에서 Context 취소 시 ReInvite 미완료

**심각도:** 중간

**문제:**
시나리오 실행 중 `StopScenario()`를 호출하면 context가 취소된다. Hold Re-INVITE가 진행 중이면 (응답 대기 중) context 취소로 Re-INVITE가 완료되지 않아 통화가 비정상 상태에 빠질 수 있다.

```
Hold 실행 중:
StopRTP() → ReInvite(ctx) ← ctx 취소 → Re-INVITE 전송됐지만 응답 대기 중단
→ 상대방: Re-INVITE 처리 완료, hold 상태
→ SIPFLOW: dialog 정리 시도 (Hangup) → 이미 hold 상태인 dialog에 BYE
→ 일부 SIP 서버: hold 상태 dialog BYE 거부 또는 오동작
```

**원인:**
`context.WithCancel`이 ReInvite 응답 대기를 강제 중단하지만 SIP 프로토콜 상태 기계는 이를 모름.

**경고 신호:**
- Stop 후 "dialog not terminated" 상태
- 상대방 SIP 서버에서 통화가 계속 활성 상태로 표시됨
- Hangup 호출 시 "481 Call/Transaction Does Not Exist" 에러

**예방 전략:**

`HangupAll`에 Hold 상태 복원 로직 추가:
```go
// cleanup 전 Hold 상태 해제 시도
func (ex *Executor) releaseHeldDialogs(ctx context.Context) {
    heldInstances := ex.sessions.GetHeldInstances()
    for _, instanceID := range heldInstances {
        dialog, _ := ex.sessions.GetDialog(instanceID, DialogRolePrimary)
        // Hold 해제 ReInvite 없이 바로 Hangup
        // (일부 구현에서는 Hold 중 BYE가 허용됨)
        _ = dialog.Hangup(ctx)
    }
}
```

**영향 페이즈:** Hold 구현 페이즈 + cleanup 로직

---

## 사소한 함정

### 함정 11: Retrieve(Hold 해제) 시 원래 SDP IP 복원 문제

**심각도:** 사소

**문제:**
Hold를 위해 `a=sendonly`와 함께 IP를 `0.0.0.0`으로 설정하는 구현 방식이 있다 (diago 이슈 #95 PR 코드 참고). Retrieve 시 원래 IP를 복원해야 하는데, diago API에서 원래 connection IP를 추출하는 방법이 불명확하다.

**예방:**
Hold 시 원래 SDP의 connection IP를 SessionStore에 저장했다가 Retrieve 시 복원:
```go
type SessionStore struct {
    // ...
    holdOriginalIP map[string]string // instanceID -> original c= IP
}
```

---

### 함정 12: GraphNode의 Transfer 관련 필드 누락

**심각도:** 사소

**문제:**
현재 `GraphNode`에 Transfer에 필요한 필드가 없다:
- `ReferToURI` (BlindTransfer 대상)
- `DialogRole` (어떤 dialog를 대상으로 하는지)

누락된 채로 구현하면 `Data map[string]interface{}`에서 직접 꺼내는 임시 코드가 생겨 타입 안전성이 깨진다.

**예방:**
`graph.go`의 `GraphNode` 구조체에 필드 선언 후 `ParseScenario`에서 파싱:
```go
type GraphNode struct {
    // ... 기존 필드
    ReferToURI  string // BlindTransfer/AttendedTransfer 대상 URI
    DialogRole  string // "primary" | "consultation" — 빈 값이면 "primary"
    HoldType    string // "sendonly" | "inactive" — Hold 방식
}
```

**영향 페이즈:** 구현 착수 전 graph.go 수정

---

### 함정 13: 실행 모니터 UI에서 Transfer 다중 leg 시각화 혼란

**심각도:** 사소

**문제:**
Attended Transfer는 한 인스턴스에서 두 개의 dialog가 동시에 활성 상태다. 실행 모니터의 SIP 래더 다이어그램이 단일 dialog 기준으로 설계되어 있어, 두 번째 leg의 메시지가 혼재되어 표시되거나 누락될 수 있다.

**예방:**
실행 모니터 개선 시 dialog role(primary/consultation)을 메시지에 태그로 포함하여 구분 가능하게:
```go
ex.engine.emitActionLog(node.ID, instanceID, "Consultation call connected", "info",
    WithSIPMessage("sent", "INVITE", 200, "", fromURI, toURI),
    WithDialogRole("consultation"), // 새 옵션
)
```

**영향 페이즈:** UI 개선 페이즈 + 실행 모니터 개선

---

## 페이즈별 경고

| 페이즈 주제 | 있을 법한 함정 | 필수 완화 |
|-------------|----------------|-----------|
| **SessionStore 리팩토링** | 함정 1 (1:1 키 충돌), 함정 12 (GraphNode 필드) | 1:N 구조 설계를 가장 먼저 결정. 하위 호환성 유지 |
| **Hold/Retrieve 구현** | 함정 2 (diago API 부재 + #110 빈 SDP), 함정 5 (PlayAudio 충돌), 함정 10 (ctx 취소), 함정 11 (IP 복원) | 착수 전 diago ReInvite + StopRTP 동작 실험 필수 |
| **BlindTransfer 구현** | 함정 3 (NOTIFY before BYE), 함정 7 (이슈 #91 Content-Length), 함정 8 (out-of-dialog NOTIFY) | Refer() 동작 검증 테스트 먼저, OnNotify 콜백 필수 사용 |
| **AttendedTransfer 구현** | 함정 4 (incomingCh 포화), 함정 6 (Executor 체인 한계), 함정 1 (dialog 충돌) | InstanceManager + SessionStore + Executor 모두 수정 필요 — 가장 복잡한 페이즈 |
| **UI 팔레트 개선** | 함정 9 (DnD 브레이킹) | DnD 로직 컴포넌트 격리, 리팩토링 후 즉시 DnD 테스트 |
| **실행 모니터 개선** | 함정 13 (다중 leg 시각화) | dialog role 태그 설계 후 UI 개발 |
| **통합 테스트** | 함정 8 (out-of-dialog NOTIFY), 함정 7 (Content-Length 버그) | 로컬 시뮬레이션 + 외부 SIP 서버 양쪽 테스트 |

---

## 신뢰도 평가

| 영역 | 신뢰도 | 근거 |
|------|--------|------|
| SessionStore 1:1 충돌 | **HIGH** | 소스 코드 직접 분석. `map[instanceID]dialog` 구조 확인 |
| diago Hold API 부재 | **HIGH** | GitHub 이슈 #95 (open), pkg.go.dev API 문서 확인 |
| diago 빈 SDP 이슈 #110 | **HIGH** | GitHub 이슈 #110 (open) 직접 확인, 에러 메시지 포함 |
| REFER/NOTIFY race condition | **HIGH** | RFC 3515, RFC 5407 공식 문서 + diago ReferClientOptions.OnNotify |
| incomingCh 버퍼 포화 | **HIGH** | 소스 코드 확인 — `make(chan ..., 1)` |
| diago 이슈 #91 (Content-Length) | **MEDIUM** | 이슈 확인됨, v0.27.0에서 수정 여부 미확인 |
| out-of-dialog NOTIFY | **MEDIUM** | 이슈 #51 확인됨, 로컬 시뮬레이션에서는 재현 안 될 수 있음 |
| Hold + PlayAudio 충돌 | **MEDIUM** | diago 내부 handleReInvite goroutine 동작 추론 기반 |
| XYFlow DnD 회귀 위험 | **MEDIUM** | v1.1에서 `nodrag` 패턴 적용 이력 + XYFlow 이슈 #5310 확인 |
| Retrieve SDP IP 복원 | **LOW** | diago 이슈 #95 PR 코드에서 추론, 직접 테스트 필요 |

---

## Sources

### diago 라이브러리 공식 소스
- [GitHub — emiago/diago](https://github.com/emiago/diago)
- [diago issue #110: Hold — Empty SDP Error](https://github.com/emiago/diago/issues/110)
- [diago issue #95: Hold/Unhold Call (on roadmap)](https://github.com/emiago/diago/issues/95)
- [diago issue #91: Bug — Hangup and Refer broken](https://github.com/emiago/diago/issues/91)
- [diago issue #51: NOTIFY after REGISTER (transfers)](https://github.com/emiago/diago/issues/51)
- [pkg.go.dev — diago API](https://pkg.go.dev/github.com/emiago/diago)

### SIP RFC 공식 문서
- [RFC 3515: The SIP REFER Method](https://datatracker.ietf.org/doc/html/rfc3515)
- [RFC 5407: Race Conditions in SIP](https://datatracker.ietf.org/doc/rfc5407/)
- [RFC 5589: SIP Call Control — Transfer](https://datatracker.ietf.org/doc/rfc5589/)
- [RFC 5057: Multiple Dialog Usages in SIP](https://datatracker.ietf.org/doc/rfc5057/)
- [RFC 7647: Clarifications for REFER with RFC 6665](https://datatracker.ietf.org/doc/rfc7647/)

### SIP Hold/Transfer 구현 참고
- [SIP Call Transferring — VOCAL Technologies](https://vocal.com/sip/call-transferring/)
- [Dissecting SIP Transfer — Andrew Prokop](https://andrewjprokop.wordpress.com/2014/12/02/dissecting-sip-transfer/)
- [Understanding SIP Call onhold](https://thanhloi2603.wordpress.com/2017/06/03/understanding-sip-call-onhold/)

### XYFlow DnD
- [ReactFlow Drag and Drop Example](https://reactflow.dev/examples/interaction/drag-and-drop)
- [XYFlow issue #5310: DnD within nodes broken](https://github.com/xyflow/xyflow/issues/5310)
