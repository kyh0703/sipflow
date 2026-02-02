package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"

	"sipflow/internal/handler"
	"sipflow/internal/infra/sip"
)

// App struct
type App struct {
	ctx            context.Context
	eventEmitter   *handler.EventEmitter
	flowService    *handler.FlowService
	sipService     *handler.SIPService
	projectService *handler.ProjectService
}

// NewApp creates a new App application struct
func NewApp() *App {
	emitter := handler.NewEventEmitter()

	// Create SIP trace handler that forwards logs to frontend
	innerHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
	traceHandler := sip.NewSIPTraceHandler(innerHandler, func(entry sip.SIPTraceEntry) {
		emitter.Emit("sip:trace", map[string]interface{}{
			"time":    entry.Time.Format("15:04:05.000"),
			"level":   entry.Level,
			"message": entry.Message,
			"nodeID":  entry.NodeID,
		})
	})
	sipLogger := slog.New(traceHandler)

	// Create UA manager with trace-enabled logger
	uaManager := sip.NewUAManager(sipLogger)

	sessionManager := sip.NewSessionManager(sipLogger)

	flowService := handler.NewFlowService(nil) // Will be set during startup
	sipService := handler.NewSIPService(emitter, uaManager, sessionManager)
	return &App{
		eventEmitter:   emitter,
		flowService:    flowService,
		sipService:     sipService,
		projectService: handler.NewProjectService(flowService, sipService),
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
	// Stop all active SIP UAs before closing project
	a.sipService.StopAllUAs()
	// Close project if one is open
	a.projectService.CloseProject()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
