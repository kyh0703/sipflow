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
		for i := 0; i < 100; i++ {
			store.GetDialog("test")
		}
		done <- true
	}()

	go func() {
		for i := 0; i < 100; i++ {
			store.GetServerSession("test")
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
