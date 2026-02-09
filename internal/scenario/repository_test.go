package scenario

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestCreateScenario(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	scenario, err := repo.CreateScenario("default", "Test Scenario")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	if scenario.ID == "" {
		t.Error("expected scenario ID to be set")
	}

	if scenario.Name != "Test Scenario" {
		t.Errorf("expected name 'Test Scenario', got '%s'", scenario.Name)
	}

	if scenario.ProjectID != "default" {
		t.Errorf("expected project_id 'default', got '%s'", scenario.ProjectID)
	}

	if scenario.FlowData != "{}" {
		t.Errorf("expected empty flow_data '{}', got '%s'", scenario.FlowData)
	}

	if scenario.CreatedAt.IsZero() {
		t.Error("expected created_at to be set")
	}

	if scenario.UpdatedAt.IsZero() {
		t.Error("expected updated_at to be set")
	}
}

func TestSaveAndLoadScenario(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	scenario, err := repo.CreateScenario("default", "Save Test")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	testFlowData := `{"nodes":[{"id":"1","type":"command"}],"edges":[]}`

	err = repo.SaveScenario(scenario.ID, testFlowData)
	if err != nil {
		t.Fatalf("failed to save scenario: %v", err)
	}

	loaded, err := repo.LoadScenario(scenario.ID)
	if err != nil {
		t.Fatalf("failed to load scenario: %v", err)
	}

	if loaded.FlowData != testFlowData {
		t.Errorf("expected flow_data '%s', got '%s'", testFlowData, loaded.FlowData)
	}

	if loaded.ID != scenario.ID {
		t.Errorf("expected ID '%s', got '%s'", scenario.ID, loaded.ID)
	}

	if loaded.Name != "Save Test" {
		t.Errorf("expected name 'Save Test', got '%s'", loaded.Name)
	}
}

func TestListScenariosOrderedByUpdatedAt(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	s1, err := repo.CreateScenario("default", "Scenario 1")
	if err != nil {
		t.Fatalf("failed to create scenario 1: %v", err)
	}

	s2, err := repo.CreateScenario("default", "Scenario 2")
	if err != nil {
		t.Fatalf("failed to create scenario 2: %v", err)
	}

	err = repo.SaveScenario(s1.ID, `{"updated":true}`)
	if err != nil {
		t.Fatalf("failed to update scenario 1: %v", err)
	}

	scenarios, err := repo.ListScenarios("default")
	if err != nil {
		t.Fatalf("failed to list scenarios: %v", err)
	}

	if len(scenarios) != 2 {
		t.Fatalf("expected 2 scenarios, got %d", len(scenarios))
	}

	if scenarios[0].ID != s1.ID {
		t.Errorf("expected first scenario to be s1 (most recently updated), got %s", scenarios[0].ID)
	}

	if scenarios[1].ID != s2.ID {
		t.Errorf("expected second scenario to be s2, got %s", scenarios[1].ID)
	}
}

func TestDeleteScenario(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	scenario, err := repo.CreateScenario("default", "To Delete")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	err = repo.DeleteScenario(scenario.ID)
	if err != nil {
		t.Fatalf("failed to delete scenario: %v", err)
	}

	_, err = repo.LoadScenario(scenario.ID)
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows after delete, got %v", err)
	}
}

func TestRenameScenario(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	scenario, err := repo.CreateScenario("default", "Old Name")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	err = repo.RenameScenario(scenario.ID, "New Name")
	if err != nil {
		t.Fatalf("failed to rename scenario: %v", err)
	}

	loaded, err := repo.LoadScenario(scenario.ID)
	if err != nil {
		t.Fatalf("failed to load scenario: %v", err)
	}

	if loaded.Name != "New Name" {
		t.Errorf("expected name 'New Name', got '%s'", loaded.Name)
	}
}

func TestLoadScenarioNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	_, err = repo.LoadScenario("non-existent-id")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows for non-existent ID, got %v", err)
	}
}

func TestDefaultProjectCreated(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	var name string
	err = repo.db.QueryRow("SELECT name FROM projects WHERE id = 'default'").Scan(&name)
	if err != nil {
		t.Fatalf("failed to query default project: %v", err)
	}

	if name != "Default Project" {
		t.Errorf("expected default project name 'Default Project', got '%s'", name)
	}
}
