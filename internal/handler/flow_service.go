package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"sipflow/ent"
	"sipflow/ent/edge"
	"sipflow/ent/flow"
	"sipflow/ent/node"
)

// FlowService handles flow-related operations for Wails binding
type FlowService struct {
	entClient *ent.Client
}

// NewFlowService creates a new FlowService instance
func NewFlowService(client *ent.Client) *FlowService {
	return &FlowService{
		entClient: client,
	}
}

// setEntClient updates the ent client (unexported to prevent Wails binding)
func (s *FlowService) setEntClient(client *ent.Client) {
	s.entClient = client
}

// FlowNodeData represents a single xyflow node for persistence
type FlowNodeData struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	PositionX float64                `json:"positionX"`
	PositionY float64                `json:"positionY"`
	Data      map[string]interface{} `json:"data"`
}

// FlowEdgeData represents a single xyflow edge for persistence
type FlowEdgeData struct {
	ID           string                 `json:"id"`
	Source       string                 `json:"source"`
	Target       string                 `json:"target"`
	SourceHandle string                 `json:"sourceHandle"`
	TargetHandle string                 `json:"targetHandle"`
	Type         string                 `json:"type"`
	Data         map[string]interface{} `json:"data"`
}

// SaveFlowRequest contains complete xyflow canvas state
type SaveFlowRequest struct {
	FlowID       int            `json:"flowId"`       // 0 for new flow
	Name         string         `json:"name"`
	Nodes        []FlowNodeData `json:"nodes"`
	Edges        []FlowEdgeData `json:"edges"`
	ViewportX    float64        `json:"viewportX"`
	ViewportY    float64        `json:"viewportY"`
	ViewportZoom float64        `json:"viewportZoom"`
}

// FlowState represents complete xyflow-compatible canvas state
type FlowState struct {
	FlowID       int            `json:"flowId"`
	Name         string         `json:"name"`
	Nodes        []FlowNodeData `json:"nodes"`
	Edges        []FlowEdgeData `json:"edges"`
	ViewportX    float64        `json:"viewportX"`
	ViewportY    float64        `json:"viewportY"`
	ViewportZoom float64        `json:"viewportZoom"`
}

// FlowMeta represents flow list item (minimal metadata)
type FlowMeta struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// SaveFlow atomically persists complete xyflow canvas state (nodes, edges, viewport)
func (s *FlowService) SaveFlow(req SaveFlowRequest) Response[int] {
	if s.entClient == nil {
		return Failure[int]("NO_PROJECT", "No project is open")
	}

	if req.Name == "" {
		return Failure[int]("VALIDATION_ERROR", "Flow name cannot be empty")
	}

	ctx := context.Background()

	// Start transaction for atomic save
	tx, err := s.entClient.Tx(ctx)
	if err != nil {
		return Failure[int]("TRANSACTION_ERROR", fmt.Sprintf("Failed to start transaction: %v", err))
	}

	var flowID int
	var saveErr error

	// Use defer to handle rollback on error
	defer func() {
		if saveErr != nil {
			tx.Rollback()
		}
	}()

	if req.FlowID > 0 {
		// Update existing flow
		flowID = req.FlowID

		// Update flow metadata and viewport
		_, saveErr = tx.Flow.
			UpdateOneID(flowID).
			SetName(req.Name).
			SetViewportX(req.ViewportX).
			SetViewportY(req.ViewportY).
			SetViewportZoom(req.ViewportZoom).
			Save(ctx)
		if saveErr != nil {
			return Failure[int]("UPDATE_ERROR", fmt.Sprintf("Failed to update flow: %v", saveErr))
		}

		// Delete existing edges first (FK constraint)
		_, saveErr = tx.Edge.
			Delete().
			Where(edge.HasFlowWith(flow.ID(flowID))).
			Exec(ctx)
		if saveErr != nil {
			return Failure[int]("DELETE_ERROR", fmt.Sprintf("Failed to delete existing edges: %v", saveErr))
		}

		// Delete existing nodes
		_, saveErr = tx.Node.
			Delete().
			Where(node.HasFlowWith(flow.ID(flowID))).
			Exec(ctx)
		if saveErr != nil {
			return Failure[int]("DELETE_ERROR", fmt.Sprintf("Failed to delete existing nodes: %v", saveErr))
		}
	} else {
		// Create new flow
		newFlow, err := tx.Flow.
			Create().
			SetName(req.Name).
			SetViewportX(req.ViewportX).
			SetViewportY(req.ViewportY).
			SetViewportZoom(req.ViewportZoom).
			Save(ctx)
		if err != nil {
			saveErr = err
			return Failure[int]("CREATE_ERROR", fmt.Sprintf("Failed to create flow: %v", err))
		}
		flowID = newFlow.ID
	}

	// Build xyflow_id -> ent node ID map for edge references
	xyflowIDToNodeID := make(map[string]int)

	// Create nodes
	for _, nodeData := range req.Nodes {
		dataJSON, err := json.Marshal(nodeData.Data)
		if err != nil {
			saveErr = err
			return Failure[int]("JSON_ERROR", fmt.Sprintf("Failed to marshal node data: %v", err))
		}

		var dataMap map[string]interface{}
		if err := json.Unmarshal(dataJSON, &dataMap); err != nil {
			saveErr = err
			return Failure[int]("JSON_ERROR", fmt.Sprintf("Failed to unmarshal node data: %v", err))
		}

		newNode, err := tx.Node.
			Create().
			SetFlowID(flowID).
			SetType(nodeData.Type).
			SetXyflowID(nodeData.ID).
			SetPositionX(nodeData.PositionX).
			SetPositionY(nodeData.PositionY).
			SetData(dataMap).
			Save(ctx)
		if err != nil {
			saveErr = err
			return Failure[int]("CREATE_ERROR", fmt.Sprintf("Failed to create node: %v", err))
		}

		xyflowIDToNodeID[nodeData.ID] = newNode.ID
	}

	// Create edges using xyflow_id map for FK references
	for _, edgeData := range req.Edges {
		sourceNodeID, sourceOk := xyflowIDToNodeID[edgeData.Source]
		targetNodeID, targetOk := xyflowIDToNodeID[edgeData.Target]

		if !sourceOk || !targetOk {
			saveErr = fmt.Errorf("edge references non-existent node: source=%s, target=%s", edgeData.Source, edgeData.Target)
			return Failure[int]("VALIDATION_ERROR", fmt.Sprintf("Edge references non-existent node: source=%s, target=%s", edgeData.Source, edgeData.Target))
		}

		dataJSON, err := json.Marshal(edgeData.Data)
		if err != nil {
			saveErr = err
			return Failure[int]("JSON_ERROR", fmt.Sprintf("Failed to marshal edge data: %v", err))
		}

		var dataMap map[string]interface{}
		if err := json.Unmarshal(dataJSON, &dataMap); err != nil {
			saveErr = err
			return Failure[int]("JSON_ERROR", fmt.Sprintf("Failed to unmarshal edge data: %v", err))
		}

		_, err = tx.Edge.
			Create().
			SetFlowID(flowID).
			SetSourceNodeID(sourceNodeID).
			SetTargetNodeID(targetNodeID).
			SetXyflowID(edgeData.ID).
			SetType(edgeData.Type).
			SetSourceHandle(edgeData.SourceHandle).
			SetTargetHandle(edgeData.TargetHandle).
			SetData(dataMap).
			Save(ctx)
		if err != nil {
			saveErr = err
			return Failure[int]("CREATE_ERROR", fmt.Sprintf("Failed to create edge: %v", err))
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return Failure[int]("COMMIT_ERROR", fmt.Sprintf("Failed to commit transaction: %v", err))
	}

	return Success(flowID)
}

// CreateFlow creates a new flow with the given name and description
func (s *FlowService) CreateFlow(name, description string) Response[*ent.Flow] {
	if s.entClient == nil {
		return Failure[*ent.Flow]("NO_PROJECT", "No project is open")
	}

	if name == "" {
		return Failure[*ent.Flow]("VALIDATION_ERROR", "Flow name cannot be empty")
	}

	ctx := context.Background()
	newFlow, err := s.entClient.Flow.
		Create().
		SetName(name).
		SetDescription(description).
		SetViewportZoom(1.0).
		Save(ctx)

	if err != nil {
		return Failure[*ent.Flow]("CREATE_ERROR", fmt.Sprintf("Failed to create flow: %v", err))
	}

	return Success(newFlow)
}

// GetFlow retrieves a flow by ID with eager loading of nodes and edges
func (s *FlowService) GetFlow(id int) Response[*ent.Flow] {
	if s.entClient == nil {
		return Failure[*ent.Flow]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	f, err := s.entClient.Flow.
		Query().
		Where(flow.ID(id)).
		WithNodes().
		WithEdges().
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[*ent.Flow]("NOT_FOUND", fmt.Sprintf("Flow with ID %d not found", id))
		}
		return Failure[*ent.Flow]("QUERY_ERROR", fmt.Sprintf("Failed to get flow: %v", err))
	}

	return Success(f)
}

// ListFlows retrieves all flows as lightweight metadata ordered by updated_at descending
func (s *FlowService) ListFlows() Response[[]FlowMeta] {
	if s.entClient == nil {
		return Failure[[]FlowMeta]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	flows, err := s.entClient.Flow.
		Query().
		Order(ent.Desc(flow.FieldUpdatedAt)).
		All(ctx)

	if err != nil {
		return Failure[[]FlowMeta]("QUERY_ERROR", fmt.Sprintf("Failed to list flows: %v", err))
	}

	metas := make([]FlowMeta, len(flows))
	for i, f := range flows {
		metas[i] = FlowMeta{
			ID:        f.ID,
			Name:      f.Name,
			CreatedAt: f.CreatedAt.Format(time.RFC3339),
			UpdatedAt: f.UpdatedAt.Format(time.RFC3339),
		}
	}

	return Success(metas)
}

// DeleteFlow deletes a flow by ID
func (s *FlowService) DeleteFlow(id int) Response[bool] {
	if s.entClient == nil {
		return Failure[bool]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	err := s.entClient.Flow.
		DeleteOneID(id).
		Exec(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[bool]("NOT_FOUND", fmt.Sprintf("Flow with ID %d not found", id))
		}
		return Failure[bool]("DELETE_ERROR", fmt.Sprintf("Failed to delete flow: %v", err))
	}

	return Success(true)
}

// LoadFlow retrieves complete xyflow-compatible canvas state for a flow
func (s *FlowService) LoadFlow(id int) Response[*FlowState] {
	if s.entClient == nil {
		return Failure[*FlowState]("NO_PROJECT", "No project is open")
	}

	ctx := context.Background()
	f, err := s.entClient.Flow.
		Query().
		Where(flow.ID(id)).
		WithNodes().
		WithEdges(func(q *ent.EdgeQuery) {
			q.WithSourceNode()
			q.WithTargetNode()
		}).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[*FlowState]("NOT_FOUND", fmt.Sprintf("Flow with ID %d not found", id))
		}
		return Failure[*FlowState]("QUERY_ERROR", fmt.Sprintf("Failed to load flow: %v", err))
	}

	// Map ent nodes to FlowNodeData
	nodes := make([]FlowNodeData, len(f.Edges.Nodes))
	for i, n := range f.Edges.Nodes {
		nodes[i] = FlowNodeData{
			ID:        n.XyflowID,
			Type:      n.Type,
			PositionX: n.PositionX,
			PositionY: n.PositionY,
			Data:      n.Data,
		}
	}

	// Map ent edges to FlowEdgeData with source/target xyflow IDs
	edges := make([]FlowEdgeData, len(f.Edges.Edges))
	for i, e := range f.Edges.Edges {
		var sourceXyflowID, targetXyflowID string
		if e.Edges.SourceNode != nil {
			sourceXyflowID = e.Edges.SourceNode.XyflowID
		}
		if e.Edges.TargetNode != nil {
			targetXyflowID = e.Edges.TargetNode.XyflowID
		}

		edges[i] = FlowEdgeData{
			ID:           e.XyflowID,
			Source:       sourceXyflowID,
			Target:       targetXyflowID,
			SourceHandle: e.SourceHandle,
			TargetHandle: e.TargetHandle,
			Type:         e.Type,
			Data:         e.Data,
		}
	}

	state := &FlowState{
		FlowID:       f.ID,
		Name:         f.Name,
		Nodes:        nodes,
		Edges:        edges,
		ViewportX:    f.ViewportX,
		ViewportY:    f.ViewportY,
		ViewportZoom: f.ViewportZoom,
	}

	return Success(state)
}

// UpdateFlowName updates the name of an existing flow
func (s *FlowService) UpdateFlowName(id int, name string) Response[bool] {
	if s.entClient == nil {
		return Failure[bool]("NO_PROJECT", "No project is open")
	}

	if name == "" {
		return Failure[bool]("VALIDATION_ERROR", "Flow name cannot be empty")
	}

	ctx := context.Background()
	_, err := s.entClient.Flow.
		UpdateOneID(id).
		SetName(name).
		Save(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return Failure[bool]("NOT_FOUND", fmt.Sprintf("Flow with ID %d not found", id))
		}
		return Failure[bool]("UPDATE_ERROR", fmt.Sprintf("Failed to update flow name: %v", err))
	}

	return Success(true)
}
