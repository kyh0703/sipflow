package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

// SIPServer holds the schema definition for the SIPServer entity.
type SIPServer struct {
	ent.Schema
}

// Fields of the SIPServer.
func (SIPServer) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			NotEmpty(),
		field.String("address").
			NotEmpty(),
		field.Int("port").
			Default(5060),
		field.String("transport").
			Default("UDP"),
		field.String("username").
			Optional().
			Default(""),
		field.String("password").
			Optional().
			Sensitive().
			Default(""),
		field.Time("created_at").
			Immutable().
			Default(time.Now),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the SIPServer.
func (SIPServer) Edges() []ent.Edge {
	return nil
}
