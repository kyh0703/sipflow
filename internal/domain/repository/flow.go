package repository

import (
	"context"

	"sipflow/internal/domain"
)

// FlowRepository defines the interface for flow persistence operations.
type FlowRepository interface {
	Create(ctx context.Context, flow *domain.Flow) error
	FindByID(ctx context.Context, id string) (*domain.Flow, error)
	List(ctx context.Context) ([]*domain.Flow, error)
	Update(ctx context.Context, flow *domain.Flow) error
	Delete(ctx context.Context, id string) error
}
