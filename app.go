package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"sipflow/ent"
	"sipflow/internal/handler"
	"sipflow/internal/infra/sqlite"
)

// App struct
type App struct {
	ctx          context.Context
	entClient    *ent.Client
	eventEmitter *handler.EventEmitter
	flowService  *handler.FlowService
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		eventEmitter: handler.NewEventEmitter(),
		flowService:  handler.NewFlowService(nil), // Will be set during startup
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Get user config directory for database storage
	configDir, err := os.UserConfigDir()
	if err != nil {
		log.Fatalf("Failed to get user config directory: %v", err)
	}

	// Create sipflow config directory if it doesn't exist
	appConfigDir := filepath.Join(configDir, "sipflow")
	if err := os.MkdirAll(appConfigDir, 0755); err != nil {
		log.Fatalf("Failed to create app config directory: %v", err)
	}

	// Database path
	dbPath := filepath.Join(appConfigDir, "sipflow.db")

	// Open ent client with custom SQLite driver
	drv, err := sqlite.OpenEntDriver(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Create ent client
	client := ent.NewClient(ent.Driver(drv))
	a.entClient = client

	// Run auto-migration
	if err := client.Schema.Create(ctx); err != nil {
		log.Fatalf("Failed to create schema: %v", err)
	}

	log.Printf("Database initialized at: %s", dbPath)

	// Set ent client for FlowService (FlowService was created in NewApp for Wails binding)
	a.flowService.SetEntClient(client)

	// Set EventEmitter context and initialize handshake
	a.eventEmitter.SetContext(ctx)
	a.eventEmitter.OnStartup(ctx)
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.entClient != nil {
		if err := a.entClient.Close(); err != nil {
			log.Printf("Failed to close database: %v", err)
		}
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
