package handler

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"

	"sipflow/ent"
	"sipflow/internal/infra/sqlite"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProjectService manages project lifecycle and runtime database switching
type ProjectService struct {
	ctx         context.Context
	entClient   *ent.Client
	currentPath string
	flowService *FlowService
	sipService  *SIPService
	mu          sync.Mutex
}

// NewProjectService creates a new ProjectService instance
func NewProjectService(flowService *FlowService, sipService *SIPService) *ProjectService {
	return &ProjectService{
		flowService: flowService,
		sipService:  sipService,
	}
}

// SetContext sets the Wails runtime context (called from app.startup)
func (s *ProjectService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// NewProject creates a new .sipflow project file
func (s *ProjectService) NewProject() Response[bool] {
	path, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "Create New Project",
		DefaultFilename: "untitled.sipflow",
		Filters: []runtime.FileFilter{
			{DisplayName: "SIPFlow Project", Pattern: "*.sipflow"},
		},
	})

	if err != nil {
		return Failure[bool]("DIALOG_ERROR", fmt.Sprintf("Failed to show save dialog: %v", err))
	}

	// User canceled the dialog
	if path == "" {
		return Failure[bool]("USER_CANCELED", "New project creation canceled")
	}

	// Open database at the chosen path (creates the file and runs migration)
	if err := s.openDatabase(path); err != nil {
		return Failure[bool]("CREATE_ERROR", fmt.Sprintf("Failed to create project: %v", err))
	}

	// Emit project:created event
	runtime.EventsEmit(s.ctx, "project:created", map[string]interface{}{
		"path": path,
	})

	return Success(true)
}

// OpenProject opens an existing .sipflow project file
func (s *ProjectService) OpenProject() Response[string] {
	path, err := runtime.OpenFileDialog(s.ctx, runtime.OpenDialogOptions{
		Title: "Open Project",
		Filters: []runtime.FileFilter{
			{DisplayName: "SIPFlow Project", Pattern: "*.sipflow"},
		},
	})

	if err != nil {
		return Failure[string]("DIALOG_ERROR", fmt.Sprintf("Failed to show open dialog: %v", err))
	}

	// User canceled the dialog
	if path == "" {
		return Failure[string]("USER_CANCELED", "Open project canceled")
	}

	// Open database at the chosen path
	if err := s.openDatabase(path); err != nil {
		return Failure[string]("OPEN_ERROR", fmt.Sprintf("Failed to open project: %v", err))
	}

	// Emit project:opened event
	runtime.EventsEmit(s.ctx, "project:opened", map[string]interface{}{
		"path": path,
	})

	return Success(path)
}

// CloseProject closes the current project
func (s *ProjectService) CloseProject() Response[bool] {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Close ent client if exists
	if s.entClient != nil {
		if err := s.entClient.Close(); err != nil {
			return Failure[bool]("CLOSE_ERROR", fmt.Sprintf("Failed to close project: %v", err))
		}
		s.entClient = nil
	}

	// Clear current path
	s.currentPath = ""

	// Clear service ent clients
	s.flowService.setEntClient(nil)
	s.sipService.setEntClient(nil)

	// Emit project:closed event
	runtime.EventsEmit(s.ctx, "project:closed", map[string]interface{}{})

	return Success(true)
}

// SaveProjectAs saves the current project to a new location
func (s *ProjectService) SaveProjectAs() Response[string] {
	s.mu.Lock()
	currentPath := s.currentPath
	s.mu.Unlock()

	// Check if a project is open
	if currentPath == "" {
		return Failure[string]("NO_PROJECT", "No project is currently open")
	}

	// Show save dialog
	newPath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "Save Project As",
		DefaultFilename: "untitled.sipflow",
		Filters: []runtime.FileFilter{
			{DisplayName: "SIPFlow Project", Pattern: "*.sipflow"},
		},
	})

	if err != nil {
		return Failure[string]("DIALOG_ERROR", fmt.Sprintf("Failed to show save dialog: %v", err))
	}

	// User canceled the dialog
	if newPath == "" {
		return Failure[string]("USER_CANCELED", "Save as canceled")
	}

	// Close current database connection before copying
	s.mu.Lock()
	if s.entClient != nil {
		if err := s.entClient.Close(); err != nil {
			s.mu.Unlock()
			return Failure[string]("CLOSE_ERROR", fmt.Sprintf("Failed to close current project: %v", err))
		}
		s.entClient = nil
	}
	s.mu.Unlock()

	// Copy database file to new location
	sourceFile, err := os.Open(currentPath)
	if err != nil {
		// Reopen the original database since copy failed
		_ = s.openDatabase(currentPath)
		return Failure[string]("COPY_ERROR", fmt.Sprintf("Failed to open source file: %v", err))
	}
	defer sourceFile.Close()

	destFile, err := os.Create(newPath)
	if err != nil {
		sourceFile.Close()
		// Reopen the original database since copy failed
		_ = s.openDatabase(currentPath)
		return Failure[string]("COPY_ERROR", fmt.Sprintf("Failed to create destination file: %v", err))
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		// Reopen the original database since copy failed
		_ = s.openDatabase(currentPath)
		return Failure[string]("COPY_ERROR", fmt.Sprintf("Failed to copy file: %v", err))
	}

	// Reopen at new location
	if err := s.openDatabase(newPath); err != nil {
		// Try to reopen the original database
		_ = s.openDatabase(currentPath)
		return Failure[string]("OPEN_ERROR", fmt.Sprintf("Failed to open new project file: %v", err))
	}

	// Emit project:opened event with new path
	runtime.EventsEmit(s.ctx, "project:opened", map[string]interface{}{
		"path": newPath,
	})

	return Success(newPath)
}

// CurrentProjectPath returns the current project file path
func (s *ProjectService) CurrentProjectPath() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.currentPath
}

// IsProjectOpen returns true if a project is currently open
func (s *ProjectService) IsProjectOpen() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.currentPath != ""
}

// openDatabase opens or creates a database at the given path and runs migrations.
// This is the core DB switching logic used by NewProject, OpenProject, and SaveProjectAs.
// It closes any existing client first to prevent "database is locked" errors.
func (s *ProjectService) openDatabase(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Close existing client if any
	if s.entClient != nil {
		if err := s.entClient.Close(); err != nil {
			return fmt.Errorf("failed to close existing database: %w", err)
		}
		s.entClient = nil
	}

	// Open ent driver with custom SQLite configuration
	drv, err := sqlite.OpenEntDriver(path)
	if err != nil {
		return fmt.Errorf("failed to open database driver: %w", err)
	}

	// Create ent client
	client := ent.NewClient(ent.Driver(drv))

	// Run auto-migration (idempotent - safe to run on existing databases)
	ctx := context.Background()
	if err := client.Schema.Create(ctx); err != nil {
		client.Close()
		return fmt.Errorf("failed to create/migrate schema: %w", err)
	}

	// Update state
	s.entClient = client
	s.currentPath = path

	// Update service ent clients
	s.flowService.setEntClient(client)
	s.sipService.setEntClient(client)

	return nil
}
