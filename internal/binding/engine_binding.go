package binding

import (
	"context"
	"fmt"

	_ "github.com/emiago/diago" // SIP engine library - imported for dependency tracking
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"sipflow/internal/engine"
)

// EngineBinding provides frontend bindings for SIP engine operations
type EngineBinding struct {
	ctx    context.Context
	engine *engine.Engine
}

// NewEngineBinding creates a new EngineBinding instance
func NewEngineBinding(eng *engine.Engine) *EngineBinding {
	return &EngineBinding{
		engine: eng,
	}
}

// SetContext sets the Wails runtime context
func (e *EngineBinding) SetContext(ctx context.Context) {
	e.ctx = ctx
}

// Ping returns "pong" for connectivity testing
func (e *EngineBinding) Ping() string {
	runtime.LogInfo(e.ctx, "Ping called")
	return "pong"
}

// GetVersion returns the current version
func (e *EngineBinding) GetVersion() string {
	return "0.1.0"
}

// StartScenario starts a scenario execution
func (e *EngineBinding) StartScenario(scenarioID string) error {
	runtime.LogInfo(e.ctx, fmt.Sprintf("Starting scenario: %s", scenarioID))
	if err := e.engine.StartScenario(scenarioID); err != nil {
		runtime.LogError(e.ctx, fmt.Sprintf("Failed to start scenario: %v", err))
		return err
	}
	return nil
}

// StopScenario stops the running scenario
func (e *EngineBinding) StopScenario() error {
	runtime.LogInfo(e.ctx, "Stopping scenario")
	if err := e.engine.StopScenario(); err != nil {
		runtime.LogError(e.ctx, fmt.Sprintf("Failed to stop scenario: %v", err))
		return err
	}
	return nil
}

// IsRunning returns whether a scenario is currently running
func (e *EngineBinding) IsRunning() bool {
	return e.engine.IsRunning()
}
