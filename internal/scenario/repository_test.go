package scenario

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/kyh0703/sipflow/internal/domain/entity"
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

func TestNodePropertyTablesCreatedAndCascadeOnScenarioDelete(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	scenario, err := repo.CreateScenario("default", "Node Property Schema")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	var tableCount int
	err = repo.db.QueryRow(`
		SELECT COUNT(*)
		FROM sqlite_master
		WHERE type='table'
		  AND name IN ('scenario_nodes', 'scenario_edges', 'node_properties')
	`).Scan(&tableCount)
	if err != nil {
		t.Fatalf("failed to verify schema tables: %v", err)
	}

	if tableCount != 3 {
		t.Fatalf("expected 3 schema tables, got %d", tableCount)
	}

	_, err = repo.db.Exec(`
		INSERT INTO scenario_nodes (scenario_id, node_id, node_type, label, position_x, position_y)
		VALUES (?, 'n1', 'command', 'Node 1', 0, 0)
	`, scenario.ID)
	if err != nil {
		t.Fatalf("failed to insert source node: %v", err)
	}

	_, err = repo.db.Exec(`
		INSERT INTO scenario_nodes (scenario_id, node_id, node_type, label, position_x, position_y)
		VALUES (?, 'n2', 'event', 'Node 2', 100, 100)
	`, scenario.ID)
	if err != nil {
		t.Fatalf("failed to insert target node: %v", err)
	}

	_, err = repo.db.Exec(`
		INSERT INTO node_properties (scenario_id, node_id, properties_json)
		VALUES (?, 'n1', '{"timeout": 10000}')
	`, scenario.ID)
	if err != nil {
		t.Fatalf("failed to insert node properties: %v", err)
	}

	_, err = repo.db.Exec(`
		INSERT INTO scenario_edges (scenario_id, edge_id, source_node_id, target_node_id)
		VALUES (?, 'e1', 'n1', 'n2')
	`, scenario.ID)
	if err != nil {
		t.Fatalf("failed to insert edge: %v", err)
	}

	err = repo.DeleteScenario(scenario.ID)
	if err != nil {
		t.Fatalf("failed to delete scenario: %v", err)
	}

	var count int
	err = repo.db.QueryRow(`SELECT COUNT(*) FROM scenario_nodes WHERE scenario_id = ?`, scenario.ID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count scenario_nodes: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected scenario_nodes to be deleted by cascade, got %d", count)
	}

	err = repo.db.QueryRow(`SELECT COUNT(*) FROM node_properties WHERE scenario_id = ?`, scenario.ID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count node_properties: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected node_properties to be deleted by cascade, got %d", count)
	}

	err = repo.db.QueryRow(`SELECT COUNT(*) FROM scenario_edges WHERE scenario_id = ?`, scenario.ID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count scenario_edges: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected scenario_edges to be deleted by cascade, got %d", count)
	}
}

func TestNodePropertyCRUD(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	sc, err := repo.CreateScenario("default", "Property CRUD")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	err = repo.UpsertScenarioNode(entity.NodeRecord{
		ScenarioID: sc.ID,
		NodeID:     "cmd-1",
		NodeType:   "command",
		Label:      "MakeCall",
		PositionX:  10,
		PositionY:  20,
		StyleJSON:  `{"color":"blue"}`,
	})
	if err != nil {
		t.Fatalf("failed to upsert scenario node: %v", err)
	}

	err = repo.UpsertNodeProperty(sc.ID, "cmd-1", 1, `{"timeout":10000}`)
	if err != nil {
		t.Fatalf("failed to upsert node property: %v", err)
	}

	prop, err := repo.GetNodeProperty(sc.ID, "cmd-1")
	if err != nil {
		t.Fatalf("failed to get node property: %v", err)
	}

	if prop.SchemaVersion != 1 {
		t.Fatalf("expected schema_version 1, got %d", prop.SchemaVersion)
	}

	if prop.PropertiesJSON != `{"timeout":10000}` {
		t.Fatalf("unexpected properties json: %s", prop.PropertiesJSON)
	}

	err = repo.UpsertNodeProperty(sc.ID, "cmd-1", 2, `{"timeout":5000}`)
	if err != nil {
		t.Fatalf("failed to update node property: %v", err)
	}

	prop, err = repo.GetNodeProperty(sc.ID, "cmd-1")
	if err != nil {
		t.Fatalf("failed to get updated node property: %v", err)
	}

	if prop.SchemaVersion != 2 {
		t.Fatalf("expected schema_version 2, got %d", prop.SchemaVersion)
	}

	if prop.PropertiesJSON != `{"timeout":5000}` {
		t.Fatalf("unexpected updated properties json: %s", prop.PropertiesJSON)
	}

	err = repo.DeleteNodeProperty(sc.ID, "cmd-1")
	if err != nil {
		t.Fatalf("failed to delete node property: %v", err)
	}

	_, err = repo.GetNodeProperty(sc.ID, "cmd-1")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
}

func TestScenarioNodeAndEdgeCRUD(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	repo, err := NewRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repository: %v", err)
	}
	defer repo.Close()

	sc, err := repo.CreateScenario("default", "Graph CRUD")
	if err != nil {
		t.Fatalf("failed to create scenario: %v", err)
	}

	width := 180.0
	height := 60.0
	instanceID := "sip-1"

	err = repo.UpsertScenarioNode(entity.NodeRecord{
		ScenarioID: sc.ID,
		NodeID:     "n1",
		NodeType:   "command",
		Label:      "MakeCall",
		PositionX:  100,
		PositionY:  120,
		Width:      &width,
		Height:     &height,
		ZIndex:     1,
		StyleJSON:  `{"left":"blue"}`,
	})
	if err != nil {
		t.Fatalf("failed to upsert first node: %v", err)
	}

	err = repo.UpsertScenarioNode(entity.NodeRecord{
		ScenarioID:    sc.ID,
		NodeID:        "n2",
		NodeType:      "event",
		Label:         "RINGING",
		SipInstanceID: &instanceID,
		PositionX:     320,
		PositionY:     120,
		ZIndex:        2,
		StyleJSON:     `{"left":"amber"}`,
	})
	if err != nil {
		t.Fatalf("failed to upsert second node: %v", err)
	}

	nodes, err := repo.ListScenarioNodes(sc.ID)
	if err != nil {
		t.Fatalf("failed to list nodes: %v", err)
	}

	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}

	err = repo.UpsertScenarioEdge(entity.EdgeRecord{
		ScenarioID:   sc.ID,
		EdgeID:       "e1",
		SourceNodeID: "n1",
		TargetNodeID: "n2",
		SourceHandle: strPtr("success"),
		BranchType:   "success",
		DataJSON:     `{"branchType":"success"}`,
	})
	if err != nil {
		t.Fatalf("failed to upsert edge: %v", err)
	}

	edges, err := repo.ListScenarioEdges(sc.ID)
	if err != nil {
		t.Fatalf("failed to list edges: %v", err)
	}

	if len(edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(edges))
	}

	err = repo.DeleteScenarioEdge(sc.ID, "e1")
	if err != nil {
		t.Fatalf("failed to delete edge: %v", err)
	}

	err = repo.DeleteScenarioNode(sc.ID, "n2")
	if err != nil {
		t.Fatalf("failed to delete node n2: %v", err)
	}

	err = repo.DeleteScenarioNodesByScenario(sc.ID)
	if err != nil {
		t.Fatalf("failed to delete nodes by scenario: %v", err)
	}

	err = repo.DeleteScenarioEdgesByScenario(sc.ID)
	if err != nil {
		t.Fatalf("failed to delete edges by scenario: %v", err)
	}

	nodes, err = repo.ListScenarioNodes(sc.ID)
	if err != nil {
		t.Fatalf("failed to list nodes after delete: %v", err)
	}
	if len(nodes) != 0 {
		t.Fatalf("expected 0 nodes after delete, got %d", len(nodes))
	}

	edges, err = repo.ListScenarioEdges(sc.ID)
	if err != nil {
		t.Fatalf("failed to list edges after delete: %v", err)
	}
	if len(edges) != 0 {
		t.Fatalf("expected 0 edges after delete, got %d", len(edges))
	}
}

func strPtr(v string) *string {
	return &v
}
