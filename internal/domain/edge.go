package domain

import "time"

// Edge represents a connection between two nodes in a flow.
type Edge struct {
	ID           string
	SourceNodeID string
	TargetNodeID string
	SourceHandle string
	TargetHandle string
	FlowID       string
	CreatedAt    time.Time
}
