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
	"github.com/emiago/sipgo/sip"
)

// SessionStore는 활성 SIP 세션을 thread-safe하게 관리한다
type SessionStore struct {
	mu             sync.RWMutex
	dialogs        map[string]diago.DialogSession          // instanceID -> dialog session
	serverSessions map[string]*diago.DialogServerSession   // instanceID -> incoming server session
}

// NewSessionStore는 새로운 SessionStore를 생성한다
func NewSessionStore() *SessionStore {
	return &SessionStore{
		dialogs:        make(map[string]diago.DialogSession),
		serverSessions: make(map[string]*diago.DialogServerSession),
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

// executeAnswer는 Answer 커맨드를 실행한다
func (ex *Executor) executeAnswer(ctx context.Context, instanceID string, node *GraphNode) error {
	// 액션 로그 발행
	ex.engine.emitActionLog(node.ID, instanceID, "Answer incoming call", "info")

	// Incoming server session 조회
	serverSession, exists := ex.sessions.GetServerSession(instanceID)
	if !exists {
		return fmt.Errorf("no incoming dialog to answer for instance %s", instanceID)
	}

	// Answer 호출
	if err := serverSession.Answer(); err != nil {
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
	default:
		return fmt.Errorf("event type %s is not supported in Phase 03", node.Event)
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
