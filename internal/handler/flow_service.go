package handler

import (
	"context"
	"fmt"

	"sipflow/ent"
	"sipflow/ent/flow"
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

// CreateFlow creates a new flow with the given name and description
func (s *FlowService) CreateFlow(name, description string) Response[*ent.Flow] {
	if name == "" {
		return Failure[*ent.Flow]("VALIDATION_ERROR", "Flow name cannot be empty")
	}

	ctx := context.Background()
	newFlow, err := s.entClient.Flow.
		Create().
		SetName(name).
		SetDescription(description).
		Save(ctx)

	if err != nil {
		return Failure[*ent.Flow]("CREATE_ERROR", fmt.Sprintf("Failed to create flow: %v", err))
	}

	return Success(newFlow)
}

// GetFlow retrieves a flow by ID with eager loading of nodes and edges
func (s *FlowService) GetFlow(id int) Response[*ent.Flow] {
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

// ListFlows retrieves all flows ordered by updated_at descending
func (s *FlowService) ListFlows() Response[[]*ent.Flow] {
	ctx := context.Background()
	flows, err := s.entClient.Flow.
		Query().
		Order(ent.Desc(flow.FieldUpdatedAt)).
		All(ctx)

	if err != nil {
		return Failure[[]*ent.Flow]("QUERY_ERROR", fmt.Sprintf("Failed to list flows: %v", err))
	}

	return Success(flows)
}

// DeleteFlow deletes a flow by ID
func (s *FlowService) DeleteFlow(id int) Response[bool] {
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
