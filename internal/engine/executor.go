package engine

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/emiago/diago"
	"github.com/emiago/diago/media/sdp"
	"github.com/emiago/sipgo/sip"

	"sipflow/internal/pkg/eventhandler"
)

func sessionKey(instanceID, callID string) string {
	return instanceID + ":" + callID
}

// SessionStore는 활성 SIP 세션을 thread-safe하게 관리한다
type SessionStore struct {
	mu              sync.RWMutex
	dialogs         map[string]diago.DialogSession  // "{instanceID}:{callID}" -> dialog session
	sipCallMappings map[string]string               // "{instanceID}:{callID}" -> SIP Call-ID
	dispatchers     map[string]eventhandler.Subject // "{sipCallID}" -> dispatcher
}

// NewSessionStore는 새로운 SessionStore를 생성한다
func NewSessionStore() *SessionStore {
	return &SessionStore{
		dialogs:         make(map[string]diago.DialogSession),
		sipCallMappings: make(map[string]string),
		dispatchers:     make(map[string]eventhandler.Subject),
	}
}

func dialogSIPCallID(dialog diago.DialogSession) string {
	if dialog == nil || dialog.DialogSIP() == nil {
		return ""
	}

	dialogSIP := dialog.DialogSIP()
	if dialogSIP.InviteRequest != nil {
		if callID := dialogSIP.InviteRequest.CallID(); callID != nil && callID.Value() != "" {
			return callID.Value()
		}
	}
	if dialogSIP.InviteResponse != nil {
		if callID := dialogSIP.InviteResponse.CallID(); callID != nil && callID.Value() != "" {
			return callID.Value()
		}
	}
	return ""
}

func (ss *SessionStore) ensureDispatcherLocked(sipCallID string) eventhandler.Subject {
	dispatcher, exists := ss.dispatchers[sipCallID]
	if !exists {
		dispatcher = eventhandler.NewDispatcher(sipCallID)
		ss.dispatchers[sipCallID] = dispatcher
	}
	return dispatcher
}

// StoreDialog는 dialog session을 저장한다
func (ss *SessionStore) StoreDialog(instanceID, callID string, dialog diago.DialogSession) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	key := sessionKey(instanceID, callID)
	ss.dialogs[key] = dialog
	if sipCallID := dialogSIPCallID(dialog); sipCallID != "" {
		ss.sipCallMappings[key] = sipCallID
		ss.ensureDispatcherLocked(sipCallID)
	}
}

// GetDialog는 dialog session을 조회한다
func (ss *SessionStore) GetDialog(instanceID, callID string) (diago.DialogSession, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	dialog, exists := ss.dialogs[sessionKey(instanceID, callID)]
	return dialog, exists
}

// DeleteDialog는 dialog session을 제거한다
func (ss *SessionStore) DeleteDialog(instanceID, callID string) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	key := sessionKey(instanceID, callID)
	delete(ss.dialogs, key)
	if sipCallID, exists := ss.sipCallMappings[key]; exists {
		delete(ss.sipCallMappings, key)
		if dispatcher, ok := ss.dispatchers[sipCallID]; ok && dispatcher.ListenerCount() == 0 {
			delete(ss.dispatchers, sipCallID)
		}
	}
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

func callIDOrDefault(node *GraphNode) string {
	if node.CallID == "" {
		return defaultCallID
	}
	return node.CallID
}

func (ex *Executor) emitNodeActionLog(node *GraphNode, instanceID, message, level string, opts ...ActionLogOption) {
	if node == nil {
		ex.engine.emitActionLog("", instanceID, message, level, opts...)
		return
	}

	mergedOpts := append([]ActionLogOption{}, opts...)
	mergedOpts = append(mergedOpts, WithCallID(callIDOrDefault(node)))
	ex.engine.emitActionLog(node.ID, instanceID, message, level, mergedOpts...)
}

// CloseAll은 모든 dialog의 Close를 호출한다
func (ss *SessionStore) CloseAll() {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	for _, dialog := range ss.dialogs {
		_ = dialog.Close()
	}
}

func (ss *SessionStore) GetSIPCallID(instanceID, callID string) (string, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()

	sipCallID, exists := ss.sipCallMappings[sessionKey(instanceID, callID)]
	return sipCallID, exists
}

func (ss *SessionStore) emitSIPEventBySIPCallID(sipCallID, instanceID string, eventType eventhandler.SIPEventType, logicalCallID string, statusCode int) {
	if sipCallID == "" {
		return
	}

	ss.mu.Lock()
	dispatcher := ss.ensureDispatcherLocked(sipCallID)
	ss.mu.Unlock()

	dispatcher.Notify(eventhandler.Event{
		Type:          eventType,
		SIPCallID:     sipCallID,
		InstanceID:    instanceID,
		LogicalCallID: logicalCallID,
		StatusCode:    statusCode,
	})
}

// emitSIPEvent는 logical call ID에 매핑된 SIP Call-ID dispatcher로 이벤트를 보낸다.
func (ss *SessionStore) emitSIPEvent(instanceID, eventType, callID string) {
	sipCallID, exists := ss.GetSIPCallID(instanceID, callID)
	if !exists {
		return
	}
	ss.emitSIPEventBySIPCallID(sipCallID, instanceID, eventhandler.SIPEventType(eventType), callID, 0)
}

func (ss *SessionStore) EmitSIPEvent(instanceID string, eventType eventhandler.SIPEventType, callID string) {
	sipCallID, exists := ss.GetSIPCallID(instanceID, callID)
	if !exists {
		return
	}
	ss.emitSIPEventBySIPCallID(sipCallID, instanceID, eventType, callID, 0)
}

func (ss *SessionStore) SubscribeSIPEventHandlerBySIPCallID(sipCallID string, listener eventhandler.Listener) error {
	if sipCallID == "" {
		return fmt.Errorf("SIP Call-ID is required")
	}

	ss.mu.Lock()
	dispatcher := ss.ensureDispatcherLocked(sipCallID)
	dispatcher.Register(listener)
	ss.mu.Unlock()
	return nil
}

func (ss *SessionStore) SubscribeSIPEventHandler(instanceID, callID string, listener eventhandler.Listener) (string, error) {
	sipCallID, exists := ss.GetSIPCallID(instanceID, callID)
	if !exists || sipCallID == "" {
		return "", fmt.Errorf("no SIP Call-ID for instance %s (callID: %s)", instanceID, callID)
	}
	if err := ss.SubscribeSIPEventHandlerBySIPCallID(sipCallID, listener); err != nil {
		return "", err
	}
	return sipCallID, nil
}

func (ss *SessionStore) UnsubscribeSIPEventHandler(sipCallID string, listener eventhandler.Listener) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	dispatcher, exists := ss.dispatchers[sipCallID]
	if !exists {
		return
	}

	dispatcher.Deregister(listener)
	if dispatcher.ListenerCount() == 0 {
		delete(ss.dispatchers, sipCallID)
	}
}

// Executor는 시나리오 그래프의 노드를 실행한다
type Executor struct {
	engine   *Engine          // 이벤트 발행용 부모 참조
	im       *InstanceManager // UA 조회용
	sessions *SessionStore    // 활성 세션 저장소
}

type answerReferDialog interface {
	diago.DialogSession
	Invite(ctx context.Context, opts diago.InviteClientOptions) error
	Ack(ctx context.Context) error
}

type referClientTransferDialog interface {
	diago.DialogSession
	ReferOptions(ctx context.Context, referTo sip.Uri, opts diago.ReferClientOptions) error
}

type referServerTransferDialog interface {
	diago.DialogSession
	ReferOptions(ctx context.Context, referTo sip.Uri, opts diago.ReferServerOptions) error
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
	case string(SIPCommandMakeCall):
		return ex.executeMakeCall(ctx, instanceID, node)
	case string(SIPCommandAnswer):
		return ex.executeAnswer(ctx, instanceID, node)
	case string(SIPCommandRelease):
		return ex.executeRelease(ctx, instanceID, node)
	case string(SIPCommandPlayAudio):
		return ex.executePlayAudio(ctx, instanceID, node)
	case string(SIPCommandSendDTMF):
		return ex.executeSendDTMF(ctx, instanceID, node)
	case string(SIPCommandHold):
		return ex.executeHold(ctx, instanceID, node)
	case string(SIPCommandRetrieve):
		return ex.executeRetrieve(ctx, instanceID, node)
	case string(SIPCommandBlindTransfer):
		return ex.executeBlindTransfer(ctx, instanceID, node)
	case string(SIPCommandMuteTransfer):
		return ex.executeMuteTransfer(ctx, instanceID, node)
	default:
		return fmt.Errorf("unknown command: %s", node.Command)
	}
}

// executeMakeCall은 MakeCall 커맨드를 실행한다
func (ex *Executor) executeMakeCall(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.emitNodeActionLog(node, instanceID, fmt.Sprintf("MakeCall to %s", node.TargetURI), "info")

	// TargetURI / DN 검증
	if node.TargetURI == "" {
		return fmt.Errorf("MakeCall requires a targetUri")
	}

	resolvedTargetURI, err := ex.im.ResolveTarget(node.TargetURI)
	if err != nil {
		return fmt.Errorf("failed to resolve target %q: %w", node.TargetURI, err)
	}
	if !strings.HasPrefix(resolvedTargetURI, "sip:") {
		return fmt.Errorf("resolved targetUri must start with sip: scheme")
	}

	// URI 파싱
	var recipient sip.Uri
	if err := sip.ParseUri(resolvedTargetURI, &recipient); err != nil {
		return fmt.Errorf("invalid targetUri %q: %w", resolvedTargetURI, err)
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
	ex.sessions.StoreDialog(instanceID, callIDOrDefault(node), dialog)

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	// Note: diago DialogSession 인터페이스에서 Call-ID 접근이 제한되어 빈 문자열 사용
	fromURI := instance.Config.DN // 발신자는 인스턴스의 DN
	toURI := recipient.User       // 수신자는 TargetURI의 User
	successMessage := "MakeCall succeeded"
	if node.TargetURI != resolvedTargetURI {
		successMessage = fmt.Sprintf("MakeCall succeeded (%s -> %s)", node.TargetURI, resolvedTargetURI)
	}
	ex.emitNodeActionLog(node, instanceID, successMessage, "info",
		WithSIPMessage("sent", "INVITE", 200, "", fromURI, toURI))
	return nil
}

// executeAnswer는 Answer 커맨드를 실행한다 (AnswerOptions 기반)
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.emitNodeActionLog(node, instanceID, "Answer incoming call", "info")

	// Incoming server session 조회
	callID := callIDOrDefault(node)
	dialog, exists := ex.sessions.GetDialog(instanceID, callID)
	if !exists {
		return fmt.Errorf("no incoming dialog to answer for instance %s (callID: %s)", instanceID, callID)
	}

	serverSession, ok := dialog.(*diago.DialogServerSession)
	if !ok {
		return fmt.Errorf("dialog for callID %s is %T, not DialogServerSession", callID, dialog)
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
						ex.emitNodeActionLog(node, instanceID,
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
					ex.engine.emitSIPEvent(instanceID, eventhandler.SIPEventHeld, callID)
					ex.emitNodeActionLog(node, instanceID, "Call HELD by remote party", "info",
						WithSIPMessage("received", "INVITE", 200, "", "", "", "recvonly"))
				} else if strings.Contains(localSDP, "a=sendrecv") {
					// 상대방이 Retrieve 요청 (sendrecv) → RETRIEVED 이벤트
					ex.engine.emitSIPEvent(instanceID, eventhandler.SIPEventRetrieved, callID)
					ex.emitNodeActionLog(node, instanceID, "Call RETRIEVED by remote party", "info",
						WithSIPMessage("received", "INVITE", 200, "", "", "", "sendrecv"))
				}
			}()
		},
		// OnRefer: 상대방 REFER 수신 시 콜백 (Refer-To URI 추출 + 새 dialog 활성화 + SessionStore 교체)
		OnRefer: func(referDialog *diago.DialogClientSession) error {
			return ex.handleAnswerRefer(instanceID, callID, node, referDialog)
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
				ex.emitNodeActionLog(node, instanceID,
					fmt.Sprintf("Instance codecs: %v", instance.Config.Codecs), "debug")
			}
			ex.emitNodeActionLog(node, instanceID,
				fmt.Sprintf("Codec negotiation failed (488 Not Acceptable): %v", err), "error")
			return fmt.Errorf("codec negotiation failed (488 Not Acceptable): %w", err)
		}
		return fmt.Errorf("Answer failed: %w", err)
	}

	// Server session을 dialog로도 저장
	ex.sessions.StoreDialog(instanceID, callID, serverSession)

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	fromUser := serverSession.FromUser()
	toUser := serverSession.ToUser()
	ex.emitNodeActionLog(node, instanceID, "Answer succeeded", "info",
		WithSIPMessage("received", "INVITE", 200, "", fromUser, toUser))
	return nil
}

func referToURIString(referDialog answerReferDialog) string {
	dialogSIP := referDialog.DialogSIP()
	if dialogSIP == nil || dialogSIP.InviteRequest == nil {
		return "<unknown>"
	}
	return dialogSIP.InviteRequest.Recipient.String()
}

func referHasReplaces(referDialog answerReferDialog) bool {
	dialogSIP := referDialog.DialogSIP()
	if dialogSIP == nil || dialogSIP.InviteRequest == nil {
		return false
	}

	referTo := dialogSIP.InviteRequest.Recipient
	if referTo.Headers == nil {
		return false
	}

	replaces, ok := referTo.Headers.Get("Replaces")
	return ok && replaces != ""
}

func (ex *Executor) handleAnswerRefer(instanceID, callID string, node *GraphNode, referDialog answerReferDialog) error {
	referToURIStr := referToURIString(referDialog)
	hasReplaces := referHasReplaces(referDialog)
	receivedMessage := fmt.Sprintf("REFER received: Refer-To=%s", referToURIStr)
	if hasReplaces {
		receivedMessage = fmt.Sprintf("REFER received with Replaces: Refer-To=%s", referToURIStr)
	}

	ex.emitNodeActionLog(node, instanceID,
		receivedMessage, "info",
		WithSIPMessage("received", "REFER", 202, "", "", referToURIStr))

	inviteCtx := referDialog.Context()
	if err := referDialog.Invite(inviteCtx, diago.InviteClientOptions{}); err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("TransferEvent: Invite to Refer-To failed: %v", err), "error")
		return fmt.Errorf("TransferEvent: referDialog Invite failed: %w", err)
	}
	if err := referDialog.Ack(inviteCtx); err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("TransferEvent: Ack failed: %v", err), "error")
		return fmt.Errorf("TransferEvent: referDialog Ack failed: %w", err)
	}

	ex.sessions.StoreDialog(instanceID, callID, referDialog)
	ex.engine.emitSIPEvent(instanceID, eventhandler.SIPEventTransferred, callID)

	successMessage := fmt.Sprintf("TransferEvent: session replaced with new dialog (Refer-To: %s)", referToURIStr)
	if hasReplaces {
		successMessage = fmt.Sprintf("TransferEvent: session replaced with Replaces dialog (Refer-To: %s)", referToURIStr)
	}
	ex.emitNodeActionLog(node, instanceID,
		successMessage, "info")
	return nil
}

// executeRelease는 Release 커맨드를 실행한다
func (ex *Executor) executeRelease(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.emitNodeActionLog(node, instanceID, "Release call", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
	if !exists {
		// 이미 종료된 경우 경고 후 성공 처리
		ex.emitNodeActionLog(node, instanceID, "No active dialog to release (already terminated)", "warn")
		return nil
	}

	// 5초 타임아웃으로 Hangup
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := dialog.Hangup(hangupCtx); err != nil {
		// Hangup 실패는 경고만 (이미 종료된 경우 등)
		ex.emitNodeActionLog(node, instanceID, fmt.Sprintf("Hangup warning: %v", err), "warn")
	}

	// 성공 로그 (SIP 메시지 상세 정보 포함)
	ex.emitNodeActionLog(node, instanceID, "Release succeeded", "info",
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
	ex.emitNodeActionLog(node, instanceID, fmt.Sprintf("Waiting for %s (timeout: %v)", node.Event, timeout), "info")

	switch node.Event {
	case string(eventhandler.SIPEventIncoming):
		return ex.executeIncoming(timeoutCtx, instanceID, node, timeout)
	case string(eventhandler.SIPEventDisconnected):
		return ex.executeDisconnected(timeoutCtx, instanceID, node, timeout)
	case string(eventhandler.SIPEventRinging):
		return ex.executeRinging(timeoutCtx, instanceID, node)
	case string(eventhandler.SIPEventTimeout):
		return ex.executeTimeout(timeoutCtx, instanceID, node, timeout)
	case string(eventhandler.SIPEventDTMFReceived):
		return ex.executeDTMFReceived(timeoutCtx, instanceID, node)
	case string(eventhandler.SIPEventHeld):
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, eventhandler.SIPEventHeld, timeout)
	case string(eventhandler.SIPEventRetrieved):
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, eventhandler.SIPEventRetrieved, timeout)
	case string(eventhandler.SIPEventTransferred):
		return ex.executeWaitSIPEvent(timeoutCtx, instanceID, node, eventhandler.SIPEventTransferred, timeout)
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
		callID := callIDOrDefault(node)
		ex.sessions.StoreDialog(instanceID, callID, inDialog)

		// 성공 로그 (SIP 메시지 상세 정보 포함)
		fromUser := inDialog.FromUser()
		toUser := inDialog.ToUser()
		ex.emitNodeActionLog(node, instanceID, fmt.Sprintf("INCOMING event received from %s (callID: %s)", fromUser, callID), "info",
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
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
	if !exists {
		return fmt.Errorf("no active dialog for DISCONNECTED event")
	}

	// dialog context Done 대기
	select {
	case <-dialog.Context().Done():
		// 성공 로그
		ex.emitNodeActionLog(node, instanceID, "DISCONNECTED event received", "info")
		return nil
	case <-ctx.Done():
		// 타임아웃
		return fmt.Errorf("DISCONNECTED event timeout after %v", timeout)
	}
}

// executeRinging은 RINGING 이벤트를 처리한다 (로컬 모드에서는 즉시 완료)
func (ex *Executor) executeRinging(ctx context.Context, instanceID string, node *GraphNode) error {
	// Phase 03에서는 MakeCall 성공 시 이미 180 Ringing을 거쳤으므로 즉시 완료
	ex.emitNodeActionLog(node, instanceID, "RINGING event (auto-completed in local mode)", "info",
		WithSIPMessage("received", string(eventhandler.SIPEventRinging), 180, "", "", ""))
	return nil
}

// executeTimeout은 TIMEOUT 이벤트를 처리한다 (단순 딜레이)
func (ex *Executor) executeTimeout(ctx context.Context, instanceID string, node *GraphNode, timeout time.Duration) error {
	// time.After로 딜레이
	select {
	case <-time.After(timeout):
		// 성공 로그
		ex.emitNodeActionLog(node, instanceID, fmt.Sprintf("TIMEOUT event completed after %v", timeout), "info")
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
		ex.emitNodeActionLog(node, instanceID, "PlayAudio requires filePath", "error")
		return fmt.Errorf("PlayAudio requires filePath")
	}

	// 파일 존재 확인
	if _, err := os.Stat(node.FilePath); err != nil {
		if os.IsNotExist(err) {
			ex.emitNodeActionLog(node, instanceID,
				fmt.Sprintf("Audio file not found: %s", node.FilePath), "error")
			return fmt.Errorf("audio file not found: %s", node.FilePath)
		}
		return fmt.Errorf("cannot access audio file: %w", err)
	}

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
	if !exists {
		ex.emitNodeActionLog(node, instanceID,
			"No active dialog for PlayAudio (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for PlayAudio")
	}

	// WAV 파일 열기
	file, err := os.Open(node.FilePath)
	if err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("Failed to open audio file: %v", err), "error")
		return fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	// Playback 인스턴스 생성
	pb, err := dialog.Media().PlaybackCreate()
	if err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("PlaybackCreate failed: %v", err), "error")
		return fmt.Errorf("PlaybackCreate failed: %w", err)
	}

	// 파일명 추출
	fileName := filepath.Base(node.FilePath)
	ex.emitNodeActionLog(node, instanceID,
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
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("Playback failed: %v", err), "error")
		return fmt.Errorf("Play failed: %w", err)
	}

	// 재생 완료 로그
	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("Playback completed (%d bytes)", bytesPlayed), "info")

	return nil
}

// executeSendDTMF는 SendDTMF 커맨드를 실행한다
func (ex *Executor) executeSendDTMF(ctx context.Context, instanceID string, node *GraphNode) error {
	// Digits 검증
	if node.Digits == "" {
		ex.emitNodeActionLog(node, instanceID, "SendDTMF requires digits", "error")
		return fmt.Errorf("SendDTMF requires digits")
	}

	// Interval 계산
	interval := time.Duration(node.IntervalMs) * time.Millisecond

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
	if !exists {
		ex.emitNodeActionLog(node, instanceID,
			"No active dialog for SendDTMF (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for SendDTMF")
	}

	// DTMF writer 생성
	dtmfWriter := dialog.Media().AudioWriterDTMF()

	// 전송 시작 로그
	ex.emitNodeActionLog(node, instanceID,
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
			ex.emitNodeActionLog(node, instanceID,
				fmt.Sprintf("Invalid DTMF digit: %c", digit), "error")
			return fmt.Errorf("invalid DTMF digit: %c (allowed: 0-9, *, #, A-D)", digit)
		}

		// DTMF 전송
		if err := dtmfWriter.WriteDTMF(digit); err != nil {
			ex.emitNodeActionLog(node, instanceID,
				fmt.Sprintf("Failed to send DTMF %c: %v", digit, err), "error")
			return fmt.Errorf("WriteDTMF failed for %c: %w", digit, err)
		}

		ex.emitNodeActionLog(node, instanceID,
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

	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("DTMF transmission completed (%d digits)", len(digits)), "info")
	return nil
}

// executeDTMFReceived는 DTMFReceived 이벤트를 실행한다
func (ex *Executor) executeDTMFReceived(ctx context.Context, instanceID string, node *GraphNode) error {
	// ExpectedDigit 파싱 (optional)
	expectedDigit := node.ExpectedDigit

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
	if !exists {
		ex.emitNodeActionLog(node, instanceID,
			"No active dialog for DTMFReceived (call must be answered first)", "error")
		return fmt.Errorf("no active dialog for DTMFReceived")
	}

	// DTMF reader 생성
	dtmfReader := dialog.Media().AudioReaderDTMF()

	// 대기 상태 로그
	if expectedDigit != "" {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("Waiting for DTMF digit: %s (timeout: %dms)", expectedDigit, node.Timeout.Milliseconds()), "info")
	} else {
		ex.emitNodeActionLog(node, instanceID,
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
					ex.emitNodeActionLog(node, instanceID,
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
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("Received DTMF: %c", digit), "info")
		return nil
	case err := <-errCh:
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("DTMF receive error: %v", err), "error")
		return fmt.Errorf("DTMF receive failed: %w", err)
	case <-time.After(node.Timeout):
		ex.emitNodeActionLog(node, instanceID, "DTMF receive timeout", "warning")
		return fmt.Errorf("timeout waiting for DTMF")
	}
}

// executeHold는 Hold 커맨드를 실행한다 — MediaSession.Mode를 sendonly로 설정하고 Re-INVITE를 전송한다
func (ex *Executor) executeHold(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.emitNodeActionLog(node, instanceID, "Hold: sending Re-INVITE (sendonly)", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
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
	ex.emitNodeActionLog(node, instanceID, "Hold succeeded", "info",
		WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly"))
	return nil
}

// executeRetrieve는 Retrieve 커맨드를 실행한다 — MediaSession.Mode를 sendrecv로 복원하고 Re-INVITE를 전송한다
func (ex *Executor) executeRetrieve(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.emitNodeActionLog(node, instanceID, "Retrieve: sending Re-INVITE (sendrecv)", "info")

	// Dialog 조회
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
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
	ex.emitNodeActionLog(node, instanceID, "Retrieve succeeded", "info",
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
	dialog, exists := ex.sessions.GetDialog(instanceID, callIDOrDefault(node))
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
	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("BlindTransfer: sending REFER to %s", rawURI), "info")

	// 7. Refer 호출
	if err := r.Refer(ctx, referTo); err != nil {
		return fmt.Errorf("BlindTransfer: REFER failed: %w", err)
	}

	// 8. 성공 로그
	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("BlindTransfer succeeded (Refer-To: %s)", rawURI), "info",
		WithSIPMessage("sent", "REFER", 202, "", "", rawURI))

	// 9. 즉시 BYE 전송 (5초 타임아웃)
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := dialog.Hangup(hangupCtx); err != nil {
		// BYE 실패는 경고만 (이미 종료된 경우 등)
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("BlindTransfer: BYE warning: %v", err), "warn")
	} else {
		ex.emitNodeActionLog(node, instanceID, "BlindTransfer: BYE sent", "info",
			WithSIPMessage("sent", "BYE", 200, "", "", ""))
	}

	return nil
}

func muteTransferPrimaryCallID(node *GraphNode) string {
	if node.PrimaryCallID != "" {
		return node.PrimaryCallID
	}
	return callIDOrDefault(node)
}

type transferTargetDialog interface {
	diago.DialogSession
	RemoteContact() *sip.ContactHeader
}

type muteTransferContext struct {
	primaryCallID string
	primarySIPID  string
	consultCallID string
	primaryDialog diago.DialogSession
	consultDialog diago.DialogSession
	referTo       sip.Uri
	referToStr    string
}

func buildMuteTransferReferTo(dialog transferTargetDialog) (sip.Uri, string, error) {
	dialogSIP := dialog.DialogSIP()
	if dialogSIP == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog SIP state is missing")
	}
	if dialogSIP.InviteRequest == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog INVITE request is missing")
	}
	if dialogSIP.InviteResponse == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog INVITE response is missing")
	}

	callIDHeader := dialogSIP.InviteRequest.CallID()
	if callIDHeader == nil || callIDHeader.Value() == "" {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog Call-ID is missing")
	}

	fromHeader := dialogSIP.InviteRequest.From()
	if fromHeader == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog From header is missing")
	}
	fromTag, ok := fromHeader.Params.Get("tag")
	if !ok || fromTag == "" {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog from-tag is missing")
	}

	toHeader := dialogSIP.InviteResponse.To()
	if toHeader == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog To header is missing")
	}
	toTag, ok := toHeader.Params.Get("tag")
	if !ok || toTag == "" {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog to-tag is missing")
	}

	remoteContact := dialog.RemoteContact()
	if remoteContact == nil {
		return sip.Uri{}, "", fmt.Errorf("MuteTransfer: consult dialog remote contact is missing")
	}

	referTo := *remoteContact.Address.Clone()
	if referTo.Headers == nil {
		referTo.Headers = sip.NewParams()
	}

	replaces := fmt.Sprintf("%s;to-tag=%s;from-tag=%s", callIDHeader.Value(), toTag, fromTag)
	referTo.Headers.Add("Replaces", url.QueryEscape(replaces))

	return referTo, referTo.String(), nil
}

func (ex *Executor) buildMuteTransferContext(instanceID string, node *GraphNode) (*muteTransferContext, error) {
	primaryCallID := muteTransferPrimaryCallID(node)
	if primaryCallID == "" {
		return nil, fmt.Errorf("MuteTransfer: primaryCallId is required")
	}
	if node.ConsultCallID == "" {
		return nil, fmt.Errorf("MuteTransfer: consultCallId is required")
	}

	primaryDialog, exists := ex.sessions.GetDialog(instanceID, primaryCallID)
	if !exists {
		return nil, fmt.Errorf("MuteTransfer: no primary dialog for instance %s (callID: %s)", instanceID, primaryCallID)
	}

	consultDialog, exists := ex.sessions.GetDialog(instanceID, node.ConsultCallID)
	if !exists {
		return nil, fmt.Errorf("MuteTransfer: no consult dialog for instance %s (callID: %s)", instanceID, node.ConsultCallID)
	}

	transferDialog, ok := consultDialog.(transferTargetDialog)
	if !ok {
		return nil, fmt.Errorf("MuteTransfer: consult dialog type %T does not expose remote contact", consultDialog)
	}

	referTo, referToStr, err := buildMuteTransferReferTo(transferDialog)
	if err != nil {
		return nil, err
	}
	primarySIPID, exists := ex.sessions.GetSIPCallID(instanceID, primaryCallID)
	if !exists || primarySIPID == "" {
		return nil, fmt.Errorf("MuteTransfer: no SIP Call-ID for primary dialog %s", primaryCallID)
	}

	return &muteTransferContext{
		primaryCallID: primaryCallID,
		primarySIPID:  primarySIPID,
		consultCallID: node.ConsultCallID,
		primaryDialog: primaryDialog,
		consultDialog: consultDialog,
		referTo:       referTo,
		referToStr:    referToStr,
	}, nil
}

func (ex *Executor) createMuteTransferNotifyContext(ctx context.Context, node *GraphNode) (context.Context, context.CancelFunc, time.Duration) {
	notifyCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	notifyTimeout := 30 * time.Second
	if node.Timeout > 0 {
		notifyTimeout = node.Timeout
		cancel()
		notifyCtx, cancel = context.WithTimeout(ctx, notifyTimeout)
	}
	return notifyCtx, cancel, notifyTimeout
}

func (ex *Executor) executeMuteTransferRefer(ctx context.Context, instanceID string, node *GraphNode, transfer *muteTransferContext, onNotify func(statusCode int)) error {
	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("MuteTransfer: sending REFER to %s (primary: %s, consult: %s)", transfer.referToStr, transfer.primaryCallID, transfer.consultCallID), "info")

	var err error
	switch dialog := transfer.primaryDialog.(type) {
	case referClientTransferDialog:
		err = dialog.ReferOptions(ctx, transfer.referTo, diago.ReferClientOptions{OnNotify: onNotify})
	case referServerTransferDialog:
		err = dialog.ReferOptions(ctx, transfer.referTo, diago.ReferServerOptions{OnNotify: onNotify})
	default:
		err = fmt.Errorf("MuteTransfer: primary dialog type %T does not support ReferOptions", transfer.primaryDialog)
	}
	if err != nil {
		return fmt.Errorf("MuteTransfer: REFER failed: %w", err)
	}

	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("MuteTransfer: REFER accepted (Refer-To: %s)", transfer.referToStr), "info",
		WithSIPMessage("sent", "REFER", 202, "", "", transfer.referToStr))
	return nil
}

func (ex *Executor) handleMuteTransferNotifyProgress(instanceID string, node *GraphNode, statusCode int) {
	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("MuteTransfer: NOTIFY progress %d", statusCode), "info",
		WithSIPMessage("received", "NOTIFY", statusCode, "", "", ""))
}

func (ex *Executor) cleanupMuteTransferDialogs(ctx context.Context, instanceID string, transfer *muteTransferContext, node *GraphNode) {
	hangupCtx, hangupCancel := context.WithTimeout(ctx, 5*time.Second)
	defer hangupCancel()

	if err := transfer.primaryDialog.Hangup(hangupCtx); err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("MuteTransfer: primary BYE warning: %v", err), "warn")
	} else {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("MuteTransfer: primary BYE sent (callID: %s)", transfer.primaryCallID), "info",
			WithSIPMessage("sent", "BYE", 200, "", "", ""))
	}

	if err := transfer.consultDialog.Hangup(hangupCtx); err != nil {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("MuteTransfer: consult BYE warning: %v", err), "warn")
	} else {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("MuteTransfer: consult BYE sent (callID: %s)", transfer.consultCallID), "info",
			WithSIPMessage("sent", "BYE", 200, "", "", ""))
	}

	ex.sessions.DeleteDialog(instanceID, transfer.primaryCallID)
	ex.sessions.DeleteDialog(instanceID, transfer.consultCallID)
}

func (ex *Executor) handleMuteTransferNotifyFinal(ctx context.Context, instanceID string, node *GraphNode, transfer *muteTransferContext, statusCode int) error {
	if statusCode >= 300 {
		return fmt.Errorf("MuteTransfer: final NOTIFY failed with status %d", statusCode)
	}

	ex.emitNodeActionLog(node, instanceID,
		fmt.Sprintf("MuteTransfer succeeded (primary: %s, consult: %s)", transfer.primaryCallID, transfer.consultCallID), "info",
		WithSIPMessage("received", "NOTIFY", statusCode, "", "", ""))

	ex.cleanupMuteTransferDialogs(ctx, instanceID, transfer, node)
	return nil
}

func (ex *Executor) createNotifyHandler(ctx context.Context, instanceID string, node *GraphNode, transfer *muteTransferContext, notifyTimeout time.Duration) *eventhandler.Handler {
	handler := eventhandler.NewHandler(4)
	handler.SetTimer(notifyTimeout)
	handler.SetHandler(eventhandler.SIPEventNotify, func(handlerCtx context.Context, event eventhandler.Event, done eventhandler.DoneFn) error {
		if event.StatusCode < 200 {
			ex.handleMuteTransferNotifyProgress(instanceID, node, event.StatusCode)
			return nil
		}

		if err := ex.handleMuteTransferNotifyFinal(ctx, instanceID, node, transfer, event.StatusCode); err != nil {
			return err
		}
		done()
		return nil
	})
	return handler
}

func (ex *Executor) executeMuteTransfer(ctx context.Context, instanceID string, node *GraphNode) error {
	transfer, err := ex.buildMuteTransferContext(instanceID, node)
	if err != nil {
		return err
	}

	notifyCtx, cancel, notifyTimeout := ex.createMuteTransferNotifyContext(ctx, node)
	defer cancel()

	handler := ex.createNotifyHandler(ctx, instanceID, node, transfer, notifyTimeout)
	defer handler.Close()
	if err := ex.sessions.SubscribeSIPEventHandlerBySIPCallID(transfer.primarySIPID, handler); err != nil {
		return err
	}
	defer ex.sessions.UnsubscribeSIPEventHandler(transfer.primarySIPID, handler)

	onNotify := func(statusCode int) {
		ex.sessions.emitSIPEventBySIPCallID(transfer.primarySIPID, instanceID, eventhandler.SIPEventNotify, transfer.primaryCallID, statusCode)
	}

	if err := ex.executeMuteTransferRefer(notifyCtx, instanceID, node, transfer, onNotify); err != nil {
		return err
	}

	if err := handler.Poll(notifyCtx); err != nil {
		if errors.Is(err, eventhandler.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("MuteTransfer: final NOTIFY timeout after %v", notifyTimeout)
		}
		return err
	}
	return nil
}

// executeWaitSIPEvent는 SessionStore SIP 이벤트 버스에서 특정 이벤트를 블로킹 대기한다
func (ex *Executor) executeWaitSIPEvent(ctx context.Context, instanceID string, node *GraphNode, eventType eventhandler.SIPEventType, timeout time.Duration) error {
	callID := callIDOrDefault(node)
	handler := eventhandler.NewHandler(4)
	handler.SetTimer(timeout)
	handler.SetHandler(eventType, func(handlerCtx context.Context, event eventhandler.Event, done eventhandler.DoneFn) error {
		ex.emitNodeActionLog(node, instanceID,
			fmt.Sprintf("%s event received (callID: %s, sipCallID: %s)", eventType, callID, event.SIPCallID), "info")
		done()
		return nil
	})
	defer handler.Close()

	sipCallID, err := ex.sessions.SubscribeSIPEventHandler(instanceID, callID, handler)
	if err != nil {
		return err
	}
	defer ex.sessions.UnsubscribeSIPEventHandler(sipCallID, handler)

	if err := handler.Poll(ctx); err != nil {
		if errors.Is(err, eventhandler.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("%s event timeout after %v", eventType, timeout)
		}
		return err
	}
	return nil
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
