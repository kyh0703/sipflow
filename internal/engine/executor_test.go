package engine

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/emiago/diago"
	"github.com/emiago/sipgo"
	"github.com/emiago/sipgo/sip"

	"sipflow/internal/pkg/eventhandler"
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
		Event:      string(eventhandler.SIPEventRinging),
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
	_, exists := store.GetDialog("nonexistent", defaultCallID)
	if exists {
		t.Errorf("GetDialog should return false for nonexistent key")
	}
}

func TestSessionKey(t *testing.T) {
	key := sessionKey("alice", "primary")
	if key != "alice:primary" {
		t.Fatalf("expected session key alice:primary, got %s", key)
	}
}

func TestSessionStore_MultiDialogIsolation(t *testing.T) {
	store := NewSessionStore()

	primary := newFakeTransferDialogWithCallID("sip-call-primary")
	consult := newFakeTransferDialogWithCallID("sip-call-consult")

	store.StoreDialog("inst-1", "primary", primary)
	store.StoreDialog("inst-1", "consult", consult)

	gotPrimary, ok := store.GetDialog("inst-1", "primary")
	if !ok || gotPrimary != primary {
		t.Fatal("expected primary dialog to be stored independently")
	}
	gotConsult, ok := store.GetDialog("inst-1", "consult")
	if !ok || gotConsult != consult {
		t.Fatal("expected consult dialog to be stored independently")
	}

	primarySIPCallID, ok := store.GetSIPCallID("inst-1", "primary")
	if !ok || primarySIPCallID != "sip-call-primary" {
		t.Fatalf("expected primary sip call id sip-call-primary, got %q", primarySIPCallID)
	}
	consultSIPCallID, ok := store.GetSIPCallID("inst-1", "consult")
	if !ok || consultSIPCallID != "sip-call-consult" {
		t.Fatalf("expected consult sip call id sip-call-consult, got %q", consultSIPCallID)
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
		Event:      string(eventhandler.SIPEventRinging),
	}

	nodeFailure := &GraphNode{
		ID:         "nodeFailure",
		Type:       "event",
		InstanceID: "inst1",
		Event:      string(eventhandler.SIPEventTimeout),
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
		for i := 0; i < 100; i++ {
			store.GetDialog("test", defaultCallID)
		}
		done <- true
	}()

	go func() {
		for i := 0; i < 100; i++ {
			store.GetDialog("test", defaultCallID)
		}
		done <- true
	}()

	// 완료 대기 (타임아웃 포함)
	for i := 0; i < 2; i++ {
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

type fakeTransferDialog struct {
	dialogSIP     *sipgo.Dialog
	remoteContact *sip.ContactHeader
	hangupCalled  int
	inviteCalled  int
	ackCalled     int
	referCalled   int
	inviteErr     error
	ackErr        error
	referErr      error
	notifyCodes   []int
	lastReferTo   *sip.Uri
}

type fakeHangupDialog struct {
	dialogSIP    *sipgo.Dialog
	hangupCalled int
}

func (d *fakeTransferDialog) Id() string { return "fake-transfer-dialog" }

func (d *fakeTransferDialog) Context() context.Context { return context.Background() }

func (d *fakeTransferDialog) Hangup(ctx context.Context) error {
	d.hangupCalled++
	return nil
}

func (d *fakeTransferDialog) Media() *diago.DialogMedia { return nil }

func (d *fakeTransferDialog) DialogSIP() *sipgo.Dialog { return d.dialogSIP }

func (d *fakeTransferDialog) Do(ctx context.Context, req *sip.Request) (*sip.Response, error) {
	return nil, nil
}

func (d *fakeTransferDialog) Close() error { return nil }

func (d *fakeTransferDialog) RemoteContact() *sip.ContactHeader { return d.remoteContact }

func (d *fakeTransferDialog) Invite(ctx context.Context, opts diago.InviteClientOptions) error {
	d.inviteCalled++
	return d.inviteErr
}

func (d *fakeTransferDialog) Ack(ctx context.Context) error {
	d.ackCalled++
	return d.ackErr
}

func (d *fakeTransferDialog) ReferOptions(ctx context.Context, referTo sip.Uri, opts diago.ReferClientOptions) error {
	d.referCalled++
	cloned := referTo
	d.lastReferTo = &cloned
	for _, statusCode := range d.notifyCodes {
		if opts.OnNotify != nil {
			opts.OnNotify(statusCode)
		}
	}
	return d.referErr
}

func (d *fakeHangupDialog) Id() string { return "fake-hangup-dialog" }

func (d *fakeHangupDialog) Context() context.Context { return context.Background() }

func (d *fakeHangupDialog) Hangup(ctx context.Context) error {
	d.hangupCalled++
	return nil
}

func (d *fakeHangupDialog) Media() *diago.DialogMedia { return nil }

func (d *fakeHangupDialog) DialogSIP() *sipgo.Dialog { return d.dialogSIP }

func (d *fakeHangupDialog) Do(ctx context.Context, req *sip.Request) (*sip.Response, error) {
	return nil, nil
}

func (d *fakeHangupDialog) Close() error { return nil }

func newFakeTransferDialogWithCallID(callID string) *fakeTransferDialog {
	callIDHeader := sip.CallIDHeader(callID)
	from := &sip.FromHeader{
		Address: sip.Uri{User: "100", Host: "127.0.0.1"},
		Params:  sip.NewParams(),
	}
	from.Params.Add("tag", "from-tag")
	to := &sip.ToHeader{
		Address: sip.Uri{User: "200", Host: "127.0.0.1"},
		Params:  sip.NewParams(),
	}
	to.Params.Add("tag", "to-tag")
	dialog := &fakeTransferDialog{
		dialogSIP: &sipgo.Dialog{
			InviteRequest:  sip.NewRequest(sip.INVITE, sip.Uri{User: "200", Host: "127.0.0.1"}),
			InviteResponse: sip.NewResponse(200, "OK"),
		},
		remoteContact: &sip.ContactHeader{
			Address: sip.Uri{Scheme: "sip", User: "200", Host: "127.0.0.1", Port: 5060},
		},
	}
	dialog.dialogSIP.InviteRequest.AppendHeader(&callIDHeader)
	dialog.dialogSIP.InviteRequest.AppendHeader(from)
	dialog.dialogSIP.InviteResponse.AppendHeader(to)
	return dialog
}

func newFakeHangupDialogWithCallID(callID string) *fakeHangupDialog {
	callIDHeader := sip.CallIDHeader(callID)
	dialog := &fakeHangupDialog{
		dialogSIP: &sipgo.Dialog{
			InviteRequest:  sip.NewRequest(sip.INVITE, sip.Uri{User: "200", Host: "127.0.0.1"}),
			InviteResponse: sip.NewResponse(200, "OK"),
		},
	}
	dialog.dialogSIP.InviteRequest.AppendHeader(&callIDHeader)
	return dialog
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
		Event:         string(eventhandler.SIPEventDTMFReceived),
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
	handler := eventhandler.NewHandler(4)
	handler.SetTimer(1 * time.Second)
	receivedCh := make(chan eventhandler.Event, 1)
	handler.SetHandler(eventhandler.SIPEventHeld, func(ctx context.Context, event eventhandler.Event, done eventhandler.DoneFn) error {
		receivedCh <- event
		done()
		return nil
	})
	defer handler.Close()

	if err := store.SubscribeSIPEventHandlerBySIPCallID("sip-call-1", handler); err != nil {
		t.Fatalf("SubscribeSIPEventHandlerBySIPCallID failed: %v", err)
	}

	// goroutine으로 50ms 후 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		store.emitSIPEventBySIPCallID("sip-call-1", "inst1", eventhandler.SIPEventHeld, "primary", 0)
	}()

	if err := handler.Poll(context.Background()); err != nil {
		t.Fatalf("handler poll failed: %v", err)
	}

	select {
	case event := <-receivedCh:
		if event.LogicalCallID != "primary" {
			t.Fatalf("expected logical callID primary, got %s", event.LogicalCallID)
		}
		if event.SIPCallID != "sip-call-1" {
			t.Fatalf("expected sipCallID sip-call-1, got %s", event.SIPCallID)
		}
	default:
		t.Fatal("expected HELD event to be captured")
	}

	store.UnsubscribeSIPEventHandler("sip-call-1", handler)
}

// TestSessionStore_SIPEventBus_MultipleSubscribers는 다중 구독자를 테스트한다
func TestSessionStore_SIPEventBus_MultipleSubscribers(t *testing.T) {
	store := NewSessionStore()
	handler1 := eventhandler.NewHandler(4)
	handler2 := eventhandler.NewHandler(4)
	defer handler1.Close()
	defer handler2.Close()

	ch1 := make(chan eventhandler.Event, 1)
	ch2 := make(chan eventhandler.Event, 1)
	handler1.SetTimer(1 * time.Second)
	handler2.SetTimer(1 * time.Second)
	handler1.SetHandler(eventhandler.SIPEventRetrieved, func(ctx context.Context, event eventhandler.Event, done eventhandler.DoneFn) error {
		ch1 <- event
		done()
		return nil
	})
	handler2.SetHandler(eventhandler.SIPEventRetrieved, func(ctx context.Context, event eventhandler.Event, done eventhandler.DoneFn) error {
		ch2 <- event
		done()
		return nil
	})

	if err := store.SubscribeSIPEventHandlerBySIPCallID("sip-call-consult", handler1); err != nil {
		t.Fatalf("subscribe handler1 failed: %v", err)
	}
	if err := store.SubscribeSIPEventHandlerBySIPCallID("sip-call-consult", handler2); err != nil {
		t.Fatalf("subscribe handler2 failed: %v", err)
	}

	// 한 번 emit → 두 채널 모두 수신
	store.emitSIPEventBySIPCallID("sip-call-consult", "inst1", eventhandler.SIPEventRetrieved, "consult", 0)

	for i, handler := range []*eventhandler.Handler{handler1, handler2} {
		if err := handler.Poll(context.Background()); err != nil {
			t.Fatalf("poll failed for handler %d: %v", i+1, err)
		}
	}

	for i, ch := range []chan eventhandler.Event{ch1, ch2} {
		select {
		case event := <-ch:
			if event.LogicalCallID != "consult" {
				t.Fatalf("expected consult callID on channel %d, got %s", i+1, event.LogicalCallID)
			}
		case <-time.After(1 * time.Second):
			t.Fatalf("timeout waiting for RETRIEVED event on channel %d", i+1)
		}
	}
}

// TestSessionStore_SIPEventBus_NoSubscribers는 구독자 없을 때 패닉이 없음을 테스트한다
func TestSessionStore_SIPEventBus_NoSubscribers(t *testing.T) {
	store := NewSessionStore()

	// 구독 없이 emitSIPEvent 호출 → 패닉 없이 완료
	store.emitSIPEventBySIPCallID("sip-call-1", "inst1", eventhandler.SIPEventHeld, "primary", 0)
	store.emitSIPEvent("inst-nonexistent", string(eventhandler.SIPEventTransferred), "")
}

// TestWithSIPMessage_Note는 note 파라미터가 포함된 경우를 테스트한다
func TestWithSIPMessage_Note(t *testing.T) {
	opt := WithSIPMessage("sent", "INVITE", 200, "", "", "", "sendonly")
	data := map[string]interface{}{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]interface{})
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
	data := map[string]interface{}{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]interface{})
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
	data := map[string]interface{}{}
	opt(data)

	sipMsg, ok := data["sipMessage"].(map[string]interface{})
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
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-held"))
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      string(eventhandler.SIPEventHeld),
		InstanceID: "inst-1",
		CallID:     "primary",
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
	ex.sessions.StoreDialog("inst-1", "consult", newFakeTransferDialogWithCallID("sip-call-retrieved"))
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      string(eventhandler.SIPEventRetrieved),
		InstanceID: "inst-1",
		CallID:     "consult",
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
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-held"))

	// goroutine으로 50ms 후 HELD 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEvent("inst-1", string(eventhandler.SIPEventHeld), "primary")
	}()

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   string(eventhandler.SIPEventHeld),
		CallID:  "primary",
		Timeout: 2 * time.Second,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, eventhandler.SIPEventHeld, 2*time.Second)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestExecuteWaitSIPEvent_IgnoresOtherDialogEvent(t *testing.T) {
	ex, _ := newTestExecutor(t)
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-primary"))
	ex.sessions.StoreDialog("inst-1", "consult", newFakeTransferDialogWithCallID("sip-call-consult"))

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   string(eventhandler.SIPEventHeld),
		CallID:  "primary",
		Timeout: 500 * time.Millisecond,
	}

	resultCh := make(chan error, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		resultCh <- ex.executeWaitSIPEvent(ctx, "inst-1", node, eventhandler.SIPEventHeld, 500*time.Millisecond)
	}()

	time.Sleep(30 * time.Millisecond)
	ex.sessions.emitSIPEvent("inst-1", string(eventhandler.SIPEventHeld), "consult")

	select {
	case err := <-resultCh:
		t.Fatalf("waiter should ignore consult event, got early result: %v", err)
	case <-time.After(60 * time.Millisecond):
		// expected: still waiting
	}

	ex.sessions.emitSIPEvent("inst-1", string(eventhandler.SIPEventHeld), "primary")

	select {
	case err := <-resultCh:
		if err != nil {
			t.Fatalf("expected no error after primary event, got %v", err)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for primary HELD event result")
	}
}

// TestExecuteWaitSIPEvent_Timeout은 이벤트가 발행되지 않을 때 타임아웃 에러가 반환되는지 테스트한다
func TestExecuteWaitSIPEvent_Timeout(t *testing.T) {
	ex, _ := newTestExecutor(t)
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-held"))

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   string(eventhandler.SIPEventHeld),
		CallID:  "primary",
		Timeout: 100 * time.Millisecond,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, eventhandler.SIPEventHeld, 100*time.Millisecond)
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

func TestBuildMuteTransferReferTo(t *testing.T) {
	callID := sip.CallIDHeader("consult-call-id")
	from := &sip.FromHeader{
		Address: sip.Uri{User: "100", Host: "127.0.0.1"},
		Params:  sip.NewParams(),
	}
	from.Params.Add("tag", "from-tag-123")

	to := &sip.ToHeader{
		Address: sip.Uri{User: "300", Host: "127.0.0.1"},
		Params:  sip.NewParams(),
	}
	to.Params.Add("tag", "to-tag-456")

	dialog := &fakeTransferDialog{
		dialogSIP: &sipgo.Dialog{
			InviteRequest:  sip.NewRequest(sip.INVITE, sip.Uri{User: "300", Host: "127.0.0.1"}),
			InviteResponse: sip.NewResponse(200, "OK"),
		},
		remoteContact: &sip.ContactHeader{
			Address: sip.Uri{Scheme: "sip", User: "300", Host: "127.0.0.1", Port: 5060},
		},
	}
	dialog.dialogSIP.InviteRequest.AppendHeader(&callID)
	dialog.dialogSIP.InviteRequest.AppendHeader(from)
	dialog.dialogSIP.InviteResponse.AppendHeader(to)

	referTo, referToStr, err := buildMuteTransferReferTo(dialog)
	if err != nil {
		t.Fatalf("buildMuteTransferReferTo failed: %v", err)
	}

	if referTo.User != "300" || referTo.Host != "127.0.0.1" || referTo.Port != 5060 {
		t.Fatalf("unexpected refer-to target: %+v", referTo)
	}

	replaces, ok := referTo.Headers.Get("Replaces")
	if !ok {
		t.Fatal("expected Replaces header param in refer-to URI")
	}
	expectedEscaped := "consult-call-id%3Bto-tag%3Dto-tag-456%3Bfrom-tag%3Dfrom-tag-123"
	if replaces != expectedEscaped {
		t.Fatalf("expected encoded Replaces %q, got %q", expectedEscaped, replaces)
	}
	if !strings.Contains(referToStr, "?Replaces="+expectedEscaped) {
		t.Fatalf("expected refer-to string to contain encoded Replaces, got %s", referToStr)
	}
}

func TestHandleAnswerRefer_SuccessStoresDialogAndEmitsLog(t *testing.T) {
	ex, emitter := newTestExecutor(t)
	node := &GraphNode{ID: "answer-node", Type: "command", Command: "Answer"}

	referDialog := &fakeTransferDialog{
		dialogSIP: &sipgo.Dialog{
			InviteRequest: sip.NewRequest(sip.INVITE, sip.Uri{
				Scheme:  "sip",
				User:    "300",
				Host:    "127.0.0.1",
				Headers: sip.NewParams(),
			}),
			InviteResponse: sip.NewResponse(200, "OK"),
		},
		remoteContact: &sip.ContactHeader{
			Address: sip.Uri{Scheme: "sip", User: "300", Host: "127.0.0.1", Port: 5060},
		},
	}
	referDialog.dialogSIP.InviteRequest.Recipient.Headers.Add("Replaces", "consult-call-id%3Bto-tag%3Dto-tag-456%3Bfrom-tag%3Dfrom-tag-123")
	callIDHeader := sip.CallIDHeader("sip-call-referred")
	referDialog.dialogSIP.InviteRequest.AppendHeader(&callIDHeader)

	if err := ex.handleAnswerRefer("inst-1", "primary", node, referDialog); err != nil {
		t.Fatalf("handleAnswerRefer failed: %v", err)
	}

	if referDialog.inviteCalled != 1 {
		t.Fatalf("expected Invite to be called once, got %d", referDialog.inviteCalled)
	}
	if referDialog.ackCalled != 1 {
		t.Fatalf("expected Ack to be called once, got %d", referDialog.ackCalled)
	}

	stored, exists := ex.sessions.GetDialog("inst-1", "primary")
	if !exists || stored != referDialog {
		t.Fatal("expected referred dialog to replace the original session")
	}

	logs := emitter.GetEventsByName(EventActionLog)
	if len(logs) < 2 {
		t.Fatalf("expected refer flow logs to be emitted, got %d", len(logs))
	}
	if !strings.Contains(logs[0].Data["message"].(string), "REFER received") {
		t.Fatalf("expected first action log to mention received REFER, got %+v", logs[0].Data)
	}
	if !strings.Contains(logs[len(logs)-1].Data["message"].(string), "session replaced") {
		t.Fatalf("expected final action log to mention session replacement, got %+v", logs[len(logs)-1].Data)
	}
}

func TestHandleAnswerRefer_WithReplacesEmitsReplacesAwareLogs(t *testing.T) {
	ex, emitter := newTestExecutor(t)
	node := &GraphNode{ID: "answer-node", Type: "command", Command: "Answer"}
	referDialog := newFakeTransferDialogWithCallID("sip-call-referred")
	referDialog.dialogSIP.InviteRequest.Recipient.Headers = sip.NewParams()
	referDialog.dialogSIP.InviteRequest.Recipient.Headers.Add("Replaces", "consult-call-id%3Bto-tag%3Dto-tag%3Bfrom-tag%3Dfrom-tag")

	if err := ex.handleAnswerRefer("inst-1", "primary", node, referDialog); err != nil {
		t.Fatalf("handleAnswerRefer failed: %v", err)
	}

	logs := emitter.GetEventsByName(EventActionLog)
	if len(logs) < 2 {
		t.Fatalf("expected refer flow logs to be emitted, got %d", len(logs))
	}
	if !strings.Contains(logs[0].Data["message"].(string), "with Replaces") {
		t.Fatalf("expected first refer log to mention Replaces, got %+v", logs[0].Data)
	}
	if !strings.Contains(logs[len(logs)-1].Data["message"].(string), "Replaces dialog") {
		t.Fatalf("expected final refer log to mention Replaces dialog, got %+v", logs[len(logs)-1].Data)
	}
}

func TestHandleAnswerRefer_InviteFailure(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{ID: "answer-node", Type: "command", Command: "Answer"}
	referDialog := newFakeTransferDialogWithCallID("sip-call-referred")
	referDialog.inviteErr = errors.New("invite failed")

	err := ex.handleAnswerRefer("inst-1", "primary", node, referDialog)
	if err == nil {
		t.Fatal("expected invite failure")
	}
	if !strings.Contains(err.Error(), "referDialog Invite failed") {
		t.Fatalf("expected wrapped invite failure, got %v", err)
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); exists {
		t.Fatal("expected dialog not to be stored on invite failure")
	}
}

func TestHandleAnswerRefer_AckFailure(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{ID: "answer-node", Type: "command", Command: "Answer"}
	referDialog := newFakeTransferDialogWithCallID("sip-call-referred")
	referDialog.ackErr = errors.New("ack failed")

	err := ex.handleAnswerRefer("inst-1", "primary", node, referDialog)
	if err == nil {
		t.Fatal("expected ack failure")
	}
	if !strings.Contains(err.Error(), "referDialog Ack failed") {
		t.Fatalf("expected wrapped ack failure, got %v", err)
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); exists {
		t.Fatal("expected dialog not to be stored on ack failure")
	}
}

func TestExecuteMuteTransfer_EmptyConsultCallID(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "test-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
	}

	err := ex.executeMuteTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for empty consultCallId")
	}
	if !strings.Contains(err.Error(), "consultCallId is required") {
		t.Fatalf("expected consultCallId error, got %v", err)
	}
}

func TestExecuteMuteTransfer_NoPrimaryDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "test-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
	}

	err := ex.executeMuteTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing primary dialog")
	}
	if !strings.Contains(err.Error(), "no primary dialog") {
		t.Fatalf("expected primary dialog error, got %v", err)
	}
}

func TestExecuteMuteTransfer_NoConsultDialog(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "test-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
	}

	primary := &fakeTransferDialog{
		dialogSIP:     newFakeTransferDialogWithCallID("sip-primary").dialogSIP,
		remoteContact: &sip.ContactHeader{Address: sip.Uri{Scheme: "sip", User: "200", Host: "127.0.0.1"}},
	}
	ex.sessions.StoreDialog("inst-1", "primary", primary)

	err := ex.executeMuteTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error for missing consult dialog")
	}
	if !strings.Contains(err.Error(), "no consult dialog") {
		t.Fatalf("expected consult dialog error, got %v", err)
	}
}

func TestExecuteMuteTransfer_Success(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "mute-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
		Timeout:       500 * time.Millisecond,
	}

	primary := newFakeTransferDialogWithCallID("sip-call-primary")
	primary.notifyCodes = []int{180, 200}
	consult := newFakeTransferDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	if err := ex.executeMuteTransfer(context.Background(), "inst-1", node); err != nil {
		t.Fatalf("executeMuteTransfer failed: %v", err)
	}

	if primary.referCalled != 1 {
		t.Fatalf("expected ReferOptions to be called once, got %d", primary.referCalled)
	}
	if primary.lastReferTo == nil {
		t.Fatal("expected Refer-To URI to be captured")
	}
	replaces, ok := primary.lastReferTo.Headers.Get("Replaces")
	if !ok || replaces == "" {
		t.Fatalf("expected Replaces header on Refer-To URI, got %+v", primary.lastReferTo)
	}
	if primary.hangupCalled != 1 || consult.hangupCalled != 1 {
		t.Fatalf("expected both dialogs to be cleaned up, got primary=%d consult=%d", primary.hangupCalled, consult.hangupCalled)
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); exists {
		t.Fatal("expected primary dialog removed after successful transfer")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "consult"); exists {
		t.Fatal("expected consult dialog removed after successful transfer")
	}
}

func TestExecuteMuteTransfer_FinalNotifyTimeout(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "mute-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
		Timeout:       50 * time.Millisecond,
	}

	primary := newFakeTransferDialogWithCallID("sip-call-primary")
	consult := newFakeTransferDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	err := ex.executeMuteTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected final NOTIFY timeout")
	}
	if !strings.Contains(err.Error(), "final NOTIFY timeout") {
		t.Fatalf("expected final NOTIFY timeout error, got %v", err)
	}
	if primary.hangupCalled != 0 || consult.hangupCalled != 0 {
		t.Fatal("expected dialogs not to be cleaned up on timeout")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); !exists {
		t.Fatal("expected primary dialog to remain after timeout")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "consult"); !exists {
		t.Fatal("expected consult dialog to remain after timeout")
	}
}

func TestExecuteMuteTransfer_FinalNotifyFailure(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "mute-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
		Timeout:       500 * time.Millisecond,
	}

	primary := newFakeTransferDialogWithCallID("sip-call-primary")
	primary.notifyCodes = []int{180, 486}
	consult := newFakeTransferDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	err := ex.executeMuteTransfer(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected final NOTIFY failure")
	}
	if !strings.Contains(err.Error(), "final NOTIFY failed") {
		t.Fatalf("expected final NOTIFY failure, got %v", err)
	}
	if primary.hangupCalled != 0 || consult.hangupCalled != 0 {
		t.Fatalf("expected dialogs untouched on failed final NOTIFY, got primary=%d consult=%d", primary.hangupCalled, consult.hangupCalled)
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); !exists {
		t.Fatal("expected primary dialog to remain after failed final NOTIFY")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "consult"); !exists {
		t.Fatal("expected consult dialog to remain after failed final NOTIFY")
	}
}

func TestHandleMuteTransferNotifyFinal_SuccessCleansUpDialogs(t *testing.T) {
	ex, emitter := newTestExecutor(t)
	node := &GraphNode{ID: "mute-node", Type: "command", Command: "MuteTransfer"}

	primary := newFakeHangupDialogWithCallID("sip-call-primary")
	consult := newFakeHangupDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	transfer := &muteTransferContext{
		primaryCallID: "primary",
		consultCallID: "consult",
		primaryDialog: primary,
		consultDialog: consult,
	}

	if err := ex.handleMuteTransferNotifyFinal(context.Background(), "inst-1", node, transfer, 200); err != nil {
		t.Fatalf("handleMuteTransferNotifyFinal failed: %v", err)
	}

	if primary.hangupCalled != 1 {
		t.Fatalf("expected primary dialog hangup once, got %d", primary.hangupCalled)
	}
	if consult.hangupCalled != 1 {
		t.Fatalf("expected consult dialog hangup once, got %d", consult.hangupCalled)
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); exists {
		t.Fatal("expected primary dialog to be removed from session store")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "consult"); exists {
		t.Fatal("expected consult dialog to be removed from session store")
	}

	logs := emitter.GetEventsByName(EventActionLog)
	if len(logs) == 0 || !strings.Contains(logs[0].Data["message"].(string), "MuteTransfer succeeded") {
		t.Fatalf("expected success log after final notify, got %+v", logs)
	}
}

func TestHandleMuteTransferNotifyFinal_FailureDoesNotCleanupDialogs(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{ID: "mute-node", Type: "command", Command: "MuteTransfer"}

	primary := newFakeHangupDialogWithCallID("sip-call-primary")
	consult := newFakeHangupDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	transfer := &muteTransferContext{
		primaryCallID: "primary",
		consultCallID: "consult",
		primaryDialog: primary,
		consultDialog: consult,
	}

	err := ex.handleMuteTransferNotifyFinal(context.Background(), "inst-1", node, transfer, 486)
	if err == nil {
		t.Fatal("expected final NOTIFY failure")
	}
	if !strings.Contains(err.Error(), "final NOTIFY failed") {
		t.Fatalf("expected final notify failure, got %v", err)
	}
	if primary.hangupCalled != 0 || consult.hangupCalled != 0 {
		t.Fatal("expected dialogs not to be hung up on failed final NOTIFY")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "primary"); !exists {
		t.Fatal("expected primary dialog to remain in session store on failure")
	}
	if _, exists := ex.sessions.GetDialog("inst-1", "consult"); !exists {
		t.Fatal("expected consult dialog to remain in session store on failure")
	}
}

func TestCreateNotifyHandler_ProgressThenFinal(t *testing.T) {
	ex, emitter := newTestExecutor(t)
	node := &GraphNode{ID: "mute-node", Type: "command", Command: "MuteTransfer"}

	primary := newFakeHangupDialogWithCallID("sip-call-primary")
	consult := newFakeHangupDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	transfer := &muteTransferContext{
		primaryCallID: "primary",
		primarySIPID:  "sip-call-primary",
		consultCallID: "consult",
		primaryDialog: primary,
		consultDialog: consult,
	}

	handler := ex.createNotifyHandler(context.Background(), "inst-1", node, transfer, 500*time.Millisecond)
	defer handler.Close()

	if err := ex.sessions.SubscribeSIPEventHandlerBySIPCallID("sip-call-primary", handler); err != nil {
		t.Fatalf("subscribe notify handler failed: %v", err)
	}
	defer ex.sessions.UnsubscribeSIPEventHandler("sip-call-primary", handler)

	go func() {
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEventBySIPCallID("sip-call-primary", "inst-1", eventhandler.SIPEventNotify, "primary", 180)
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEventBySIPCallID("sip-call-primary", "inst-1", eventhandler.SIPEventNotify, "primary", 200)
	}()

	if err := handler.Poll(context.Background()); err != nil {
		t.Fatalf("expected notify handler to complete, got %v", err)
	}

	if primary.hangupCalled != 1 || consult.hangupCalled != 1 {
		t.Fatalf("expected both dialogs to be cleaned up after final NOTIFY, got primary=%d consult=%d", primary.hangupCalled, consult.hangupCalled)
	}

	logs := emitter.GetEventsByName(EventActionLog)
	progressSeen := false
	for _, event := range logs {
		if strings.Contains(event.Data["message"].(string), "NOTIFY progress 180") {
			progressSeen = true
			break
		}
	}
	if !progressSeen {
		t.Fatalf("expected progress NOTIFY log, got %+v", logs)
	}
}

func TestCreateNotifyHandler_TimesOutWithoutFinalNotify(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{ID: "mute-node", Type: "command", Command: "MuteTransfer"}

	transfer := &muteTransferContext{
		primaryCallID: "primary",
		consultCallID: "consult",
		primaryDialog: newFakeHangupDialogWithCallID("sip-call-primary"),
		consultDialog: newFakeHangupDialogWithCallID("sip-call-consult"),
	}

	handler := ex.createNotifyHandler(context.Background(), "inst-1", node, transfer, 50*time.Millisecond)
	defer handler.Close()

	err := handler.Poll(context.Background())
	if !errors.Is(err, eventhandler.ErrTimeout) {
		t.Fatalf("expected notify handler timeout, got %v", err)
	}
}

func TestExecuteRelease_UsesCallID(t *testing.T) {
	ex, _ := newTestExecutor(t)

	primary := newFakeHangupDialogWithCallID("sip-call-primary")
	consult := newFakeHangupDialogWithCallID("sip-call-consult")
	ex.sessions.StoreDialog("inst-1", "primary", primary)
	ex.sessions.StoreDialog("inst-1", "consult", consult)

	node := &GraphNode{
		ID:      "release-node",
		Type:    "command",
		Command: string(SIPCommandRelease),
		CallID:  "primary",
	}

	if err := ex.executeRelease(context.Background(), "inst-1", node); err != nil {
		t.Fatalf("executeRelease failed: %v", err)
	}

	if primary.hangupCalled != 1 {
		t.Fatalf("expected primary dialog hangup once, got %d", primary.hangupCalled)
	}
	if consult.hangupCalled != 0 {
		t.Fatalf("expected consult dialog untouched, got %d", consult.hangupCalled)
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

func TestExecuteCommand_MuteTransferSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	node := &GraphNode{
		ID:            "test-node",
		Type:          "command",
		Command:       "MuteTransfer",
		PrimaryCallID: "primary",
		ConsultCallID: "consult",
	}

	err := ex.executeCommand(context.Background(), "inst-1", node)
	if err == nil {
		t.Fatal("expected error (no primary dialog)")
	}
	if !strings.Contains(err.Error(), "no primary dialog") {
		t.Fatalf("expected MuteTransfer handler error, got %v", err)
	}
}

// TestExecuteEvent_TransferredSwitch는 executeEvent switch가 TRANSFERRED를 executeWaitSIPEvent로 라우팅하는지 테스트한다
func TestExecuteEvent_TransferredSwitch(t *testing.T) {
	ex, _ := newTestExecutor(t)
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-transferred"))
	node := &GraphNode{
		ID:         "test-node",
		Type:       "event",
		Event:      string(eventhandler.SIPEventTransferred),
		InstanceID: "inst-1",
		CallID:     "primary",
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
	ex.sessions.StoreDialog("inst-1", "primary", newFakeTransferDialogWithCallID("sip-call-transferred"))

	// goroutine으로 50ms 후 TRANSFERRED 이벤트 발행
	go func() {
		time.Sleep(50 * time.Millisecond)
		ex.sessions.emitSIPEvent("inst-1", string(eventhandler.SIPEventTransferred), "primary")
	}()

	node := &GraphNode{
		ID:      "test-node",
		Type:    "event",
		Event:   string(eventhandler.SIPEventTransferred),
		CallID:  "primary",
		Timeout: 2 * time.Second,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := ex.executeWaitSIPEvent(ctx, "inst-1", node, eventhandler.SIPEventTransferred, 2*time.Second)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}
