package repository

import (
	"context"

	"sipflow/internal/domain"
)

// NodeRepository defines the interface for node persistence operations.
type NodeRepository interface {
	Create(ctx context.Context, node *domain.Node) error
	FindByFlowID(ctx context.Context, flowID string) ([]*domain.Node, error)
	Update(ctx context.Context, node *domain.Node) error
	Delete(ctx context.Context, id string) error
}
