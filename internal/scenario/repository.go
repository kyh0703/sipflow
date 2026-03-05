package scenario

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/kyh0703/sipflow/internal/domain/entity"
	dbschema "github.com/kyh0703/sipflow/pkg/db"
	sqlcdb "github.com/kyh0703/sipflow/pkg/db/sqlc"
	_ "modernc.org/sqlite"
)

// Repository provides CRUD operations for scenarios using SQLite
type Repository struct {
	db      *sql.DB
	queries *sqlcdb.Queries
}

// NewRepository creates a new scenario repository with the given database path
func NewRepository(dbPath string) (*Repository, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	repo := &Repository{
		db:      db,
		queries: sqlcdb.New(db),
	}
	if err := repo.initTables(); err != nil {
		db.Close()
		return nil, err
	}

	return repo, nil
}

// initTables creates the database schema and seeds default project
func (r *Repository) initTables() error {
	_, err := r.db.Exec(dbschema.Schema())
	if err != nil {
		return fmt.Errorf("failed to initialize tables: %w", err)
	}

	return nil
}

// CreateScenario creates a new scenario with the given name
func (r *Repository) CreateScenario(projectID, name string) (*entity.Scenario, error) {
	id := uuid.NewString()
	now := time.Now()

	row, err := r.queries.CreateScenario(context.Background(), sqlcdb.CreateScenarioParams{
		ID:        id,
		ProjectID: projectID,
		Name:      name,
		CreatedAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create scenario: %w", err)
	}

	s := toScenario(row)
	return &s, nil
}

// SaveScenario updates the flow data for an existing scenario
func (r *Repository) SaveScenario(id, flowData string) error {
	rows, err := r.queries.SaveScenario(context.Background(), sqlcdb.SaveScenarioParams{
		FlowData:  flowData,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        id,
	})
	if err != nil {
		return fmt.Errorf("failed to save scenario: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// LoadScenario retrieves a scenario by ID
func (r *Repository) LoadScenario(id string) (*entity.Scenario, error) {
	row, err := r.queries.GetScenario(context.Background(), id)
	if err != nil {
		return nil, err
	}

	s := toScenario(row)
	return &s, nil
}

// ListScenarios retrieves all scenarios for a project, ordered by updated_at DESC
func (r *Repository) ListScenarios(projectID string) ([]entity.ScenarioListItem, error) {
	rows, err := r.queries.ListScenarios(context.Background(), projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to list scenarios: %w", err)
	}

	scenarios := make([]entity.ScenarioListItem, 0, len(rows))
	for _, row := range rows {
		scenarios = append(scenarios, entity.ScenarioListItem{
			ID:        row.ID,
			ProjectID: row.ProjectID,
			Name:      row.Name,
			CreatedAt: nullTimeToTime(row.CreatedAt),
			UpdatedAt: nullTimeToTime(row.UpdatedAt),
		})
	}

	return scenarios, nil
}

// DeleteScenario removes a scenario by ID
func (r *Repository) DeleteScenario(id string) error {
	rows, err := r.queries.DeleteScenario(context.Background(), id)
	if err != nil {
		return fmt.Errorf("failed to delete scenario: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// RenameScenario updates the name of a scenario
func (r *Repository) RenameScenario(id, newName string) error {
	rows, err := r.queries.RenameScenario(context.Background(), sqlcdb.RenameScenarioParams{
		Name:      newName,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        id,
	})
	if err != nil {
		return fmt.Errorf("failed to rename scenario: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) UpsertNodeProperty(scenarioID, nodeID string, schemaVersion int64, propertiesJSON string) error {
	err := r.queries.UpsertNodeProperty(context.Background(), sqlcdb.UpsertNodePropertyParams{
		ScenarioID:     scenarioID,
		NodeID:         nodeID,
		SchemaVersion:  schemaVersion,
		PropertiesJson: propertiesJSON,
	})
	if err != nil {
		return fmt.Errorf("failed to upsert node property: %w", err)
	}

	return nil
}

func (r *Repository) GetNodeProperty(scenarioID, nodeID string) (*entity.NodePropertyRecord, error) {
	row, err := r.queries.GetNodeProperty(context.Background(), sqlcdb.GetNodePropertyParams{
		ScenarioID: scenarioID,
		NodeID:     nodeID,
	})
	if err != nil {
		return nil, err
	}

	prop := entity.NodePropertyRecord{
		ScenarioID:     row.ScenarioID,
		NodeID:         row.NodeID,
		SchemaVersion:  row.SchemaVersion,
		PropertiesJSON: row.PropertiesJson,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}

	return &prop, nil
}

func (r *Repository) DeleteNodeProperty(scenarioID, nodeID string) error {
	rows, err := r.queries.DeleteNodeProperty(context.Background(), sqlcdb.DeleteNodePropertyParams{
		ScenarioID: scenarioID,
		NodeID:     nodeID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete node property: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) UpsertScenarioNode(node entity.NodeRecord) error {
	styleJSON := node.StyleJSON
	if styleJSON == "" {
		styleJSON = "{}"
	}

	err := r.queries.UpsertScenarioNode(context.Background(), sqlcdb.UpsertScenarioNodeParams{
		ScenarioID:    node.ScenarioID,
		NodeID:        node.NodeID,
		NodeType:      node.NodeType,
		Label:         node.Label,
		SipInstanceID: toNullString(node.SipInstanceID),
		PositionX:     node.PositionX,
		PositionY:     node.PositionY,
		Width:         toNullFloat64(node.Width),
		Height:        toNullFloat64(node.Height),
		ZIndex:        node.ZIndex,
		StyleJson:     styleJSON,
	})
	if err != nil {
		return fmt.Errorf("failed to upsert scenario node: %w", err)
	}

	return nil
}

func (r *Repository) ListScenarioNodes(scenarioID string) ([]entity.NodeRecord, error) {
	rows, err := r.queries.ListScenarioNodes(context.Background(), scenarioID)
	if err != nil {
		return nil, fmt.Errorf("failed to list scenario nodes: %w", err)
	}

	nodes := make([]entity.NodeRecord, 0, len(rows))
	for _, row := range rows {
		nodes = append(nodes, entity.NodeRecord{
			ScenarioID:    row.ScenarioID,
			NodeID:        row.NodeID,
			NodeType:      row.NodeType,
			Label:         row.Label,
			SipInstanceID: fromNullString(row.SipInstanceID),
			PositionX:     row.PositionX,
			PositionY:     row.PositionY,
			Width:         fromNullFloat64(row.Width),
			Height:        fromNullFloat64(row.Height),
			ZIndex:        row.ZIndex,
			StyleJSON:     row.StyleJson,
			CreatedAt:     row.CreatedAt,
			UpdatedAt:     row.UpdatedAt,
		})
	}

	return nodes, nil
}

func (r *Repository) DeleteScenarioNode(scenarioID, nodeID string) error {
	rows, err := r.queries.DeleteScenarioNode(context.Background(), sqlcdb.DeleteScenarioNodeParams{
		ScenarioID: scenarioID,
		NodeID:     nodeID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete scenario node: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) DeleteScenarioNodesByScenario(scenarioID string) error {
	_, err := r.queries.DeleteScenarioNodesByScenario(context.Background(), scenarioID)
	if err != nil {
		return fmt.Errorf("failed to delete scenario nodes by scenario: %w", err)
	}

	return nil
}

func (r *Repository) UpsertScenarioEdge(edge entity.EdgeRecord) error {
	branchType := edge.BranchType
	if branchType == "" {
		branchType = "success"
	}

	dataJSON := edge.DataJSON
	if dataJSON == "" {
		dataJSON = "{}"
	}

	err := r.queries.UpsertScenarioEdge(context.Background(), sqlcdb.UpsertScenarioEdgeParams{
		ScenarioID:   edge.ScenarioID,
		EdgeID:       edge.EdgeID,
		SourceNodeID: edge.SourceNodeID,
		TargetNodeID: edge.TargetNodeID,
		SourceHandle: toNullString(edge.SourceHandle),
		BranchType:   branchType,
		DataJson:     dataJSON,
	})
	if err != nil {
		return fmt.Errorf("failed to upsert scenario edge: %w", err)
	}

	return nil
}

func (r *Repository) ListScenarioEdges(scenarioID string) ([]entity.EdgeRecord, error) {
	rows, err := r.queries.ListScenarioEdges(context.Background(), scenarioID)
	if err != nil {
		return nil, fmt.Errorf("failed to list scenario edges: %w", err)
	}

	edges := make([]entity.EdgeRecord, 0, len(rows))
	for _, row := range rows {
		edges = append(edges, entity.EdgeRecord{
			ScenarioID:   row.ScenarioID,
			EdgeID:       row.EdgeID,
			SourceNodeID: row.SourceNodeID,
			TargetNodeID: row.TargetNodeID,
			SourceHandle: fromNullString(row.SourceHandle),
			BranchType:   row.BranchType,
			DataJSON:     row.DataJson,
			CreatedAt:    row.CreatedAt,
			UpdatedAt:    row.UpdatedAt,
		})
	}

	return edges, nil
}

func (r *Repository) DeleteScenarioEdge(scenarioID, edgeID string) error {
	rows, err := r.queries.DeleteScenarioEdge(context.Background(), sqlcdb.DeleteScenarioEdgeParams{
		ScenarioID: scenarioID,
		EdgeID:     edgeID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete scenario edge: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) DeleteScenarioEdgesByScenario(scenarioID string) error {
	_, err := r.queries.DeleteScenarioEdgesByScenario(context.Background(), scenarioID)
	if err != nil {
		return fmt.Errorf("failed to delete scenario edges by scenario: %w", err)
	}

	return nil
}

func toScenario(row sqlcdb.Scenario) entity.Scenario {
	return entity.Scenario{
		ID:        row.ID,
		ProjectID: row.ProjectID,
		Name:      row.Name,
		FlowData:  row.FlowData,
		CreatedAt: nullTimeToTime(row.CreatedAt),
		UpdatedAt: nullTimeToTime(row.UpdatedAt),
	}
}

func nullTimeToTime(v sql.NullTime) time.Time {
	if v.Valid {
		return v.Time
	}
	return time.Time{}
}

func toNullString(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}

func fromNullString(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func toNullFloat64(v *float64) sql.NullFloat64 {
	if v == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *v, Valid: true}
}

func fromNullFloat64(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	f := v.Float64
	return &f
}

// Close closes the database connection
func (r *Repository) Close() error {
	if r.db != nil {
		return r.db.Close()
	}
	return nil
}
