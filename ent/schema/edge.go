package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Edge holds the schema definition for the Edge entity.
type Edge struct {
	ent.Schema
}

// Fields of the Edge.
func (Edge) Fields() []ent.Field {
	return []ent.Field{
		field.String("xyflow_id").
			Optional().
			Default(""),
		field.String("type").
			Optional().
			Default(""),
		field.String("source_handle").
			Optional().
			Default(""),
		field.String("target_handle").
			Optional().
			Default(""),
		field.JSON("data", map[string]interface{}{}).
			Optional(),
		field.Time("created_at").
			Immutable().
			Default(time.Now),
	}
}

// Edges of the Edge.
func (Edge) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("flow", Flow.Type).
			Ref("edges").
			Unique().
			Required(),
		edge.From("source_node", Node.Type).
			Ref("outgoing_edges").
			Unique().
			Required(),
		edge.From("target_node", Node.Type).
			Ref("incoming_edges").
			Unique().
			Required(),
	}
}
