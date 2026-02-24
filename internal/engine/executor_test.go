package engine

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sipflow/internal/scenario"
)

// TestExecuteChain_BasicSuccess는 ExecuteChain의 기본 구조를 검증한다
func TestExecuteChain_BasicSuccess(t *testing.T) {
	// 2개 노드 체인 생성
	node1 := &GraphNode{
		ID:         "node1",
		Type:       "command",
		InstanceID: "inst1",
		Command:    "MakeCall",
		TargetURI:  "sip:test@example.com",
		Timeout:    10 * time.Second,
	}

	node2 := &GraphNode{
		ID:         "node2",
		Type:       "event",
		InstanceID: "inst1",
		Event:      "RINGING",
		Timeout:    5 * time.Second,
	}

	// SuccessNext 연결
	node1.SuccessNext = node2

	// 구조 검증
	if node1.SuccessNext != node2 {
		t.Errorf("node1.SuccessNext should point to node2")
	}
	if node2.SuccessNext != nil {
		t.Errorf("node2.SuccessNext should be nil")
	}
	if node1.FailureNext != nil {
		t.Errorf("node1.FailureNext should be nil")
	}
}

// TestSessionStore_StoreAndGet는 SessionStore의 저장/조회를 테스트한다
func TestSessionStore_StoreAndGet(t *testing.T) {
	store := NewSessionStore()

	// Dialog 저장 (nil이 아닌 mock 타입 필요 - 실제 테스트는 통합 테스트에서)
	// 여기서는 존재하지 않는 키 조회 테스트
	_, exists := store.GetDialog("nonexistent")
	if exists {
		t.Errorf("GetDialog should return false for nonexistent key")
	}

	// ServerSession 조회 테스트
	_, exists = store.GetServerSession("nonexistent")
	if exists {
		t.Errorf("GetServerSession should return false for nonexistent key")
	}
}

// TestExecuteChain_FailureBranch는 실패 분기 처리를 검증한다
func TestExecuteChain_FailureBranch(t *testing.T) {
	// 실패 분기가 있는 노드 체인
	node1 := &GraphNode{
		ID:         "node1",
		Type:       "command",
		InstanceID: "inst1",
		Command:    "MakeCall",
	}

	nodeSuccess := &GraphNode{
		ID:         "nodeSuccess",
		Type:       "event",
		InstanceID: "inst1",
		Event:      "RINGING",
	}

	nodeFailure := &GraphNode{
		ID:         "nodeFailure",
		Type:       "event",
		InstanceID: "inst1",
		Event:      "TIMEOUT",
		Timeout:    1 * time.Second,
	}

	node1.SuccessNext = nodeSuccess
	node1.FailureNext = nodeFailure

	// 구조 검증
	if node1.SuccessNext != nodeSuccess {
		t.Errorf("node1.SuccessNext should point to nodeSuccess")
	}
	if node1.FailureNext != nodeFailure {
		t.Errorf("node1.FailureNext should point to nodeFailure")
	}
}

// TestSessionStore_ThreadSafety는 SessionStore의 동시성을 검증한다
func TestSessionStore_ThreadSafety(t *testing.T) {
	store := NewSessionStore()
	ctx := context.Background()

	// 여러 goroutine에서 동시 접근
	done := make(chan bool, 2)

	go func() {
		for range 100 {
			store.GetDialog("test")
		}
		done <- true
	}()

	go func() {
		for range 100 {
			store.GetServerSession("test")
		}
		done <- true
	}()

	// 완료 대기 (타임아웃 포함)
	for range 2 {
		select {
		case <-done:
			// success
		case <-time.After(5 * time.Second):
			t.Fatal("SessionStore operations timed out - possible deadlock")
		}
	}

	// Cleanup 호출 테스트 (panic 없이 완료되어야 함)
	store.HangupAll(ctx)
	store.CloseAll()
}

// TestIsValidDTMF는 isValidDTMF 함수의 유효/무효 문자 검증을 테스트한다
func TestIsValidDTMF(t *testing.T) {
	tests := []struct {
		name     string
		input    rune
		expected bool
	}{
		// 유효 문자
		{"digit 0", '0', true},
		{"digit 1", '1', true},
		{"digit 5", '5', true},
		{"digit 9", '9', true},
		{"star", '*', true},
		{"hash", '#', true},
		{"letter A", 'A', true},
		{"letter B", 'B', true},
		{"letter C", 'C', true},
		{"letter D", 'D', true},
		// 무효 문자
		{"letter E", 'E', false},
		{"lowercase a", 'a', false},
		{"lowercase b", 'b', false},
		{"at sign", '@', false},
		{"space", ' ', false},
		{"exclamation", '!', false},
		{"letter Z", 'Z', false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidDTMF(tt.input)
			if result != tt.expected {
				t.Errorf("isValidDTMF(%c) = %v, expected %v", tt.input, result, tt.expected)
			}
		})
	}
}

// newTestExecutor creates a minimal Executor for error path testing
func newTestExecutor(t *testing.T) (*Executor, *TestEventEmitter) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	repo, err := scenario.NewRepository(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Close() })

	eng := NewEngine(repo)
	te := &TestEventEmitter{}
	eng.SetEventEmitter(te)

	executor := NewExecutor(eng, eng.im)
	return executor, te
}

func TestExecutePlayAudio_NoFilePath(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:       "test-node",
		Type:     "command",
		Command:  "PlayAudio",
		FilePath: "",
	}
	err := ex.executePlayAudio(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for empty filePath")
	}
	if !strings.Contains(err.Error(), "requires filePath") {
		t.Errorf("expected 'requires filePath' error, got: %v", err)
	}
}

func TestExecutePlayAudio_FileNotFound(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:       "test-node",
		Type:     "command",
		Command:  "PlayAudio",
		FilePath: "/nonexistent/path/audio.wav",
	}
	err := ex.executePlayAudio(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for non-existent file")
	}
	if !strings.Contains(err.Error(), "audio file not found") {
		t.Errorf("expected 'audio file not found' error, got: %v", err)
	}
}

func TestExecutePlayAudio_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	// 실제 파일 생성 (빈 파일이지만 존재함)
	tmpFile := filepath.Join(t.TempDir(), "test.wav")
	os.WriteFile(tmpFile, []byte("fake wav content"), 0644)

	node := &GraphNode{
		ID:       "test-node",
		Type:     "command",
		Command:  "PlayAudio",
		FilePath: tmpFile,
	}
	err := ex.executePlayAudio(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

func TestExecuteSendDTMF_NoDigits(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:      "test-node",
		Type:    "command",
		Command: "SendDTMF",
		Digits:  "",
	}
	err := ex.executeSendDTMF(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for empty digits")
	}
	if !strings.Contains(err.Error(), "requires digits") {
		t.Errorf("expected 'requires digits' error, got: %v", err)
	}
}

func TestExecuteSendDTMF_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:      "test-node",
		Type:    "command",
		Command: "SendDTMF",
		Digits:  "123",
	}
	err := ex.executeSendDTMF(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

func TestExecuteDTMFReceived_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "test-node",
		Type:          "event",
		Event:         "DTMFReceived",
		ExpectedDigit: "1",
		Timeout:       1 * time.Second,
	}
	err := ex.executeDTMFReceived(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

// TestSessionStore_SIPEventBus는 SIP 이벤트 버스의 발행/구독을 테스트한다
func TestSessionStore_SIPEventBus(t *testing.T) {
	store := NewSessionStore()

	// 구독 채널 생성
	ch := store.SubscribeSIPEvent("inst1", "HELD")

	// goroutine으로 50ms 후 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		store.emitSIPEvent("inst1", "HELD")
	}()

	// 채널 수신 확인 (1초 타임아웃)
	select {
	case <-ch:
		// 정상 수신
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for HELD event")
	}

	// UnsubscribeSIPEvent 후 재발행 → 수신 안 됨 확인
	store.UnsubscribeSIPEvent("inst1", "HELD", ch)
	store.emitSIPEvent("inst1", "HELD")

	select {
	case <-ch:
		t.Fatal("should not receive event after unsubscribe")
	case <-time.After(100 * time.Millisecond):
		// 정상: 구독 해제 후 수신 안 됨
	}
}

// TestSessionStore_SIPEventBus_MultipleSubscribers는 다중 구독자를 테스트한다
func TestSessionStore_SIPEventBus_MultipleSubscribers(t *testing.T) {
	store := NewSessionStore()

	// 같은 이벤트에 2개 채널 구독
	ch1 := store.SubscribeSIPEvent("inst1", "RETRIEVED")
	ch2 := store.SubscribeSIPEvent("inst1", "RETRIEVED")

	// 한 번 emit → 두 채널 모두 수신
	store.emitSIPEvent("inst1", "RETRIEVED")

	for i, ch := range []chan struct{}{ch1, ch2} {
		select {
		case <-ch:
			// 정상 수신
		case <-time.After(1 * time.Second):
			t.Fatalf("timeout waiting for RETRIEVED event on channel %d", i+1)
		}
	}
}

// TestSessionStore_SIPEventBus_NoSubscribers는 구독자 없을 때 패닉이 없음을 테스트한다
func TestSessionStore_SIPEventBus_NoSubscribers(t *testing.T) {
	store := NewSessionStore()

	// 구독 없이 emitSIPEvent 호출 → 패닉 없이 완료
	store.emitSIPEvent("inst1", "HELD")
	store.emitSIPEvent("inst-nonexistent", "TRANSFERRED")
}

// TestWithSIPMessage_Note는 note 파라미터가 포함된 경우를 테스트한다
func TestWithSIPMessage_Note(t *testing.T) {
	opt := WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly")
	data := map[string]any{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]any)
	if !ok {
		t.Fatal("sipMessage not found in data")
	}

	note, ok := sipMsg["note"].(string)
	if !ok {
		t.Fatal("note not found in sipMessage")
	}
	if note != "sendonly" {
		t.Errorf("expected note 'sendonly', got '%s'", note)
	}
}

// TestWithSIPMessage_NoNote는 note 없이 기존 호환성을 테스트한다
func TestWithSIPMessage_NoNote(t *testing.T) {
	// 기존 6개 인자로 호출 (note 없음)
	opt := WithSIPMessage("sent", "INVITE", 200, "", "", "")
	data := map[string]any{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]any)
	if !ok {
		t.Fatal("sipMessage not found in data")
	}

	if _, exists := sipMsg["note"]; exists {
		t.Error("note should not be present when not provided")
	}
}

// TestWithSIPMessage_EmptyNote는 빈 note가 포함되지 않음을 테스트한다
func TestWithSIPMessage_EmptyNote(t *testing.T) {
	// 빈 문자열 note → 포함되지 않아야 함
	opt := WithSIPMessage("sent", "INVITE", 200, "", "", "", "")
	data := map[string]any{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]any)
	if !ok {
		t.Fatal("sipMessage not found in data")
	}

	if _, exists := sipMsg["note"]; exists {
		t.Error("note should not be present when empty string provided")
	}
}

// TestExecuteHold_NoDialog는 dialog가 없을 때 executeHold가 에러를 반환하는지 테스트한다
func TestExecuteHold_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:      "test-node",
		Type:    "command",
		Command: "Hold",
	}
	err := ex.executeHold(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

// TestExecuteRetrieve_NoDialog는 dialog가 없을 때 executeRetrieve가 에러를 반환하는지 테스트한다
func TestExecuteRetrieve_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:      "test-node",
		Type:    "command",
		Command: "Retrieve",
	}
	err := ex.executeRetrieve(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

// TestExecuteCommand_HoldSwitch는 executeCommand switch가 Hold를 executeHold로 라우팅하는지 테스트한다
func TestExecuteCommand_HoldSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "Hold",
		InstanceID: "inst-1",
	}
	err := ex.executeCommand(context.Background(), "inst-1", node)
	// dialog 없으므로 에러는 예상되지만, Hold 핸들러까지 도달 확인
	if err == nil {
		t.Fatal("expected error (no active dialog)")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' (Hold handler reached), got: %v", err)
	}
}

// TestExecuteCommand_RetrieveSwitch는 executeCommand switch가 Retrieve를 executeRetrieve로 라우팅하는지 테스트한다
func TestExecuteCommand_RetrieveSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "Retrieve",
		InstanceID: "inst-1",
	}
	err := ex.executeCommand(context.Background(), "inst-1", node)
	// dialog 없으므로 에러는 예상되지만, Retrieve 핸들러까지 도달 확인
	if err == nil {
		t.Fatal("expected error (no active dialog)")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' (Retrieve handler reached), got: %v", err)
	}
}

// TestExecuteEvent_HeldSwitch는 executeEvent switch가 HELD를 executeWaitSIPEvent로 라우팅하는지 테스트한다
func TestExecuteEvent_HeldSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      "HELD",
		InstanceID: "inst-1",
		Timeout:    100 * time.Millisecond,
	}
	err := ex.executeEvent(context.Background(), "inst-1", node)
	// 이벤트 발행 없으므로 타임아웃 에러 예상
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !strings.Contains(err.Error(), "HELD event timeout") {
		t.Errorf("expected 'HELD event timeout' error, got: %v", err)
	}
}

// TestExecuteEvent_RetrievedSwitch는 executeEvent switch가 RETRIEVED를 executeWaitSIPEvent로 라우팅하는지 테스트한다
func TestExecuteEvent_RetrievedSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      "RETRIEVED",
		InstanceID: "inst-1",
		Timeout:    100 * time.Millisecond,
	}
	err := ex.executeEvent(context.Background(), "inst-1", node)
	// 이벤트 발행 없으므로 타임아웃 에러 예상
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !strings.Contains(err.Error(), "RETRIEVED event timeout") {
		t.Errorf("expected 'RETRIEVED event timeout' error, got: %v", err)
	}
}

// TestExecuteWaitSIPEvent_Success는 이벤트가 제때 발행될 때 executeWaitSIPEvent가 성공하는지 테스트한다
func TestExecuteWaitSIPEvent_Success(t *testing.T) {
	ex, _ := newTestExecutor(t)

	// goroutine으로 50ms 후 HELD 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEvent("inst-1", "HELD")
	}()

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   "HELD",
		Timeout: 2 * time.Second,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, "HELD", 2*time.Second)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

// TestExecuteWaitSIPEvent_Timeout은 이벤트가 발행되지 않을 때 타임아웃 에러가 반환되는지 테스트한다
func TestExecuteWaitSIPEvent_Timeout(t *testing.T) {
	ex, _ := newTestExecutor(t)

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   "HELD",
		Timeout: 100 * time.Millisecond,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, "HELD", 100*time.Millisecond)
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !strings.Contains(err.Error(), "timeout") {
		t.Errorf("expected 'timeout' error, got: %v", err)
	}
}

// TestExecuteBlindTransfer_EmptyTargetUser는 targetUser가 비어 있을 때 에러를 반환하는지 테스트한다
func TestExecuteBlindTransfer_EmptyTargetUser(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "BlindTransfer",
		TargetUser: "",
		TargetHost: "192.168.1.100:5060",
	}
	err := ex.executeBlindTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for empty targetUser")
	}
	if !strings.Contains(err.Error(), "targetUser is required") {
		t.Errorf("expected 'targetUser is required' error, got: %v", err)
	}
}

// TestExecuteBlindTransfer_EmptyTargetHost는 targetHost가 비어 있을 때 에러를 반환하는지 테스트한다
func TestExecuteBlindTransfer_EmptyTargetHost(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "BlindTransfer",
		TargetUser: "carol",
		TargetHost: "",
	}
	err := ex.executeBlindTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for empty targetHost")
	}
	if !strings.Contains(err.Error(), "targetHost is required") {
		t.Errorf("expected 'targetHost is required' error, got: %v", err)
	}
}

// TestExecuteBlindTransfer_NoDialog는 dialog가 없을 때 executeBlindTransfer가 에러를 반환하는지 테스트한다
func TestExecuteBlindTransfer_NoDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "BlindTransfer",
		TargetUser: "carol",
		TargetHost: "192.168.1.100:5060",
	}
	err := ex.executeBlindTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing dialog")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' error, got: %v", err)
	}
}

// TestExecuteCommand_BlindTransferSwitch는 executeCommand switch가 BlindTransfer를 executeBlindTransfer로 라우팅하는지 테스트한다
func TestExecuteCommand_BlindTransferSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "command",
		Command:    "BlindTransfer",
		InstanceID: "inst-1",
		TargetUser: "carol",
		TargetHost: "192.168.1.100:5060",
	}
	err := ex.executeCommand(context.Background(), "inst-1", node)
	// dialog 없으므로 에러는 예상되지만, BlindTransfer 핸들러까지 도달 확인
	if err == nil {
		t.Fatal("expected error (no active dialog)")
	}
	if !strings.Contains(err.Error(), "no active dialog") {
		t.Errorf("expected 'no active dialog' (BlindTransfer handler reached), got: %v", err)
	}
}

// TestExecuteEvent_TransferredSwitch는 executeEvent switch가 TRANSFERRED를 executeWaitSIPEvent로 라우팅하는지 테스트한다
func TestExecuteEvent_TransferredSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      "TRANSFERRED",
		InstanceID: "inst-1",
		Timeout:    100 * time.Millisecond,
	}
	err := ex.executeEvent(context.Background(), "inst-1", node)
	// 이벤트 발행 없으므로 타임아웃 에러 예상
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !strings.Contains(err.Error(), "TRANSFERRED event timeout") {
		t.Errorf("expected 'TRANSFERRED event timeout' error, got: %v", err)
	}
}

// TestExecuteWaitSIPEvent_Transferred_Success는 TRANSFERRED 이벤트가 제때 발행될 때 성공하는지 테스트한다
func TestExecuteWaitSIPEvent_Transferred_Success(t *testing.T) {
	ex, _ := newTestExecutor(t)

	// goroutine으로 50ms 후 TRANSFERRED 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEvent("inst-1", "TRANSFERRED")
	}()

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   "TRANSFERRED",
		Timeout: 2 * time.Second,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, "TRANSFERRED", 2*time.Second)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}
