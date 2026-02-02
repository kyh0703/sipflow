package main

import (
	"context"
	"fmt"
	"log"

	"sipflow/internal/handler"
)

// App struct
type App struct {
	ctx            context.Context
	eventEmitter   *handler.EventEmitter
	flowService    *handler.FlowService
	projectService *handler.ProjectService
}

// NewApp creates a new App application struct
func NewApp() *App {
	flowService := handler.NewFlowService(nil) // Will be set during startup
	return &App{
		eventEmitter:   handler.NewEventEmitter(),
		flowService:    flowService,
		projectService: handler.NewProjectService(flowService),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Set ProjectService context for runtime dialogs
	a.projectService.SetContext(ctx)

	// Set EventEmitter context and initialize handshake
	a.eventEmitter.SetContext(ctx)
	a.eventEmitter.OnStartup(ctx)

	// App now starts with NO database open - user must create/open a project
	log.Println("Application started - no project open")
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Close project if one is open
	a.projectService.CloseProject()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
