package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"sipflow/internal/binding"
	"sipflow/internal/engine"
	"sipflow/internal/scenario"
)

// App struct
type App struct {
	ctx             context.Context
	engine          *engine.Engine
	engineBinding   *binding.EngineBinding
	scenarioBinding *binding.ScenarioBinding
	mediaBinding    *binding.MediaBinding
	scenarioRepo    *scenario.Repository
}

// NewApp creates a new App application struct
func NewApp() *App {
	// Determine database path
	configDir, err := os.UserConfigDir()
	if err != nil {
		panic(fmt.Sprintf("failed to get user config dir: %v", err))
	}

	dbDir := filepath.Join(configDir, "sipflow")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		panic(fmt.Sprintf("failed to create config directory: %v", err))
	}

	dbPath := filepath.Join(dbDir, "scenarios.db")

	// Initialize repository
	repo, err := scenario.NewRepository(dbPath)
	if err != nil {
		panic(fmt.Sprintf("failed to initialize scenario repository: %v", err))
	}

	// Create Engine
	eng := engine.NewEngine(repo)

	return &App{
		engine:          eng,
		engineBinding:   binding.NewEngineBinding(eng),
		scenarioBinding: binding.NewScenarioBinding(repo),
		mediaBinding:    binding.NewMediaBinding(),
		scenarioRepo:    repo,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.engine.SetContext(ctx)
	a.engineBinding.SetContext(ctx)
	a.scenarioBinding.SetContext(ctx)
	a.mediaBinding.SetContext(ctx)
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Stop running scenario if any
	if a.engine != nil && a.engine.IsRunning() {
		a.engine.StopScenario()
	}

	// Close repository
	if a.scenarioRepo != nil {
		a.scenarioRepo.Close()
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
