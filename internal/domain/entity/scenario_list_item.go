package entity

import "time"

// ScenarioListItem은 목록 조회용 시나리오 요약이다.
type ScenarioListItem struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
