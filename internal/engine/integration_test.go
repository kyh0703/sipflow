package engine

import (
	"context"
	"encoding/json"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"sipflow/internal/scenario"
)

// TestEventEmitter is a test implementation of EventEmitter
type TestEventEmitter struct {
	mu     sync.Mutex
	events []TestEvent
}

// TestEvent represents an emitted event for testing
type TestEvent struct {
	Name string
	Data map[string]interface{}
}

// Emit implements EventEmitter interface
func (te *TestEventEmitter) Emit(eventName string, data map[string]interface{}) {
	te.mu.Lock()
	defer te.mu.Unlock()
	te.events = append(te.events, TestEvent{Name: eventName, Data: data})
}

// GetEvents returns all emitted events
func (te *TestEventEmitter) GetEvents() []TestEvent {
	te.mu.Lock()
	defer te.mu.Unlock()
	return append([]TestEvent{}, te.events...)
}

// GetEventsByName returns events with the specified name
func (te *TestEventEmitter) GetEventsByName(name string) []TestEvent {
	te.mu.Lock()
	defer te.mu.Unlock()
	var filtered []TestEvent
	for _, e := range te.events {
		if e.Name == name {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// buildTestFlowData builds a FlowData JSON string from nodes and edges
func buildTestFlowData(t *testing.T, nodes []FlowNode, edges []FlowEdge) string {
	t.Helper()
	fd := FlowData{Nodes: nodes, Edges: edges}
	b, err := json.Marshal(fd)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// newTestEngine creates a test engine with temporary database and TestEventEmitter
func newTestEngine(t *testing.T, basePort int) (*Engine, *TestEventEmitter) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	repo, err := scenario.NewRepository(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Close() })

	eng := NewEngine(repo)
	eng.im.basePort = basePort
	eng.im.nextPort = basePort

	te := &TestEventEmitter{}
	eng.SetEventEmitter(te)

	return eng, te
}

// waitForEvent waits for an event with the specified name within timeout
func waitForEvent(t *testing.T, te *TestEventEmitter, eventName string, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		events := te.GetEventsByName(eventName)
		if len(events) > 0 {
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}

// waitForNodeState waits for a node to reach the specified state
func waitForNodeState(t *testing.T, te *TestEventEmitter, nodeID, state string, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		events := te.GetEventsByName(EventNodeState)
		for _, e := range events {
			if e.Data["nodeId"] == nodeID && e.Data["newState"] == state {
				return true
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}
