package repository

import (
	"context"

	"sipflow/internal/domain"
)

// EdgeRepository defines the interface for edge persistence operations.
type EdgeRepository interface {
	Create(ctx context.Context, edge *domain.Edge) error
	FindByFlowID(ctx context.Context, flowID string) ([]*domain.Edge, error)
	Delete(ctx context.Context, id string) error
}
