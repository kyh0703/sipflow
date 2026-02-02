package sip

import (
	"fmt"
	"log/slog"
	"os"
	"sync"
	"testing"

	"github.com/emiago/diago"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestSessionManager_AddAndGet(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	session := &ActiveSession{
		NodeID: "node-1",
		State:  CallStateDialing,
	}

	mgr.Add("call-1", session)

	got, ok := mgr.Get("call-1")
	if !ok {
		t.Fatal("Get should return true for existing callID")
	}
	if got.NodeID != "node-1" {
		t.Errorf("expected NodeID node-1, got %s", got.NodeID)
	}
	if got.State != CallStateDialing {
		t.Errorf("expected State dialing, got %s", got.State)
	}
}

func TestSessionManager_Remove(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	session := &ActiveSession{
		NodeID: "node-1",
		State:  CallStateEstablished,
	}

	mgr.Add("call-1", session)
	mgr.Remove("call-1")

	_, ok := mgr.Get("call-1")
	if ok {
		t.Fatal("Get should return false after Remove")
	}
}

func TestSessionManager_GetByNodeID(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	session := &ActiveSession{
		NodeID: "node-1",
		State:  CallStateRinging,
	}

	mgr.Add("call-42", session)

	callID, got, ok := mgr.GetByNodeID("node-1")
	if !ok {
		t.Fatal("GetByNodeID should return true for existing nodeID")
	}
	if callID != "call-42" {
		t.Errorf("expected callID call-42, got %s", callID)
	}
	if got.State != CallStateRinging {
		t.Errorf("expected State ringing, got %s", got.State)
	}

	// Non-existent nodeID
	_, _, ok = mgr.GetByNodeID("nonexistent")
	if ok {
		t.Fatal("GetByNodeID should return false for nonexistent nodeID")
	}
}

func TestSessionManager_HasActiveCall(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	if mgr.HasActiveCall("node-1") {
		t.Fatal("HasActiveCall should return false when no sessions exist")
	}

	session := &ActiveSession{
		NodeID: "node-1",
		State:  CallStateEstablished,
	}
	mgr.Add("call-1", session)

	if !mgr.HasActiveCall("node-1") {
		t.Fatal("HasActiveCall should return true for node with active session")
	}

	if mgr.HasActiveCall("node-2") {
		t.Fatal("HasActiveCall should return false for node without active session")
	}
}

func TestSessionManager_RemoveByNodeID(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	// Add two sessions for the same node
	mgr.Add("call-1", &ActiveSession{NodeID: "node-1", State: CallStateDialing})
	mgr.Add("call-2", &ActiveSession{NodeID: "node-1", State: CallStateEstablished})
	mgr.Add("call-3", &ActiveSession{NodeID: "node-2", State: CallStateDialing})

	mgr.RemoveByNodeID("node-1")

	if mgr.HasActiveCall("node-1") {
		t.Fatal("HasActiveCall should return false after RemoveByNodeID")
	}

	// node-2 should still be there
	if !mgr.HasActiveCall("node-2") {
		t.Fatal("RemoveByNodeID should not affect other nodes")
	}
}

func TestSessionManager_ConcurrentAccess(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	var wg sync.WaitGroup
	const goroutines = 50

	// Concurrent Add
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			callID := fmt.Sprintf("call-%d", i)
			mgr.Add(callID, &ActiveSession{
				NodeID: fmt.Sprintf("node-%d", i%10),
				State:  CallStateDialing,
			})
		}(i)
	}
	wg.Wait()

	// Concurrent Get
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			callID := fmt.Sprintf("call-%d", i)
			mgr.Get(callID)
		}(i)
	}
	wg.Wait()

	// Concurrent Remove
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			callID := fmt.Sprintf("call-%d", i)
			mgr.Remove(callID)
		}(i)
	}
	wg.Wait()

	// All should be removed
	for i := 0; i < goroutines; i++ {
		callID := fmt.Sprintf("call-%d", i)
		if _, ok := mgr.Get(callID); ok {
			t.Errorf("session %s should have been removed", callID)
		}
	}
}

func TestSessionManager_DialogFieldType(t *testing.T) {
	mgr := NewSessionManager(testLogger())

	// Use nil typed pointer to verify the field accepts the correct type
	var dialog *diago.DialogClientSession = (*diago.DialogClientSession)(nil)

	session := &ActiveSession{
		Dialog: dialog,
		NodeID: "node-1",
		State:  CallStateDialing,
	}

	mgr.Add("call-1", session)

	got, ok := mgr.Get("call-1")
	if !ok {
		t.Fatal("Get should return true for existing callID")
	}
	if got.Dialog != dialog {
		t.Fatal("Dialog pointer should be preserved after Add+Get")
	}
}
