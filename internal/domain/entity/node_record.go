package entity

import "time"

// NodeRecord는 시나리오 노드 메타 저장 레코드다.
type NodeRecord struct {
	ScenarioID    string    `json:"scenario_id"`
	NodeID        string    `json:"node_id"`
	NodeType      string    `json:"node_type"`
	Label         string    `json:"label"`
	SipInstanceID *string   `json:"sip_instance_id,omitempty"`
	PositionX     float64   `json:"position_x"`
	PositionY     float64   `json:"position_y"`
	Width         *float64  `json:"width,omitempty"`
	Height        *float64  `json:"height,omitempty"`
	ZIndex        int64     `json:"z_index"`
	StyleJSON     string    `json:"style_json"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
