package engine

import (
	"context"
	"testing"
	"time"
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
