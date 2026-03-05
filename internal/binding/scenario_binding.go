package binding

import (
	"context"
	"fmt"

	"github.com/kyh0703/sipflow/internal/domain/entity"
	"github.com/kyh0703/sipflow/internal/dto"
	"github.com/kyh0703/sipflow/internal/scenario"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ScenarioBinding provides frontend bindings for scenario persistence operations
type ScenarioBinding struct {
	ctx  context.Context
	repo *scenario.Repository
}

// NewScenarioBinding creates a new ScenarioBinding instance
func NewScenarioBinding(repo *scenario.Repository) *ScenarioBinding {
	return &ScenarioBinding{
		repo: repo,
	}
}

// SetContext sets the Wails runtime context
func (s *ScenarioBinding) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// CreateScenario creates a new scenario with the given name
func (s *ScenarioBinding) CreateScenario(name string) (*entity.Scenario, error) {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Creating scenario: %s", name))

	sc, err := s.repo.CreateScenario("default", name)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to create scenario: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario created: %s (ID: %s)", name, sc.ID))
	return sc, nil
}

// SaveScenario saves the flow data for an existing scenario
func (s *ScenarioBinding) SaveScenario(id, flowData string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Saving scenario: %s", id))

	err := s.repo.SaveScenario(id, flowData)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to save scenario: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario saved: %s", id))
	return nil
}

// LoadScenario loads a scenario by ID
func (s *ScenarioBinding) LoadScenario(id string) (*entity.Scenario, error) {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Loading scenario: %s", id))

	sc, err := s.repo.LoadScenario(id)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to load scenario: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario loaded: %s", id))
	return sc, nil
}

// ListScenarios lists all scenarios in the default project
func (s *ScenarioBinding) ListScenarios() ([]entity.ScenarioListItem, error) {
	runtime.LogInfo(s.ctx, "Listing scenarios")

	scenarios, err := s.repo.ListScenarios("default")
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to list scenarios: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Found %d scenarios", len(scenarios)))
	return scenarios, nil
}

// DeleteScenario deletes a scenario by ID
func (s *ScenarioBinding) DeleteScenario(id string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Deleting scenario: %s", id))

	err := s.repo.DeleteScenario(id)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to delete scenario: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario deleted: %s", id))
	return nil
}

// RenameScenario renames a scenario
func (s *ScenarioBinding) RenameScenario(id, newName string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Renaming scenario %s to: %s", id, newName))

	err := s.repo.RenameScenario(id, newName)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to rename scenario: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario renamed: %s -> %s", id, newName))
	return nil
}

// UpsertNodeProperty creates or updates node property JSON for a scenario node
func (s *ScenarioBinding) UpsertNodeProperty(input dto.NodePropertyUpsert) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Upserting node property: scenario=%s node=%s", input.ScenarioID, input.NodeID))

	err := s.repo.UpsertNodeProperty(input.ScenarioID, input.NodeID, input.SchemaVersion, input.PropertiesJSON)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to upsert node property: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Node property upserted: scenario=%s node=%s", input.ScenarioID, input.NodeID))
	return nil
}

// LoadNodeProperty loads node property JSON by scenario/node ID
func (s *ScenarioBinding) LoadNodeProperty(scenarioID, nodeID string) (*entity.NodePropertyRecord, error) {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Loading node property: scenario=%s node=%s", scenarioID, nodeID))

	prop, err := s.repo.GetNodeProperty(scenarioID, nodeID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to load node property: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Node property loaded: scenario=%s node=%s", scenarioID, nodeID))
	return prop, nil
}

// UpsertScenarioNode creates or updates scenario node metadata
func (s *ScenarioBinding) UpsertScenarioNode(input dto.NodeUpsert) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Upserting scenario node: scenario=%s node=%s", input.ScenarioID, input.NodeID))

	err := s.repo.UpsertScenarioNode(entity.NodeRecord{
		ScenarioID:    input.ScenarioID,
		NodeID:        input.NodeID,
		NodeType:      input.NodeType,
		Label:         input.Label,
		SipInstanceID: input.SipInstanceID,
		PositionX:     input.PositionX,
		PositionY:     input.PositionY,
		Width:         input.Width,
		Height:        input.Height,
		ZIndex:        input.ZIndex,
		StyleJSON:     input.StyleJSON,
	})
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to upsert scenario node: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario node upserted: scenario=%s node=%s", input.ScenarioID, input.NodeID))
	return nil
}

// DeleteScenarioNode removes a node from a scenario
func (s *ScenarioBinding) DeleteScenarioNode(scenarioID, nodeID string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Deleting scenario node: scenario=%s node=%s", scenarioID, nodeID))

	err := s.repo.DeleteScenarioNode(scenarioID, nodeID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to delete scenario node: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario node deleted: scenario=%s node=%s", scenarioID, nodeID))
	return nil
}

// DeleteScenarioNodesByScenario removes all nodes for a scenario
func (s *ScenarioBinding) DeleteScenarioNodesByScenario(scenarioID string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Deleting all scenario nodes: scenario=%s", scenarioID))

	err := s.repo.DeleteScenarioNodesByScenario(scenarioID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to delete all scenario nodes: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("All scenario nodes deleted: scenario=%s", scenarioID))
	return nil
}

// ListScenarioNodes lists all nodes for a scenario
func (s *ScenarioBinding) ListScenarioNodes(scenarioID string) ([]entity.NodeRecord, error) {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Listing scenario nodes: scenario=%s", scenarioID))

	nodes, err := s.repo.ListScenarioNodes(scenarioID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to list scenario nodes: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Listed %d scenario nodes: scenario=%s", len(nodes), scenarioID))
	return nodes, nil
}

// UpsertScenarioEdge creates or updates scenario edge metadata
func (s *ScenarioBinding) UpsertScenarioEdge(input dto.EdgeUpsert) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Upserting scenario edge: scenario=%s edge=%s", input.ScenarioID, input.EdgeID))

	err := s.repo.UpsertScenarioEdge(entity.EdgeRecord{
		ScenarioID:   input.ScenarioID,
		EdgeID:       input.EdgeID,
		SourceNodeID: input.SourceNodeID,
		TargetNodeID: input.TargetNodeID,
		SourceHandle: input.SourceHandle,
		BranchType:   input.BranchType,
		DataJSON:     input.DataJSON,
	})
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to upsert scenario edge: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario edge upserted: scenario=%s edge=%s", input.ScenarioID, input.EdgeID))
	return nil
}

// DeleteScenarioEdge removes an edge from a scenario
func (s *ScenarioBinding) DeleteScenarioEdge(scenarioID, edgeID string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Deleting scenario edge: scenario=%s edge=%s", scenarioID, edgeID))

	err := s.repo.DeleteScenarioEdge(scenarioID, edgeID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to delete scenario edge: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Scenario edge deleted: scenario=%s edge=%s", scenarioID, edgeID))
	return nil
}

// DeleteScenarioEdgesByScenario removes all edges for a scenario
func (s *ScenarioBinding) DeleteScenarioEdgesByScenario(scenarioID string) error {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Deleting all scenario edges: scenario=%s", scenarioID))

	err := s.repo.DeleteScenarioEdgesByScenario(scenarioID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to delete all scenario edges: %v", err))
		return err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("All scenario edges deleted: scenario=%s", scenarioID))
	return nil
}

// ListScenarioEdges lists all edges for a scenario
func (s *ScenarioBinding) ListScenarioEdges(scenarioID string) ([]entity.EdgeRecord, error) {
	runtime.LogInfo(s.ctx, fmt.Sprintf("Listing scenario edges: scenario=%s", scenarioID))

	edges, err := s.repo.ListScenarioEdges(scenarioID)
	if err != nil {
		runtime.LogError(s.ctx, fmt.Sprintf("Failed to list scenario edges: %v", err))
		return nil, err
	}

	runtime.LogInfo(s.ctx, fmt.Sprintf("Listed %d scenario edges: scenario=%s", len(edges), scenarioID))
	return edges, nil
}
