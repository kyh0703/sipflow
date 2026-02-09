package binding

import (
	"context"
	"fmt"

	"sipflow/internal/scenario"

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
func (s *ScenarioBinding) CreateScenario(name string) (*scenario.Scenario, error) {
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
func (s *ScenarioBinding) LoadScenario(id string) (*scenario.Scenario, error) {
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
func (s *ScenarioBinding) ListScenarios() ([]scenario.ScenarioListItem, error) {
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
