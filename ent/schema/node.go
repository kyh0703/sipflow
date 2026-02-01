package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Node holds the schema definition for the Node entity.
type Node struct {
	ent.Schema
}

// Fields of the Node.
func (Node) Fields() []ent.Field {
	return []ent.Field{
		field.String("type").
			NotEmpty(),
		field.JSON("data", map[string]interface{}{}).
			Optional(),
		field.Float("position_x").
			Default(0),
		field.Float("position_y").
			Default(0),
		field.Time("created_at").
			Immutable().
			Default(time.Now),
	}
}

// Edges of the Node.
func (Node) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("flow", Flow.Type).
			Ref("nodes").
			Unique().
			Required(),
		edge.To("outgoing_edges", Edge.Type).
			StorageKey(edge.Column("source_node_id")),
		edge.To("incoming_edges", Edge.Type).
			StorageKey(edge.Column("target_node_id")),
	}
}
