package sip

import (
	"log/slog"
)

// UAConfig holds configuration for creating a SIP User Agent.
type UAConfig struct {
	DisplayName string
	Transport   string
	BindHost    string
	BindPort    int
}

// UAStatus represents the current status of a managed UA instance.
type UAStatus struct {
	NodeID    string
	Transport string
	Active    bool
}

// UAManager manages the lifecycle of diago UA instances.
type UAManager struct {
	logger *slog.Logger
}

// NewUAManager creates a new UAManager.
func NewUAManager(logger *slog.Logger) *UAManager {
	return &UAManager{
		logger: logger,
	}
}

// CreateUA creates a new UA instance for the given node ID.
func (m *UAManager) CreateUA(nodeID string, cfg UAConfig) error {
	return nil
}

// DestroyUA destroys the UA instance for the given node ID.
func (m *UAManager) DestroyUA(nodeID string) error {
	return nil
}

// DestroyAll destroys all managed UA instances.
func (m *UAManager) DestroyAll() {
}

// GetStatus returns the status of a specific UA.
func (m *UAManager) GetStatus(nodeID string) (UAStatus, bool) {
	return UAStatus{}, false
}

// ListActive returns all active UA statuses.
func (m *UAManager) ListActive() []UAStatus {
	return nil
}
