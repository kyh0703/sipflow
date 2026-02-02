package handler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"sipflow/ent"
	"sipflow/ent/sipserver"
	"sipflow/internal/infra/sip"

	sipgosip "github.com/emiago/sipgo/sip"
)

// SIPService handles SIP server configuration CRUD and UA lifecycle for Wails binding
type SIPService struct {
	entClient *ent.Client
	emitter   *EventEmitter
	uaManager *sip.UAManager
}

// NewSIPService creates a new SIPService instance
func NewSIPService(emitter *EventEmitter, uaManager *sip.UAManager) *SIPService {
	return &SIPService{
		emitter:   emitter,
		uaManager: uaManager,
	}
}

// setEntClient updates the ent client (unexported to prevent Wails binding)
func (s *SIPService) setEntClient(client *ent.Client) {
	s.entClient = client
}

// SIPServerMeta represents a SIP server list item
type SIPServerMeta struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Port      int    `json:"port"`
	Transport string `json:"transport"`
}

// CreateServerRequest contains fields for creating a SIP server
type CreateServerRequest struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	Port      int    `json:"port"`
	Transport string `json:"transport"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

// UpdateServerRequest contains fields for updating a SIP server
type UpdateServerRequest struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Port      int    `json:"port"`
	Transport string `json:"transport"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

// ListServers returns all SIP server configurations
func (s *SIPService) ListServers() Response[[]SIPServerMeta] {
	if s.entClient == nil {
		return Failure[[]SIPServerMeta]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	servers, err := s.entClient.SIPServer.
		Query().
		Order(ent.Asc(sipserver.FieldName)).
		All(ctx)

	if err != nil {
		return Failure[[]SIPServerMeta]("QUERY_ERROR", fmt.Sprintf("Failed to list servers: %v", err))
	}

	metas := make([]SIPServerMeta, len(servers))
	for i, srv := range servers {
		metas[i] = SIPServerMeta{
			ID:        srv.ID,
			Name:      srv.Name,
			Address:   srv.Address,
			Port:      srv.Port,
			Transport: srv.Transport,
		}
	}

	return Success(metas)
}

// GetServer retrieves a SIP server by ID
func (s *SIPService) GetServer(id int) Response[*ent.SIPServer] {
	if s.entClient == nil {
		return Failure[*ent.SIPServer]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	srv, err := s.entClient.SIPServer.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[*ent.SIPServer]("NOT_FOUND", fmt.Sprintf("Server with ID %d not found", id))
		}
		return Failure[*ent.SIPServer]("QUERY_ERROR", fmt.Sprintf("Failed to get server: %v", err))
	}

	return Success(srv)
}

// CreateServer creates a new SIP server configuration
func (s *SIPService) CreateServer(req CreateServerRequest) Response[*ent.SIPServer] {
	if s.entClient == nil {
		return Failure[*ent.SIPServer]("NO_PROJECT", "No project is open")
	}

	if req.Name == "" {
		return Failure[*ent.SIPServer]("VALIDATION_ERROR", "Server name cannot be empty")
	}
	if req.Address == "" {
		return Failure[*ent.SIPServer]("VALIDATION_ERROR", "Server address cannot be empty")
	}

	ctx := context.Background()
	builder := s.entClient.SIPServer.
		Create().
		SetName(req.Name).
		SetAddress(req.Address).
		SetPort(req.Port).
		SetTransport(req.Transport)

	if req.Username != "" {
		builder.SetUsername(req.Username)
	}
	if req.Password != "" {
		builder.SetPassword(req.Password)
	}

	srv, err := builder.Save(ctx)
	if err != nil {
		return Failure[*ent.SIPServer]("CREATE_ERROR", fmt.Sprintf("Failed to create server: %v", err))
	}

	return Success(srv)
}

// UpdateServer updates an existing SIP server configuration
func (s *SIPService) UpdateServer(req UpdateServerRequest) Response[*ent.SIPServer] {
	if s.entClient == nil {
		return Failure[*ent.SIPServer]("NO_PROJECT", "No project is open")
	}

	if req.Name == "" {
		return Failure[*ent.SIPServer]("VALIDATION_ERROR", "Server name cannot be empty")
	}
	if req.Address == "" {
		return Failure[*ent.SIPServer]("VALIDATION_ERROR", "Server address cannot be empty")
	}

	ctx := context.Background()
	srv, err := s.entClient.SIPServer.
		UpdateOneID(req.ID).
		SetName(req.Name).
		SetAddress(req.Address).
		SetPort(req.Port).
		SetTransport(req.Transport).
		SetUsername(req.Username).
		SetPassword(req.Password).
		SetUpdatedAt(time.Now()).
		Save(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[*ent.SIPServer]("NOT_FOUND", fmt.Sprintf("Server with ID %d not found", req.ID))
		}
		return Failure[*ent.SIPServer]("UPDATE_ERROR", fmt.Sprintf("Failed to update server: %v", err))
	}

	return Success(srv)
}

// DeleteServer deletes a SIP server configuration by ID
func (s *SIPService) DeleteServer(id int) Response[bool] {
	if s.entClient == nil {
		return Failure[bool]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	err := s.entClient.SIPServer.
		DeleteOneID(id).
		Exec(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[bool]("NOT_FOUND", fmt.Sprintf("Server with ID %d not found", id))
		}
		return Failure[bool]("DELETE_ERROR", fmt.Sprintf("Failed to delete server: %v", err))
	}

	return Success(true)
}

// StartUA creates and starts a SIP User Agent for a given flow node
func (s *SIPService) StartUA(nodeID string, serverID int) Response[bool] {
	if s.entClient == nil {
		return Failure[bool]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	srv, err := s.entClient.SIPServer.Get(ctx, serverID)
	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[bool]("NOT_FOUND", fmt.Sprintf("Server with ID %d not found", serverID))
		}
		return Failure[bool]("QUERY_ERROR", fmt.Sprintf("Failed to get server: %v", err))
	}

	cfg := sip.UAConfig{
		DisplayName: "SIPFlow/1.0",
		Transport:   strings.ToLower(srv.Transport),
		BindHost:    "0.0.0.0",
		BindPort:    0,
	}

	if err := s.uaManager.CreateUA(nodeID, cfg); err != nil {
		return Failure[bool]("UA_ERROR", fmt.Sprintf("Failed to start UA: %v", err))
	}

	return Success(true)
}

// StopUA destroys a SIP User Agent for a given flow node
func (s *SIPService) StopUA(nodeID string) Response[bool] {
	if err := s.uaManager.DestroyUA(nodeID); err != nil {
		return Failure[bool]("UA_ERROR", fmt.Sprintf("Failed to stop UA: %v", err))
	}
	return Success(true)
}

// StopAllUAs destroys all active SIP User Agents
func (s *SIPService) StopAllUAs() Response[bool] {
	s.uaManager.DestroyAll()
	return Success(true)
}

// GetUAStatus returns the status of a specific UA
func (s *SIPService) GetUAStatus(nodeID string) Response[map[string]interface{}] {
	status, found := s.uaManager.GetStatus(nodeID)
	if !found {
		return Failure[map[string]interface{}]("NOT_FOUND", fmt.Sprintf("UA not found for node %s", nodeID))
	}

	return Success(map[string]interface{}{
		"nodeID":    status.NodeID,
		"transport": status.Transport,
		"active":    status.Active,
	})
}

// ListUAStatuses returns the status of all active UAs
func (s *SIPService) ListUAStatuses() Response[[]map[string]interface{}] {
	statuses := s.uaManager.ListActive()
	result := make([]map[string]interface{}, len(statuses))
	for i, status := range statuses {
		result[i] = map[string]interface{}{
			"nodeID":    status.NodeID,
			"transport": status.Transport,
			"active":    status.Active,
		}
	}
	return Success(result)
}

// SetSIPTrace enables or disables SIP protocol trace logging
func (s *SIPService) SetSIPTrace(enabled bool) Response[bool] {
	sipgosip.SIPDebug = enabled
	return Success(true)
}
