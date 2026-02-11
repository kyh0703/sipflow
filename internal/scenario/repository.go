package scenario

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Repository provides CRUD operations for scenarios using SQLite
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new scenario repository with the given database path
func NewRepository(dbPath string) (*Repository, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	repo := &Repository{db: db}
	if err := repo.initTables(); err != nil {
		db.Close()
		return nil, err
	}

	return repo, nil
}

// initTables creates the database schema and seeds default project
func (r *Repository) initTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS scenarios (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		flow_data TEXT NOT NULL DEFAULT '{}',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	INSERT OR IGNORE INTO projects (id, name) VALUES ('default', 'Default Project');
	`

	_, err := r.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to initialize tables: %w", err)
	}

	return nil
}

// CreateScenario creates a new scenario with the given name
func (r *Repository) CreateScenario(projectID, name string) (*Scenario, error) {
	id := uuid.New().String()
	now := time.Now()

	query := `
		INSERT INTO scenarios (id, project_id, name, flow_data, created_at, updated_at)
		VALUES (?, ?, ?, '{}', ?, ?)
	`

	_, err := r.db.Exec(query, id, projectID, name, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create scenario: %w", err)
	}

	return &Scenario{
		ID:        id,
		ProjectID: projectID,
		Name:      name,
		FlowData:  "{}",
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// SaveScenario updates the flow data for an existing scenario
func (r *Repository) SaveScenario(id, flowData string) error {
	query := `
		UPDATE scenarios
		SET flow_data = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := r.db.Exec(query, flowData, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to save scenario: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// LoadScenario retrieves a scenario by ID
func (r *Repository) LoadScenario(id string) (*Scenario, error) {
	query := `
		SELECT id, project_id, name, flow_data, created_at, updated_at
		FROM scenarios
		WHERE id = ?
	`

	var s Scenario
	err := r.db.QueryRow(query, id).Scan(
		&s.ID, &s.ProjectID, &s.Name, &s.FlowData, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &s, nil
}

// ListScenarios retrieves all scenarios for a project, ordered by updated_at DESC
func (r *Repository) ListScenarios(projectID string) ([]ScenarioListItem, error) {
	query := `
		SELECT id, project_id, name, created_at, updated_at
		FROM scenarios
		WHERE project_id = ?
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(query, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to list scenarios: %w", err)
	}
	defer rows.Close()

	scenarios := []ScenarioListItem{}
	for rows.Next() {
		var s ScenarioListItem
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.Name, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan scenario: %w", err)
		}
		scenarios = append(scenarios, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating scenarios: %w", err)
	}

	return scenarios, nil
}

// DeleteScenario removes a scenario by ID
func (r *Repository) DeleteScenario(id string) error {
	query := `DELETE FROM scenarios WHERE id = ?`

	result, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete scenario: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// RenameScenario updates the name of a scenario
func (r *Repository) RenameScenario(id, newName string) error {
	query := `
		UPDATE scenarios
		SET name = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := r.db.Exec(query, newName, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to rename scenario: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// Close closes the database connection
func (r *Repository) Close() error {
	if r.db != nil {
		return r.db.Close()
	}
	return nil
}
