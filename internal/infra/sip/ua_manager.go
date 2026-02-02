package sip

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/emiago/diago"
	"github.com/emiago/sipgo"
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

// managedUA holds a diago instance with its lifecycle controls.
type managedUA struct {
	dg     *diago.Diago
	ua     *sipgo.UserAgent
	cancel context.CancelFunc
	cfg    UAConfig
}

// UAManager manages the lifecycle of diago UA instances.
// It is concurrent-safe via sync.RWMutex.
type UAManager struct {
	mu     sync.RWMutex
	agents map[string]*managedUA
	logger *slog.Logger
}

// NewUAManager creates a new UAManager.
func NewUAManager(logger *slog.Logger) *UAManager {
	return &UAManager{
		agents: make(map[string]*managedUA),
		logger: logger,
	}
}

// CreateUA creates a new UA instance for the given node ID.
// Returns error if a UA with the same nodeID already exists.
func (m *UAManager) CreateUA(nodeID string, cfg UAConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.agents[nodeID]; exists {
		return fmt.Errorf("UA already exists for node %s", nodeID)
	}

	// Apply defaults
	if cfg.BindHost == "" {
		cfg.BindHost = "0.0.0.0"
	}
	if cfg.Transport == "" {
		cfg.Transport = "udp"
	}
	if cfg.DisplayName == "" {
		cfg.DisplayName = "SIPFlow/1.0"
	}

	// Create sipgo UserAgent
	ua, err := sipgo.NewUA(
		sipgo.WithUserAgent(cfg.DisplayName),
	)
	if err != nil {
		return fmt.Errorf("failed to create sipgo UA for node %s: %w", nodeID, err)
	}

	// Create context for lifecycle management
	_, cancel := context.WithCancel(context.Background())

	// Create diago instance wrapping the sipgo UA
	dg := diago.NewDiago(ua,
		diago.WithTransport(diago.Transport{
			Transport: cfg.Transport,
			BindHost:  cfg.BindHost,
			BindPort:  cfg.BindPort,
		}),
		diago.WithLogger(m.logger),
	)

	m.agents[nodeID] = &managedUA{
		dg:     dg,
		ua:     ua,
		cancel: cancel,
		cfg:    cfg,
	}

	m.logger.Info("UA created", "nodeID", nodeID, "transport", cfg.Transport)
	return nil
}

// DestroyUA destroys the UA instance for the given node ID.
// Returns error if nodeID is not found.
func (m *UAManager) DestroyUA(nodeID string) error {
	m.mu.Lock()
	managed, exists := m.agents[nodeID]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("UA not found for node %s", nodeID)
	}
	delete(m.agents, nodeID)
	m.mu.Unlock()

	m.destroyManagedUA(managed)
	m.logger.Info("UA destroyed", "nodeID", nodeID)
	return nil
}

// DestroyAll destroys all managed UA instances.
// Safe to call when empty.
func (m *UAManager) DestroyAll() {
	m.mu.Lock()
	agents := make(map[string]*managedUA, len(m.agents))
	for k, v := range m.agents {
		agents[k] = v
	}
	m.agents = make(map[string]*managedUA)
	m.mu.Unlock()

	for nodeID, managed := range agents {
		m.destroyManagedUA(managed)
		m.logger.Info("UA destroyed", "nodeID", nodeID)
	}
}

// GetStatus returns the status of a specific UA.
func (m *UAManager) GetStatus(nodeID string) (UAStatus, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	managed, exists := m.agents[nodeID]
	if !exists {
		return UAStatus{}, false
	}

	return UAStatus{
		NodeID:    nodeID,
		Transport: managed.cfg.Transport,
		Active:    true,
	}, true
}

// ListActive returns all active UA statuses.
func (m *UAManager) ListActive() []UAStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	statuses := make([]UAStatus, 0, len(m.agents))
	for nodeID, managed := range m.agents {
		statuses = append(statuses, UAStatus{
			NodeID:    nodeID,
			Transport: managed.cfg.Transport,
			Active:    true,
		})
	}
	return statuses
}

// GetDiago returns the *diago.Diago instance for the given node ID.
// Returns error if nodeID is not found.
func (m *UAManager) GetDiago(nodeID string) (*diago.Diago, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	managed, exists := m.agents[nodeID]
	if !exists {
		return nil, fmt.Errorf("UA not found for node %s", nodeID)
	}
	return managed.dg, nil
}

// destroyManagedUA cancels the context and closes the UA.
func (m *UAManager) destroyManagedUA(managed *managedUA) {
	managed.cancel()
	if err := managed.ua.Close(); err != nil {
		m.logger.Error("failed to close UA", "error", err)
	}
}
