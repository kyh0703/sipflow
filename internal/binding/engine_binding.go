package binding

import (
	"context"

	_ "github.com/emiago/diago" // SIP engine library - imported for dependency tracking
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EngineBinding provides frontend bindings for SIP engine operations
type EngineBinding struct {
	ctx context.Context
}

// NewEngineBinding creates a new EngineBinding instance
func NewEngineBinding() *EngineBinding {
	return &EngineBinding{}
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
