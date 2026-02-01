package domain

import "time"

// Node represents a node in a flow (SIP endpoint, action, etc.).
type Node struct {
	ID        string
	Type      string
	Data      map[string]interface{}
	PositionX float64
	PositionY float64
	FlowID    string
	CreatedAt time.Time
}
