package engine

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/emiago/diago"
	"github.com/emiago/diago/media/sdp"
	"github.com/emiago/sipgo/sip"
)

// SessionStore는 활성 SIP 세션을 thread-safe하게 관리한다
type SessionStore struct {
	mu             sync.RWMutex
	dialogs        map[string]diago.DialogSession          // instanceID -> dialog session
	serverSessions map[string]*diago.DialogServerSession   // instanceID -> incoming server session
	sipEventSubs   map[string][]chan struct{}              // "{instanceID}:{eventType}" -> 구독 채널 목록
}

// NewSessionStore는 새로운 SessionStore를 생성한다
func NewSessionStore() *SessionStore {
	return &SessionStore{
		dialogs:        make(map[string]diago.DialogSession),
		serverSessions: make(map[string]*diago.DialogServerSession),
		sipEventSubs:   make(map[string][]chan struct{}),
	}
}

// StoreDialog는 dialog session을 저장한다
func (ss *SessionStore) StoreDialog(key string, dialog diago.DialogSession) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	ss.dialogs[key] = dialog
}

// GetDialog는 dialog session을 조회한다
func (ss *SessionStore) GetDialog(key string) (diago.DialogSession, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	dialog, exists := ss.dialogs[key]
	return dialog, exists
}

// StoreServerSession은 incoming server session을 저장한다
func (ss *SessionStore) StoreServerSession(instanceID string, session *diago.DialogServerSession) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	ss.serverSessions[instanceID] = session
}

// GetServerSession은 incoming server session을 조회한다
func (ss *SessionStore) GetServerSession(instanceID string) (*diago.DialogServerSession, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	session, exists := ss.serverSessions[instanceID]
	return session, exists
}

// HangupAll은 모든 활성 dialog의 Hangup을 호출한다
func (ss *SessionStore) HangupAll(ctx context.Context) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	// 5초 타임아웃 context
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for _, dialog := range ss.dialogs {
		_ = dialog.Hangup(hangupCtx)
	}
}

// CloseAll은 모든 dialog의 Close를 호출한다
func (ss *SessionStore) CloseAll() {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	for _, dialog := range ss.dialogs {
		_ = dialog.Close()
	}
}

// emitSIPEvent는 특정 인스턴스의 SIP 이벤트를 구독 채널들에 non-blocking으로 전송한다
func (ss *SessionStore) emitSIPEvent(instanceID, eventType string) {
	key := instanceID + ":" + eventType
	ss.mu.RLock()
	subs := ss.sipEventSubs[key]
	ss.mu.RUnlock()

	for _, ch := range subs {
		select {
		case ch <- struct{}{}:
		default:
			// 채널이 가득 찬 경우 드랍 (non-blocking)
		}
	}
}

// SubscribeSIPEvent는 특정 인스턴스의 SIP 이벤트를 구독하는 채널을 생성하고 반환한다
func (ss *SessionStore) SubscribeSIPEvent(instanceID, eventType string) chan struct{} {
	key := instanceID + ":" + eventType
	ch := make(chan struct{}, 1)

	ss.mu.Lock()
	ss.sipEventSubs[key] = append(ss.sipEventSubs[key], ch)
	ss.mu.Unlock()

	return ch
}

// UnsubscribeSIPEvent는 SIP 이벤트 구독을 해제한다
func (ss *SessionStore) UnsubscribeSIPEvent(instanceID, eventType string, ch chan struct{}) {
	key := instanceID + ":" + eventType

	ss.mu.Lock()
	defer ss.mu.Unlock()

	subs := ss.sipEventSubs[key]
	for i, sub := range subs {
		if sub == ch {
			ss.sipEventSubs[key] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
}

// Executor는 시나리오 그래프의 노드를 실행한다
type Executor struct {
	engine   *Engine           // 이벤트 발행용 부모 참조
	im       *InstanceManager  // UA 조회용
	sessions *SessionStore     // 활성 세션 저장소
}

// NewExecutor는 새로운 Executor를 생성한다
func NewExecutor(engine *Engine, im *InstanceManager) *Executor {
	return &Executor{
		engine:   engine,
		im:       im,
		sessions: NewSessionStore(),
	}
}

// ExecuteChain은 시작 노드부터 체인을 순차적으로 실행한다
func (ex *Executor) ExecuteChain(ctx context.Context, instanceID string, startNode *GraphNode) error {
	currentNode := startNode

	for currentNode != nil {
		// Context 취소 확인
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// 현재 노드 실행
		err := ex.executeNode(ctx, instanceID, currentNode)
		if err != nil {
			// 실패 시 failure 분기 확인
			if currentNode.FailureNext != nil {
				currentNode = currentNode.FailureNext
				continue
			}
			// failure 분기 없으면 에러 반환 (전체 중단)
			return err
		}

		// 성공 시 다음 노드로
		currentNode = currentNode.SuccessNext
	}

	return nil
}

// executeNode는 단일 노드를 실행한다
func (ex *Executor) executeNode(ctx context.Context, instanceID string, node *GraphNode) error {
	// 노드 상태를 "running"으로 변경
	ex.engine.emitNodeState(node.ID, NodeStatePending, NodeStateRunning)

	var err error
	switch node.Type {
	case "command":
		err = ex.executeCommand(ctx, instanceID, node)
	case "event":
		err = ex.executeEvent(ctx, instanceID, node)
	default:
		err = nil // unknown type은 무시 (향후 확장)
	}

	if err != nil {
		// 실패 이벤트 발행
		ex.engine.emitNodeState(node.ID, NodeStateRunning, NodeStateFailed)
		return err
	}

	// 성공 이벤트 발행
	ex.engine.emitNodeState(node.ID, NodeStateRunning, NodeStateCompleted)
	return nil
}

// executeCommand는 Command 노드를 실행한다
func (ex *Executor) executeCommand(ctx context.Context, instanceID string, node *GraphNode) error {
	switch node.Command {
	case "MakeCall":
		return ex.executeMakeCall(ctx, instanceID, node)
	case "Answer":
		return ex.executeAnswer(ctx, instanceID, node)
	case "Release":
		return ex.executeRelease(ctx, instanceID, node)
	case "PlayAudio":
		return ex.executePlayAudio(ctx, instanceID, node)
	case "SendDTMF":
		return ex.executeSendDTMF(ctx, instanceID, node)
	case "Hold":
		return ex.executeHold(ctx, instanceID, node)
	case "Retrieve":
		return ex.executeRetrieve(ctx, instanceID, node)
	case "BlindTransfer":
		return ex.executeBlindTransfer(ctx, instanceID, node)
	default:
		return fmt.Errorf("unknown command: %s", node.Command)
	}
}

// executeMakeCall은 MakeCall 커맨드를 실행한다
func (ex *Executor) executeMakeCall(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, fmt.Sprintf("MakeCall to %s", node.TargetURI), "info")

	// TargetURI 검증
	if node.TargetURI == "" {
		return fmt.Errorf("MakeCall requires a targetUri")
	}
	if !strings.HasPrefix(node.TargetURI, "sip:") {
		return fmt.Errorf("targetUri must start with sip: scheme")
	}

	// URI 파싱
	var recipient sip.Uri
	if err := sip.ParseUri(node.TargetURI, &recipient); err != nil {
		return fmt.Errorf("invalid targetUri %q: %w", node.TargetURI, err)
	}

	// 인스턴스 조회
	instance, err := ex.im.GetInstance(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get instance: %w", err)
	}

	// 타임아웃 설정 (기본 30초)
	timeout := 30 * time.Second
	if node.Timeout > 0 {
		timeout = node.Timeout
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Invite 호출
	dialog, err := instance.UA.Invite(timeoutCtx, recipient, diago.InviteOptions{})
	if err != nil {
		return fmt.Errorf("Invite failed: %w", err)
	}

	// Dialog 저장
	ex.sessions.StoreDialog(instanceID, dialog)

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	// Note: diago DialogSession 인터페이스에서 Call-ID 접근이 제한되어 빈 문자열 사용
	fromURI := instance.Config.DN  // 발신자는 인스턴스의 DN
	toURI := recipient.User        // 수신자는 TargetURI의 User
	ex.engine.emitActionLog(node.ID, instanceID, "MakeCall succeeded", "info",
		WithSIPMessage("sent", "INVITE", 200, "", fromURI, toURI))
	return nil
}

// executeAnswer는 Answer 커맨드를 실행한다 (AnswerOptions 기반)
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, "Answer incoming call", "info")

	// Incoming server session 조회
	serverSession, exists := ex.sessions.GetServerSession(instanceID)
	if !exists {
		return fmt.Errorf("no incoming dialog to answer for instance %s", instanceID)
	}

	// AnswerOptions 구성 (OnMediaUpdate, OnRefer 콜백 등록)
	opts := diago.AnswerOptions{
		// OnMediaUpdate: Hold/Retrieve 감지를 위한 콜백
		// 반드시 goroutine으로 분리해야 함 — 콜백은 d.mu.Lock() 안에서 호출되므로
		// 동일 goroutine에서 d.MediaSession()(내부적으로 d.mu.Lock()) 호출 시 데드락 발생
		OnMediaUpdate: func(d *diago.DialogMedia) {
			go func() {
				defer func() {
					if r := recover(); r != nil {
						ex.engine.emitActionLog(node.ID, instanceID,
							fmt.Sprintf("OnMediaUpdate panic recovered: %v", r), "error")
					}
				}()

				msess := d.MediaSession()
				if msess == nil {
					return
				}
				localSDP := string(msess.LocalSDP())

				if strings.Contains(localSDP, "a=recvonly") {
					// 상대방이 Hold 요청 (sendonly) → 우리는 recvonly → HELD 이벤트
					ex.engine.emitSIPEvent(instanceID, "HELD")
					ex.engine.emitActionLog(node.ID, instanceID, "Call HELD by remote party", "info",
						WithSIPMessage("received", "INVITE", 200, "", "", "", "recvonly"))
				} else if strings.Contains(localSDP, "a=sendrecv") {
					// 상대방이 Retrieve 요청 (sendrecv) → RETRIEVED 이벤트
					ex.engine.emitSIPEvent(instanceID, "RETRIEVED")
					ex.engine.emitActionLog(node.ID, instanceID, "Call RETRIEVED by remote party", "info",
						WithSIPMessage("received", "INVITE", 200, "", "", "", "sendrecv"))
				}
			}()
		},
		// OnRefer: BlindTransfer 감지를 위한 콜백 (Phase 11 대비 스텁)
		OnRefer: func(referDialog *diago.DialogClientSession) error {
			ex.engine.emitSIPEvent(instanceID, "TRANSFERRED")
			ex.engine.emitActionLog(node.ID, instanceID, "REFER received (transfer)", "info",
				WithSIPMessage("received", "REFER", 0, "", "", ""))
			return nil
		},
	}

	// AnswerOptions 호출
	if err := serverSession.AnswerOptions(opts); err != nil {
		// 코덱 협상 실패 감지 (에러 메시지에 "codec" 또는 "media" 관련 문자열 포함 여부)
		errMsg := err.Error()
		if strings.Contains(strings.ToLower(errMsg), "codec") ||
			strings.Contains(strings.ToLower(errMsg), "media") ||
			strings.Contains(strings.ToLower(errMsg), "negotiat") {
			// 인스턴스 코덱 정보 조회 (디버깅용)
			instance, instErr := ex.im.GetInstance(instanceID)
			if instErr == nil {
				ex.engine.emitActionLog(node.ID, instanceID,
					fmt.Sprintf("Instance codecs: %v", instance.Config.Codecs), "debug")
			}
			ex.engine.emitActionLog(node.ID, instanceID,
				fmt.Sprintf("Codec negotiation failed (488 Not Acceptable): %v", err), "error")
			return fmt.Errorf("codec negotiation failed (488 Not Acceptable): %w", err)
		}
		return fmt.Errorf("Answer failed: %w", err)
	}

	// Server session을 dialog로도 저장
	ex.sessions.StoreDialog(instanceID, serverSession)

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	fromUser := serverSession.FromUser()
	toUser := serverSession.ToUser()
	ex.engine.emitActionLog(node.ID, instanceID, "Answer succeeded", "info",
		WithSIPMessage("received", "INVITE", 200, "", fromUser, toUser))
	return nil
}

// executeRelease는 Release 커맨드를 실행한다
func (ex *Executor) executeRelease(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, "Release call", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		// 이미 종료된 경우 경고 후 성공 처리
		ex.engine.emitActionLog(node.ID, instanceID, "No active dialog to release (already terminated)", "warn")
		return nil
	}

	// 5초 타임아웃으로 Hangup
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := dialog.Hangup(hangupCtx); err != nil {
		// Hangup 실패는 경고만 (이미 종료된 경우 등)
		ex.engine.emitActionLog(node.ID, instanceID, fmt.Sprintf("Hangup warning: %v", err), "warn")
	}

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	ex.engine.emitActionLog(node.ID, instanceID, "Release succeeded", "info",
		WithSIPMessage("sent", "BYE", 200, "", "", ""))
	return nil
}

// executeEvent는 Event 노드를 실행한다
func (ex *Executor) executeEvent(ctx context.Context, instanceID string, node *GraphNode) error {
	// 타임아웃 설정 (기본 10초)
	timeout := 10 * time.Second
	if node.Timeout > 0 {
		timeout = node.Timeout
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, fmt.Sprintf("Waiting for %s (timeout: %v)", node.Event, timeout), "info")

	switch node.Event {
	case "INCOMING":
		return ex.executeIncoming(timeoutCtx, instanceID, node, timeout)
	case "DISCONNECTED":
		return ex.executeDisconnected(timeoutCtx, instanceID, node, timeout)
	case "RINGING":
		return ex.executeRinging(timeoutCtx, instanceID, node)
	case "TIMEOUT":
		return ex.executeTimeout(timeoutCtx, instanceID, node, timeout)
	case "DTMFReceived":
		return ex.executeDTMFReceived(timeoutCtx, instanceID, node)
	case "HELD":
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "HELD", timeout)
	case "RETRIEVED":
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "RETRIEVED", timeout)
	case "TRANSFERRED":
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, "TRANSFERRED", timeout)
	default:
		return fmt.Errorf("event type %s is not supported", node.Event)
	}
}

// executeIncoming은 INCOMING 이벤트를 대기한다
func (ex *Executor) executeIncoming(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
	// 인스턴스 조회
	instance, err := ex.im.GetInstance(instanceID)
	if err != nil {
		return fmt.Errorf("failed to get instance: %w", err)
	}

	// incoming 채널 대기
	select {
	case inDialog := <-instance.incomingCh:
		// Server session 저장
		ex.sessions.StoreServerSession(instanceID, inDialog)

		// 성공 로그 (SIP 메시지 상세 정보 포함)
		fromUser := inDialog.FromUser()
		toUser := inDialog.ToUser()
		ex.engine.emitActionLog(node.ID, instanceID, fmt.Sprintf("INCOMING event received from %s", fromUser), "info",
			WithSIPMessage("received", "INVITE", 0, "", fromUser, toUser))
		return nil
	case <-ctx.Done():
		// 타임아웃
		return fmt.Errorf("INCOMING event timeout after %v", timeout)
	}
}

// executeDisconnected는 DISCONNECTED 이벤트를 대기한다
func (ex *Executor) executeDisconnected(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		return fmt.Errorf("no active dialog for DISCONNECTED event")
	}

	// dialog context Done 대기
	select {
	case <-dialog.Context().Done():
		// 성공 로그
		ex.engine.emitActionLog(node.ID, instanceID, "DISCONNECTED event received", "info")
		return nil
	case <-ctx.Done():
		// 타임아웃
		return fmt.Errorf("DISCONNECTED event timeout after %v", timeout)
	}
}

// executeRinging은 RINGING 이벤트를 처리한다 (로컬 모드에서는 즉시 완료)
func (ex *Executor) executeRinging(ctx context.Context, instanceID string, node *GraphNode) error {
	// Phase 03에서는 MakeCall 성공 시 이미 180 Ringing을 거쳤으므로 즉시 완료
	ex.engine.emitActionLog(node.ID, instanceID, "RINGING event (auto-completed in local mode)", "info",
		WithSIPMessage("received", "RINGING", 180, "", "", ""))
	return nil
}

// executeTimeout은 TIMEOUT 이벤트를 처리한다 (단순 딜레이)
func (ex *Executor) executeTimeout(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
	// time.After로 딜레이
	select {
	case <-time.After(timeout):
		// 성공 로그
		ex.engine.emitActionLog(node.ID, instanceID, fmt.Sprintf("TIMEOUT event completed after %v", timeout), "info")
		return nil
	case <-ctx.Done():
		// Context 취소
		return ctx.Err()
	}
}

// executePlayAudio는 PlayAudio 커맨드를 실행한다
func (ex *Executor) executePlayAudio(ctx context.Context, instanceID string, node *GraphNode) error {
	// FilePath 검증
	if node.FilePath == "" {
		ex.engine.emitActionLog(node.ID, instanceID, "PlayAudio requires filePath", "error")
		return fmt.Errorf("PlayAudio requires filePath")
	}

	// 파일 존재 확인
	if _, err := os.Stat(node.FilePath); err != nil {
		if os.IsNotExist(err) {
			ex.engine.emitActionLog(node.ID, instanceID,
				fmt.Sprintf("Audio file not found: %s", node.FilePath), "error")
			return fmt.Errorf("audio file not found: %s", node.FilePath)
		}
		return fmt.Errorf("cannot access audio file: %w", err)
	}

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		ex.engine.emitActionLog(node.ID, instanceID,
			"No active dialog for PlayAudio (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for PlayAudio")
	}

	// WAV 파일 열기
	file, err := os.Open(node.FilePath)
	if err != nil {
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Failed to open audio file: %v", err), "error")
		return fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	// Playback 인스턴스 생성
	pb, err := dialog.Media().PlaybackCreate()
	if err != nil {
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("PlaybackCreate failed: %v", err), "error")
		return fmt.Errorf("PlaybackCreate failed: %w", err)
	}

	// 파일명 추출
	fileName := filepath.Base(node.FilePath)
	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("Playing audio file: %s", fileName), "info")

	// Context 취소 확인
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// WAV 파일 재생 (blocking until playback completes)
	bytesPlayed, err := pb.Play(file, "audio/wav")
	if err != nil {
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Playback failed: %v", err), "error")
		return fmt.Errorf("Play failed: %w", err)
	}

	// 재생 완료 로그
	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("Playback completed (%d bytes)", bytesPlayed), "info")

	return nil
}

// executeSendDTMF는 SendDTMF 커맨드를 실행한다
func (ex *Executor) executeSendDTMF(ctx context.Context, instanceID string, node *GraphNode) error {
	// Digits 검증
	if node.Digits == "" {
		ex.engine.emitActionLog(node.ID, instanceID, "SendDTMF requires digits", "error")
		return fmt.Errorf("SendDTMF requires digits")
	}

	// Interval 계산
	interval := time.Duration(node.IntervalMs) * time.Millisecond

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		ex.engine.emitActionLog(node.ID, instanceID,
			"No active dialog for SendDTMF (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for SendDTMF")
	}

	// DTMF writer 생성
	dtmfWriter := dialog.Media().AudioWriterDTMF()

	// 전송 시작 로그
	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("Sending DTMF digits: %s (interval: %dms)", node.Digits, int(node.IntervalMs)), "info")

	// 각 digit 전송
	digits := []rune(node.Digits)
	for i, digit := range digits {
		// Context 취소 확인
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Digit 검증
		if !isValidDTMF(digit) {
			ex.engine.emitActionLog(node.ID, instanceID,
				fmt.Sprintf("Invalid DTMF digit: %c", digit), "error")
			return fmt.Errorf("invalid DTMF digit: %c (allowed: 0-9, *, #, A-D)", digit)
		}

		// DTMF 전송
		if err := dtmfWriter.WriteDTMF(digit); err != nil {
			ex.engine.emitActionLog(node.ID, instanceID,
				fmt.Sprintf("Failed to send DTMF %c: %v", digit, err), "error")
			return fmt.Errorf("WriteDTMF failed for %c: %w", digit, err)
		}

		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Sent DTMF: %c", digit), "info")

		// 마지막 digit이 아니면 interval 대기
		if i < len(digits)-1 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(interval):
			}
		}
	}

	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("DTMF transmission completed (%d digits)", len(digits)), "info")
	return nil
}

// executeDTMFReceived는 DTMFReceived 이벤트를 실행한다
func (ex *Executor) executeDTMFReceived(ctx context.Context, instanceID string, node *GraphNode) error {
	// ExpectedDigit 파싱 (optional)
	expectedDigit := node.ExpectedDigit

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		ex.engine.emitActionLog(node.ID, instanceID,
			"No active dialog for DTMFReceived (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for DTMFReceived")
	}

	// DTMF reader 생성
	dtmfReader := dialog.Media().AudioReaderDTMF()

	// 대기 상태 로그
	if expectedDigit != "" {
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Waiting for DTMF digit: %s (timeout: %dms)", expectedDigit, node.Timeout.Milliseconds()), "info")
	} else {
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Waiting for any DTMF digit (timeout: %dms)", node.Timeout.Milliseconds()), "info")
	}

	// 채널 생성
	receivedCh := make(chan rune, 1)
	errCh := make(chan error, 1)

	// Goroutine으로 DTMF 수신 대기
	go func() {
		// OnDTMF callback 설정
		dtmfReader.OnDTMF(func(digit rune) error {
			// ExpectedDigit 필터링
			if expectedDigit != "" {
				if string(digit) != expectedDigit {
					ex.engine.emitActionLog(node.ID, instanceID,
						fmt.Sprintf("Received DTMF: %c (waiting for %s, continuing)", digit, expectedDigit), "info")
					return nil // 계속 대기
				}
			}

			// Digit 매칭됨
			receivedCh <- digit
			return fmt.Errorf("digit received") // Listen 루프 중단 신호
		})

		// Read 루프
		buf := make([]byte, 1024)
		for {
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			default:
			}

			if _, err := dtmfReader.Read(buf); err != nil {
				if err.Error() == "digit received" {
					return // 정상 종료
				}
				errCh <- err
				return
			}
		}
	}()

	// 결과 대기
	select {
	case <-ctx.Done():
		return ctx.Err()
	case digit := <-receivedCh:
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("Received DTMF: %c", digit), "info")
		return nil
	case err := <-errCh:
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("DTMF receive error: %v", err), "error")
		return fmt.Errorf("DTMF receive failed: %w", err)
	case <-time.After(node.Timeout):
		ex.engine.emitActionLog(node.ID, instanceID, "DTMF receive timeout", "warning")
		return fmt.Errorf("timeout waiting for DTMF")
	}
}

// executeHold는 Hold 커맨드를 실행한다 — MediaSession.Mode를 sendonly로 설정하고 Re-INVITE를 전송한다
func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, "Hold: sending Re-INVITE (sendonly)", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		return fmt.Errorf("Hold: no active dialog for instance %s", instanceID)
	}

	// MediaSession 조회
	mediaSess := dialog.Media().MediaSession()
	if mediaSess == nil {
		return fmt.Errorf("Hold: no media session available")
	}

	// SDP 방향을 sendonly로 변경 (Hold 상태)
	mediaSess.Mode = sdp.ModeSendonly

	// ReInvite 인터페이스 어서션
	type reInviter interface {
		ReInvite(ctx context.Context) error
	}
	ri, ok := dialog.(reInviter)
	if !ok {
		mediaSess.Mode = sdp.ModeSendrecv // 복원
		return fmt.Errorf("Hold: dialog type %T does not support ReInvite", dialog)
	}

	// Re-INVITE 전송
	if err := ri.ReInvite(ctx); err != nil {
		mediaSess.Mode = sdp.ModeSendrecv // 실패 시 복원
		return fmt.Errorf("Hold: ReInvite failed: %w", err)
	}

	// 성공 로그
	ex.engine.emitActionLog(node.ID, instanceID, "Hold succeeded", "info",
		WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly"))
	return nil
}

// executeRetrieve는 Retrieve 커맨드를 실행한다 — MediaSession.Mode를 sendrecv로 복원하고 Re-INVITE를 전송한다
func (ex *Executor) executeRetrieve(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, "Retrieve: sending Re-INVITE (sendrecv)", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		return fmt.Errorf("Retrieve: no active dialog for instance %s", instanceID)
	}

	// MediaSession 조회
	mediaSess := dialog.Media().MediaSession()
	if mediaSess == nil {
		return fmt.Errorf("Retrieve: no media session available")
	}

	// SDP 방향을 sendrecv로 복원 (Retrieve 상태)
	mediaSess.Mode = sdp.ModeSendrecv

	// ReInvite 인터페이스 어서션
	type reInviter interface {
		ReInvite(ctx context.Context) error
	}
	ri, ok := dialog.(reInviter)
	if !ok {
		return fmt.Errorf("Retrieve: dialog type %T does not support ReInvite", dialog)
	}

	// Re-INVITE 전송
	if err := ri.ReInvite(ctx); err != nil {
		return fmt.Errorf("Retrieve: ReInvite failed: %w", err)
	}

	// 성공 로그
	ex.engine.emitActionLog(node.ID, instanceID, "Retrieve succeeded", "info",
		WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendrecv"))
	return nil
}

// executeBlindTransfer는 BlindTransfer 커맨드를 실행한다 — REFER를 전송하고 즉시 BYE로 통화를 종료한다
func (ex *Executor) executeBlindTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
	// 1. targetUser/targetHost 검증
	if node.TargetUser == "" {
		return fmt.Errorf("BlindTransfer: targetUser is required")
	}
	if node.TargetHost == "" {
		return fmt.Errorf("BlindTransfer: targetHost is required")
	}

	// 2. Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID)
	if !exists {
		return fmt.Errorf("BlindTransfer: no active dialog for instance %s", instanceID)
	}

	// 3. SIP URI 조합
	rawURI := fmt.Sprintf("sip:%s@%s", node.TargetUser, node.TargetHost)

	// 4. sip.ParseUri()로 URI 검증
	var referTo sip.Uri
	if err := sip.ParseUri(rawURI, &referTo); err != nil {
		return fmt.Errorf("BlindTransfer: invalid target URI %q: %w", rawURI, err)
	}

	// 5. referrer 인터페이스 어서션 (Phase 10 reInviter 패턴과 동일)
	type referrer interface {
		Refer(ctx context.Context, referTo sip.Uri, headers ...sip.Header) error
	}
	r, ok := dialog.(referrer)
	if !ok {
		return fmt.Errorf("BlindTransfer: dialog type %T does not support Refer", dialog)
	}

	// 6. 액션 로그 (Refer 호출 전에 발행하여 실패 시에도 시도 기록이 남음)
	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("BlindTransfer: sending REFER to %s", rawURI), "info")

	// 7. Refer 호출
	if err := r.Refer(ctx, referTo); err != nil {
		return fmt.Errorf("BlindTransfer: REFER failed: %w", err)
	}

	// 8. 성공 로그
	ex.engine.emitActionLog(node.ID, instanceID,
		fmt.Sprintf("BlindTransfer succeeded (Refer-To: %s)", rawURI), "info",
		WithSIPMessage("sent", "REFER", 202, "", "", rawURI))

	// 9. 즉시 BYE 전송 (5초 타임아웃)
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := dialog.Hangup(hangupCtx); err != nil {
		// BYE 실패는 경고만 (이미 종료된 경우 등)
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("BlindTransfer: BYE warning: %v", err), "warn")
	} else {
		ex.engine.emitActionLog(node.ID, instanceID, "BlindTransfer: BYE sent", "info",
			WithSIPMessage("sent", "BYE", 200, "", "", ""))
	}

	return nil
}

// executeWaitSIPEvent는 SessionStore SIP 이벤트 버스에서 특정 이벤트를 블로킹 대기한다
func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType string, timeout time.Duration) error {
	// 구독 채널 생성
	ch := ex.sessions.SubscribeSIPEvent(instanceID, eventType)
	defer ex.sessions.UnsubscribeSIPEvent(instanceID, eventType, ch)

	select {
	case <-ch:
		// 이벤트 수신 성공
		ex.engine.emitActionLog(node.ID, instanceID,
			fmt.Sprintf("%s event received", eventType), "info")
		return nil
	case <-ctx.Done():
		// 타임아웃 또는 컨텍스트 취소
		return fmt.Errorf("%s event timeout after %v", eventType, timeout)
	}
}

// isValidDTMF는 DTMF digit이 유효한지 검증한다 (0-9, *, #, A-D)
func isValidDTMF(r rune) bool {
	switch r {
	case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#':
		return true
	case 'A', 'B', 'C', 'D': // RFC 2833 extended digits
		return true
	default:
		return false
	}
}
