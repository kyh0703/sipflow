package entity

import "time"

// Scenario는 단일 테스트 시나리오다.
type Scenario struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	FlowData  string    `json:"flow_data"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
