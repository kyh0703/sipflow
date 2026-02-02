package handler

import (
	"context"
	"fmt"
	"time"

	"sipflow/ent"
	"sipflow/ent/sipserver"
)

// SIPService handles SIP server configuration CRUD for Wails binding
type SIPService struct {
	entClient *ent.Client
	emitter   *EventEmitter
}

// NewSIPService creates a new SIPService instance
func NewSIPService(emitter *EventEmitter) *SIPService {
	return &SIPService{
		emitter: emitter,
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
