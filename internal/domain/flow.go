package domain

import "time"

// Flow represents a SIP call flow diagram.
type Flow struct {
	ID          string
	Name        string
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
