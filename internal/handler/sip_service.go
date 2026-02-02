package handler

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"sipflow/ent"
	"sipflow/ent/sipserver"
	"sipflow/internal/infra/sip"

	"github.com/emiago/diago"
	"github.com/emiago/sipgo"
	sipgosip "github.com/emiago/sipgo/sip"
)

// SIPService handles SIP server configuration CRUD and UA lifecycle for Wails binding
type SIPService struct {
	entClient      *ent.Client
	emitter        *EventEmitter
	uaManager      *sip.UAManager
	sessionManager *sip.SessionManager
}

// NewSIPService creates a new SIPService instance
func NewSIPService(emitter *EventEmitter, uaManager *sip.UAManager, sessionManager *sip.SessionManager) *SIPService {
	return &SIPService{
		emitter:        emitter,
		uaManager:      uaManager,
		sessionManager: sessionManager,
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

// MakeCall initiates a SIP INVITE to the target URI via the UA associated with nodeID.
// Returns the callID immediately; the INVITE runs asynchronously in a goroutine.
func (s *SIPService) MakeCall(nodeID, targetURI string) Response[string] {
	if s.entClient == nil {
		return Failure[string]("NO_PROJECT", "No project is open")
	}

	if s.sessionManager.HasActiveCall(nodeID) {
		return Failure[string]("CALL_ACTIVE", fmt.Sprintf("Node %s already has an active call", nodeID))
	}

	dg, err := s.uaManager.GetDiago(nodeID)
	if err != nil {
		return Failure[string]("UA_NOT_FOUND", fmt.Sprintf("UA not found for node %s", nodeID))
	}

	var recipient sipgosip.Uri
	if err := sipgosip.ParseUri("sip:"+targetURI, &recipient); err != nil {
		return Failure[string]("INVALID_URI", fmt.Sprintf("Failed to parse target URI: %v", err))
	}

	callID := fmt.Sprintf("%s-%d", nodeID, time.Now().UnixNano())

	ctx, cancel := context.WithCancel(context.Background())

	session := &sip.ActiveSession{
		Cancel: cancel,
		NodeID: nodeID,
		State:  sip.CallStateDialing,
	}
	s.sessionManager.Add(callID, session)

	s.emitter.Emit("sip:callState", map[string]interface{}{
		"callID": callID,
		"nodeID": nodeID,
		"state":  string(sip.CallStateDialing),
	})

	go s.runInvite(ctx, dg, recipient, callID, nodeID, session)

	return Success(callID)
}

// runInvite executes the SIP INVITE in a goroutine and manages call lifecycle.
func (s *SIPService) runInvite(ctx context.Context, dg *diago.Diago, recipient sipgosip.Uri, callID, nodeID string, session *sip.ActiveSession) {
	defer s.sessionManager.Remove(callID)

	opts := diago.InviteOptions{
		OnResponse: func(res *sipgosip.Response) error {
			if res.StatusCode == 180 {
				session.State = sip.CallStateRinging
				s.emitter.Emit("sip:callState", map[string]interface{}{
					"callID": callID,
					"nodeID": nodeID,
					"state":  "ringing",
				})
			} else if res.StatusCode >= 100 && res.StatusCode < 200 {
				s.emitter.Emit("sip:callState", map[string]interface{}{
					"callID":     callID,
					"nodeID":     nodeID,
					"state":      "progress",
					"statusCode": res.StatusCode,
					"reason":     res.Reason,
				})
			}
			return nil
		},
	}

	dialog, err := dg.Invite(ctx, recipient, opts)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			session.State = sip.CallStateFailed
			s.emitter.Emit("sip:callState", map[string]interface{}{
				"callID": callID,
				"nodeID": nodeID,
				"state":  "cancelled",
			})
		} else {
			var errResp sipgo.ErrDialogResponse
			if errors.As(err, &errResp) {
				session.State = sip.CallStateFailed
				s.emitter.Emit("sip:callState", map[string]interface{}{
					"callID":     callID,
					"nodeID":     nodeID,
					"state":      "failed",
					"statusCode": errResp.Res.StatusCode,
					"reason":     errResp.Res.Reason,
				})
			} else {
				session.State = sip.CallStateFailed
				s.emitter.Emit("sip:callState", map[string]interface{}{
					"callID":     callID,
					"nodeID":     nodeID,
					"state":      "failed",
					"statusCode": 0,
					"reason":     err.Error(),
				})
			}
		}
		return
	}

	session.Dialog = dialog
	session.State = sip.CallStateEstablished
	s.emitter.Emit("sip:callState", map[string]interface{}{
		"callID": callID,
		"nodeID": nodeID,
		"state":  "established",
	})

	// Wait for dialog to end (remote BYE or local hangup)
	<-dialog.Context().Done()

	session.State = sip.CallStateTerminated
	s.emitter.Emit("sip:callState", map[string]interface{}{
		"callID": callID,
		"nodeID": nodeID,
		"state":  "terminated",
	})

	_ = dialog.Close()
}

// Bye sends a BYE request to terminate an established call.
func (s *SIPService) Bye(callID string) Response[bool] {
	session, found := s.sessionManager.Get(callID)
	if !found {
		return Failure[bool]("SESSION_NOT_FOUND", fmt.Sprintf("Session %s not found", callID))
	}

	if session.State != sip.CallStateEstablished {
		return Failure[bool]("INVALID_STATE", fmt.Sprintf("Cannot send BYE in state %s", session.State))
	}

	if session.Dialog == nil {
		return Failure[bool]("NO_DIALOG", "Session has no active dialog")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := session.Dialog.Hangup(ctx); err != nil {
		return Failure[bool]("BYE_ERROR", fmt.Sprintf("Failed to send BYE: %v", err))
	}

	return Success(true)
}

// Cancel cancels an outgoing call that is still dialing or ringing.
func (s *SIPService) Cancel(callID string) Response[bool] {
	session, found := s.sessionManager.Get(callID)
	if !found {
		return Failure[bool]("SESSION_NOT_FOUND", fmt.Sprintf("Session %s not found", callID))
	}

	if session.State != sip.CallStateDialing && session.State != sip.CallStateRinging {
		return Failure[bool]("INVALID_STATE", fmt.Sprintf("Cannot cancel in state %s", session.State))
	}

	session.Cancel()
	return Success(true)
}
