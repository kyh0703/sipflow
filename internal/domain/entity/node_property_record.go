package entity

import "time"

// NodePropertyRecord는 노드별 속성 저장 레코드다.
type NodePropertyRecord struct {
	ScenarioID     string    `json:"scenario_id"`
	NodeID         string    `json:"node_id"`
	SchemaVersion  int64     `json:"schema_version"`
	PropertiesJSON string    `json:"properties_json"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
