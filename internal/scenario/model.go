package scenario

import "time"

// Project represents a collection of scenarios
type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Scenario represents a single test scenario with flow data
type Scenario struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	FlowData  string    `json:"flow_data"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ScenarioListItem represents a scenario without flow data, for list queries
type ScenarioListItem struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
