package sip

import (
	"context"
	"log/slog"
	"sync"

	"github.com/emiago/diago"
)

// CallState represents the state of a SIP call session.
type CallState string

const (
	CallStateDialing     CallState = "dialing"
	CallStateRinging     CallState = "ringing"
	CallStateEstablished CallState = "established"
	CallStateTerminated  CallState = "terminated"
	CallStateFailed      CallState = "failed"
)

// ActiveSession represents an active SIP call session.
type ActiveSession struct {
	Dialog *diago.DialogClientSession
	Cancel context.CancelFunc
	NodeID string
	State  CallState
}

// SessionManager manages active SIP call sessions.
// It is concurrent-safe via sync.RWMutex.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*ActiveSession // callID -> session
	logger   *slog.Logger
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(logger *slog.Logger) *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*ActiveSession),
		logger:   logger,
	}
}

// Add adds an active session tracked by callID.
func (m *SessionManager) Add(callID string, session *ActiveSession) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.sessions[callID] = session
	m.logger.Info("session added", "callID", callID, "nodeID", session.NodeID, "state", session.State)
}

// Get returns the active session for the given callID.
func (m *SessionManager) Get(callID string) (*ActiveSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[callID]
	return session, exists
}

// Remove removes the active session for the given callID.
func (m *SessionManager) Remove(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.sessions, callID)
	m.logger.Info("session removed", "callID", callID)
}

// GetByNodeID returns the first session found for the given nodeID.
// Returns the callID, session, and whether it was found.
func (m *SessionManager) GetByNodeID(nodeID string) (string, *ActiveSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for callID, session := range m.sessions {
		if session.NodeID == nodeID {
			return callID, session, true
		}
	}
	return "", nil, false
}

// HasActiveCall returns true if the given nodeID has at least one active session.
func (m *SessionManager) HasActiveCall(nodeID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, session := range m.sessions {
		if session.NodeID == nodeID {
			return true
		}
	}
	return false
}

// RemoveByNodeID removes all sessions for the given nodeID.
func (m *SessionManager) RemoveByNodeID(nodeID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for callID, session := range m.sessions {
		if session.NodeID == nodeID {
			delete(m.sessions, callID)
			m.logger.Info("session removed by nodeID", "callID", callID, "nodeID", nodeID)
		}
	}
}
